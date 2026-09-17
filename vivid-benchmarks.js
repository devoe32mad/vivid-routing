"use strict";

const MIN_ORGANIZATIONS = 10;
const MIN_CAMPAIGNS = 20;

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function count(value) {
  return Math.max(0, Math.trunc(number(value)));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function percentile(sortedValues, percentileValue) {
  if (!sortedValues.length) return 0;
  const index = (sortedValues.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] +
    (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

function percentileRank(values, subjectValue) {
  if (!values.length) return 0;
  const below = values.filter(value => value < subjectValue).length;
  const equal = values.filter(value => value === subjectValue).length;
  return Math.round(((below + equal * 0.5) / values.length) * 100);
}

function normalizeCampaign(row = {}) {
  const scans = count(row.scans);
  const engagement = count(row.engagement === undefined ? row.intent : row.engagement);
  const conversions = count(row.conversions);
  return {
    organizationId: count(row.organizationId === undefined ? row.organization_id : row.organizationId),
    scans,
    engagementRate: scans > 0 ? (engagement / scans) * 100 : 0,
    conversionRate: scans > 0 ? (conversions / scans) * 100 : 0,
    attributedValue: Math.max(0, number(row.revenue === undefined ? row.attributedValue : row.revenue))
  };
}

function normalizeSubject(subject = {}) {
  const scans = count(subject.scans);
  const engagement = count(subject.engagement === undefined ? subject.intent : subject.engagement);
  const conversions = count(subject.conversions);
  const campaigns = Math.max(1, count(subject.campaigns) || 1);
  return {
    scansPerCampaign: scans / campaigns,
    engagementRate: scans > 0 ? (engagement / scans) * 100 : 0,
    conversionRate: scans > 0 ? (conversions / scans) * 100 : 0,
    attributedValuePerCampaign:
      Math.max(0, number(subject.revenue === undefined ? subject.attributedValue : subject.revenue)) / campaigns
  };
}

function metric(values, subjectValue) {
  const sorted = [...values].sort((a, b) => a - b);
  const median = percentile(sorted, 0.5);
  const rank = percentileRank(sorted, subjectValue);
  return {
    subject: subjectValue,
    median,
    lowerQuartile: percentile(sorted, 0.25),
    upperQuartile: percentile(sorted, 0.75),
    percentile: rank,
    comparison: median === 0
      ? subjectValue === 0 ? 0 : null
      : ((subjectValue - median) / median) * 100
  };
}

function buildVividBenchmark(input = {}) {
  const campaigns = (input.campaigns || []).map(normalizeCampaign);
  const organizationCount = new Set(
    campaigns.map(campaign => campaign.organizationId).filter(Boolean)
  ).size;
  const campaignCount = campaigns.length;
  const requiredOrganizations = Math.max(0, MIN_ORGANIZATIONS - organizationCount);
  const requiredCampaigns = Math.max(0, MIN_CAMPAIGNS - campaignCount);

  if (
    organizationCount < MIN_ORGANIZATIONS ||
    campaignCount < MIN_CAMPAIGNS
  ) {
    return {
      available: false,
      status: "Benchmark building",
      cohort: "Vivid measured campaigns",
      organizationCount,
      campaignCount,
      requiredOrganizations,
      requiredCampaigns,
      minimumOrganizations: MIN_ORGANIZATIONS,
      minimumCampaigns: MIN_CAMPAIGNS,
      explanation:
        "Vivid AI will publish this comparison only after the anonymous cohort meets both privacy and reliability thresholds."
    };
  }

  const subject = normalizeSubject(input.subject);
  const metrics = {
    scansPerCampaign: metric(campaigns.map(campaign => campaign.scans), subject.scansPerCampaign),
    engagementRate: metric(campaigns.map(campaign => campaign.engagementRate), subject.engagementRate),
    conversionRate: metric(campaigns.map(campaign => campaign.conversionRate), subject.conversionRate),
    attributedValuePerCampaign: metric(campaigns.map(campaign => campaign.attributedValue), subject.attributedValuePerCampaign)
  };
  const strongest = Object.entries(metrics).sort((a, b) => b[1].percentile - a[1].percentile)[0];
  const weakest = Object.entries(metrics).sort((a, b) => a[1].percentile - b[1].percentile)[0];

  return {
    available: true,
    status: "Benchmark available",
    cohort: "Vivid measured campaigns",
    organizationCount,
    campaignCount,
    metrics,
    confidence: campaignCount >= 50 && organizationCount >= 20 ? "High" : "Medium",
    aiInterpretation: {
      strongestMetric: strongest[0],
      strongestPercentile: strongest[1].percentile,
      opportunityMetric: weakest[0],
      opportunityPercentile: weakest[1].percentile,
      recommendation: weakest[0] === "conversionRate"
        ? "Improve the post-scan offer and conversion path before increasing spend or renewal price."
        : weakest[0] === "engagementRate"
          ? "Test a clearer call to action and a tighter destination experience."
          : weakest[0] === "scansPerCampaign"
            ? "Review placement visibility, creative, and call-to-action strength."
            : "Verify conversion value and focus renewal discussions on placements producing measurable outcomes."
    },
    privacy:
      "Only aggregated distributions are shown. Organization, advertiser, campaign, placement, and price identities are never exposed."
  };
}

async function loadVividBenchmark(q, input = {}) {
  const startDate = input.startDate || null;
  const endDate = input.endDate || null;
  const result = await q(
    `
      SELECT
        s.organization_id,
        c.id AS campaign_id,
        COUNT(e.id) FILTER (WHERE e.type = 'scan')::int AS scans,
        COUNT(e.id) FILTER (
          WHERE e.type IN ('offer', 'maps', 'waze', 'destination_click')
        )::int AS engagement,
        COUNT(e.id) FILTER (WHERE e.type = 'conversion')::int AS conversions,
        COALESCE(SUM(e.value) FILTER (WHERE e.type = 'conversion'), 0)::numeric AS revenue
      FROM campaigns c
      JOIN qr_campaigns qc ON qc.campaign_id = c.id
      JOIN qr_codes qr ON qr.id = qc.qr_id
      JOIN spaces s ON s.id = qr.space_id
      LEFT JOIN events e
        ON e.campaign_id = c.id
       AND e.qr_id = qr.id
       AND ($1::date IS NULL OR e.created_at::date >= $1::date)
       AND ($2::date IS NULL OR e.created_at::date <= $2::date)
      WHERE COALESCE(c.is_test, false) = false
        AND COALESCE(c.is_archived, false) = false
        AND COALESCE(qr.is_archived, false) = false
      GROUP BY s.organization_id, c.id
      HAVING COUNT(e.id) > 0
    `,
    [startDate, endDate]
  );

  return buildVividBenchmark({
    campaigns: result.rows,
    subject: input.subject
  });
}

const LABELS = {
  scansPerCampaign: "Scans per campaign",
  engagementRate: "Post-scan engagement rate",
  conversionRate: "Conversion rate",
  attributedValuePerCampaign: "Attributed value per campaign"
};

function formatMetric(key, value) {
  if (key === "attributedValuePerCampaign") {
    return number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });
  }
  if (key === "engagementRate" || key === "conversionRate") {
    return `${number(value).toFixed(1)}%`;
  }
  return number(value).toFixed(1);
}

function renderVividBenchmark(benchmark, options = {}) {
  if (!benchmark) return "";
  const role =
    options.role === "enterprise"
      ? "enterprise"
      : options.role === "platform"
        ? "platform"
        : "advertiser";
  if (!benchmark.available) {
    const gaps = [];
    if (benchmark.requiredOrganizations) gaps.push(`${benchmark.requiredOrganizations} more organizations`);
    if (benchmark.requiredCampaigns) gaps.push(`${benchmark.requiredCampaigns} more campaigns`);
    return `
      <section class="card" style="margin:18px 0;padding:20px;border:1px solid #dbe3f0;border-radius:16px;background:#f8fbff;">
        <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#3155a6;text-transform:uppercase;">Vivid AI Benchmark</div>
        <h2 style="margin:7px 0 8px;">${escapeHtml(benchmark.status)}</h2>
        <p style="margin:0 0 10px;color:#46556b;">${escapeHtml(benchmark.explanation)}</p>
        <div><strong>${benchmark.organizationCount}</strong> anonymous organizations · <strong>${benchmark.campaignCount}</strong> measured campaigns</div>
        <p style="margin:10px 0 0;color:#68778d;font-size:13px;">Needed before release: ${escapeHtml(gaps.join(" and ") || "threshold met")}. No benchmark estimate is shown early.</p>
      </section>`;
  }

  const rows = Object.entries(benchmark.metrics).map(([key, item]) => `
    <tr>
      <td style="padding:9px;border-bottom:1px solid #e6ebf2;">${escapeHtml(LABELS[key])}</td>
      <td style="padding:9px;border-bottom:1px solid #e6ebf2;text-align:right;">${escapeHtml(formatMetric(key, item.subject))}</td>
      <td style="padding:9px;border-bottom:1px solid #e6ebf2;text-align:right;">${escapeHtml(formatMetric(key, item.median))}</td>
      <td style="padding:9px;border-bottom:1px solid #e6ebf2;text-align:right;font-weight:700;">${item.percentile}th</td>
    </tr>`).join("");
  const insight = benchmark.aiInterpretation;
  return `
    <section class="card" style="margin:18px 0;padding:20px;border:1px solid #cfdcf2;border-radius:16px;background:#fbfdff;">
      <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#3155a6;text-transform:uppercase;">Vivid AI Benchmark · ${escapeHtml(benchmark.confidence)} confidence</div>
      <h2 style="margin:7px 0 8px;">How ${role === "platform" ? "the platform portfolio" : role === "enterprise" ? "your portfolio" : "your campaigns"} compares</h2>
      <p style="margin:0 0 14px;color:#46556b;">Anonymous cohort: ${benchmark.organizationCount} organizations and ${benchmark.campaignCount} campaigns.</p>
      <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="padding:9px;text-align:left;">Metric</th><th style="padding:9px;text-align:right;">You</th><th style="padding:9px;text-align:right;">Cohort median</th><th style="padding:9px;text-align:right;">Percentile</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div style="margin-top:14px;padding:14px;border-radius:12px;background:#eef5ff;"><strong>AI interpretation:</strong> Strongest relative result: ${escapeHtml(LABELS[insight.strongestMetric])} (${insight.strongestPercentile}th percentile). Biggest opportunity: ${escapeHtml(LABELS[insight.opportunityMetric])} (${insight.opportunityPercentile}th percentile). ${escapeHtml(insight.recommendation)}</div>
      <p style="margin:10px 0 0;color:#68778d;font-size:12px;">${escapeHtml(benchmark.privacy)}</p>
    </section>`;
}

module.exports = {
  MIN_ORGANIZATIONS,
  MIN_CAMPAIGNS,
  buildVividBenchmark,
  loadVividBenchmark,
  renderVividBenchmark
};
