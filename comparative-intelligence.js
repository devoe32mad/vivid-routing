"use strict";

const APPROVED_EXTERNAL_SOURCES = Object.freeze([
  {
    id: "google-conversion-measurement",
    publisher: "Google Ads Help",
    title: "About conversion measurement",
    url: "https://support.google.com/google-ads/answer/1722022?hl=en",
    reviewedOn: "2026-09-16",
    principle:
      "Measure actions that are valuable to the business and use conversions and ROI to evaluate campaign performance."
  },
  {
    id: "google-attribution",
    publisher: "Google Analytics Help",
    title: "Get started with attribution",
    url: "https://support.google.com/analytics/answer/10596866?hl=en",
    reviewedOn: "2026-09-16",
    principle:
      "Attribution assigns credit for important actions across the interactions that precede them."
  },
  {
    id: "google-key-events",
    publisher: "Google Analytics Help",
    title: "Conversions vs. key events in Google Analytics",
    url: "https://support.google.com/analytics/answer/13965727?hl=en",
    reviewedOn: "2026-09-16",
    principle:
      "A measured conversion should represent an action that is important to the business."
  }
]);

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function count(value) {
  return Math.max(0, Math.trunc(number(value)));
}

function money(value) {
  return number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function calculatePreviousPeriod(startDate, endDate) {
  const start = new Date(`${String(startDate || "")}T00:00:00Z`);
  const end = new Date(`${String(endDate || "")}T00:00:00Z`);
  if (
    !startDate ||
    !endDate ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    return null;
  }

  const days = Math.floor((end - start) / 86400000) + 1;
  const previousEnd = new Date(start.getTime() - 86400000);
  const previousStart = new Date(
    previousEnd.getTime() - (days - 1) * 86400000
  );

  return {
    startDate: dateOnly(start),
    endDate: dateOnly(end),
    previousStartDate: dateOnly(previousStart),
    previousEndDate: dateOnly(previousEnd),
    days
  };
}

function normalizeCampaign(campaign = {}) {
  return {
    id: count(campaign.id),
    name: String(campaign.name || "Unnamed Campaign"),
    scans: count(campaign.scans),
    engagement: count(
      campaign.engagement === undefined ? campaign.intent : campaign.engagement
    ),
    conversions: count(campaign.conversions),
    revenue: number(campaign.revenue),
    investment: Math.max(
      0,
      number(
        campaign.investment === undefined
          ? campaign.allocatedCost
          : campaign.investment
      )
    ),
    href: String(campaign.href || "")
  };
}

function totals(campaigns) {
  return campaigns.reduce(
    (result, campaign) => {
      result.scans += campaign.scans;
      result.engagement += campaign.engagement;
      result.conversions += campaign.conversions;
      result.revenue += campaign.revenue;
      result.investment += campaign.investment;
      return result;
    },
    { scans: 0, engagement: 0, conversions: 0, revenue: 0, investment: 0 }
  );
}

function metricChange(current, previous) {
  const delta = number(current) - number(previous);
  const percent = number(previous) === 0
    ? number(current) === 0
      ? 0
      : null
    : (delta / Math.abs(number(previous))) * 100;
  return { current: number(current), previous: number(previous), delta, percent };
}

function buildComparativeIntelligence(input = {}) {
  const role = input.role === "enterprise" ? "enterprise" : "advertiser";
  const period = input.period || null;
  const currentCampaigns = (input.currentCampaigns || []).map(normalizeCampaign);
  const previousCampaigns = (input.previousCampaigns || []).map(normalizeCampaign);

  if (!period) {
    return {
      available: false,
      role,
      message:
        "Choose both a start and end date to compare this period with the immediately preceding period of equal length."
    };
  }

  const current = totals(currentCampaigns);
  const previous = totals(previousCampaigns);
  current.roi = current.investment > 0
    ? ((current.revenue - current.investment) / current.investment) * 100
    : null;
  previous.roi = previous.investment > 0
    ? ((previous.revenue - previous.investment) / previous.investment) * 100
    : null;

  const metrics = {
    scans: metricChange(current.scans, previous.scans),
    engagement: metricChange(current.engagement, previous.engagement),
    conversions: metricChange(current.conversions, previous.conversions),
    revenue: metricChange(current.revenue, previous.revenue),
    investment: metricChange(current.investment, previous.investment),
    roi: metricChange(current.roi || 0, previous.roi || 0)
  };

  const previousById = new Map(
    previousCampaigns.map(campaign => [campaign.id, campaign])
  );
  const drivers = currentCampaigns
    .map(campaign => {
      const prior = previousById.get(campaign.id) || normalizeCampaign({
        id: campaign.id,
        name: campaign.name
      });
      return {
        id: campaign.id,
        name: campaign.name,
        revenueDelta: campaign.revenue - prior.revenue,
        conversionDelta: campaign.conversions - prior.conversions,
        engagementDelta: campaign.engagement - prior.engagement,
        href: campaign.href
      };
    })
    .sort(
      (a, b) =>
        Math.abs(b.revenueDelta) - Math.abs(a.revenueDelta) ||
        Math.abs(b.conversionDelta) - Math.abs(a.conversionDelta) ||
        Math.abs(b.engagementDelta) - Math.abs(a.engagementDelta)
    )
    .slice(0, 3);

  const volume = current.scans + previous.scans + current.conversions + previous.conversions;
  const confidence = volume >= 40
    ? "High"
    : volume >= 10
      ? "Medium"
      : "Low";
  const revenueDirection = metrics.revenue.delta > 0
    ? "increased"
    : metrics.revenue.delta < 0
      ? "decreased"
      : "was unchanged";
  const conversionDirection = metrics.conversions.delta > 0
    ? "increased"
    : metrics.conversions.delta < 0
      ? "decreased"
      : "was unchanged";

  return {
    available: true,
    role,
    period,
    current,
    previous,
    metrics,
    drivers,
    confidence,
    summary: `Attributed value ${revenueDirection} by ${money(
      Math.abs(metrics.revenue.delta)
    )}, while tracked conversions ${conversionDirection} by ${Math.abs(
      metrics.conversions.delta
    ).toLocaleString()} compared with the previous ${period.days}-day period.`
  };
}

function buildRenewalPricingRecommendation(input = {}) {
  const currentPrice = Math.max(0, number(input.currentPrice));
  const revenue = Math.max(0, number(input.revenue));
  const conversions = count(input.conversions);
  const scans = count(input.scans);
  const trend = number(input.revenueTrendPercent);
  const expiringSoon = Boolean(input.expiringSoon);

  if (currentPrice <= 0) {
    return {
      status: "Price review required",
      recommendation: null,
      reason: "No current contract or placement price is available as a defensible renewal baseline.",
      confidence: "Low"
    };
  }

  if (scans < 5 && conversions === 0) {
    return {
      status: "Hold price",
      recommendation: currentPrice,
      low: currentPrice,
      high: currentPrice,
      changePercent: 0,
      reason:
        "There is not enough measured activity to support a performance-based price change.",
      projectedRoi: revenue > 0
        ? ((revenue - currentPrice) / currentPrice) * 100
        : null,
      confidence: "Low"
    };
  }

  const roi = revenue > 0
    ? ((revenue - currentPrice) / currentPrice) * 100
    : -100;
  let lowChange = 0;
  let highChange = 0;
  let recommendedChange = 0;
  let status = "Hold price";
  let reason =
    "Measured performance supports renewing at the current price while additional evidence is collected.";

  if (conversions > 0 && roi >= 100 && trend >= 0) {
    lowChange = 5;
    highChange = trend >= 20 ? 12 : 8;
    recommendedChange = trend >= 20 ? 8 : 5;
    status = "Increase supported";
    reason =
      "Positive conversions, strong advertiser return, and stable or improving attributed value support a measured renewal increase.";
  } else if (conversions > 0 && roi >= 0) {
    lowChange = 0;
    highChange = 5;
    recommendedChange = expiringSoon ? 3 : 0;
    status = "Modest increase possible";
    reason =
      "The placement is producing positive measured value, but the evidence supports only a modest change.";
  } else if (conversions === 0 || roi < 0) {
    lowChange = -5;
    highChange = 0;
    recommendedChange = 0;
    status = "Hold and improve performance";
    reason =
      "Measured results do not support a price increase. Preserve the current price while improving the offer or conversion path.";
  }

  const recommendation =
    Math.round(currentPrice * (1 + recommendedChange / 100) * 100) / 100;
  const low =
    Math.round(currentPrice * (1 + lowChange / 100) * 100) / 100;
  const high =
    Math.round(currentPrice * (1 + highChange / 100) * 100) / 100;

  return {
    status,
    recommendation,
    low,
    high,
    changePercent: recommendedChange,
    reason,
    projectedRoi: revenue > 0
      ? ((revenue - recommendation) / recommendation) * 100
      : null,
    confidence: conversions >= 2 || scans >= 20 ? "High" : "Medium"
  };
}

function externalRecommendations(context = {}) {
  const recommendations = [];
  if (count(context.engagement) > 0 && count(context.conversions) === 0) {
    recommendations.push({
      sourceType: "External Best Practice",
      title: "Verify the conversion action and attribution path",
      text:
        "Measurable engagement without a completed conversion suggests reviewing whether the destination and confirmation event represent the business outcome you intend to measure.",
      source: APPROVED_EXTERNAL_SOURCES[0]
    });
  }
  if (count(context.conversions) > 0) {
    recommendations.push({
      sourceType: "External Best Practice",
      title: "Keep the conversion definition consistent",
      text:
        "Use a stable definition of the valuable action when comparing performance across campaigns and reporting periods.",
      source: APPROVED_EXTERNAL_SOURCES[2]
    });
  }
  return recommendations.slice(0, 2);
}

function renderComparativeIntelligence(comparison, options = {}) {
  if (!comparison.available) {
    return `<section class="card" style="margin:0 0 28px;border-left:5px solid #8a6400;"><h2 style="margin-top:0;">Comparative Intelligence</h2><p style="color:#65776b;margin-bottom:0;">${escapeHtml(
      comparison.message
    )}</p></section>`;
  }

  const external = externalRecommendations(comparison.current);
  const metricCards = [
    ["Scans", comparison.metrics.scans, value => Math.round(value).toLocaleString()],
    ["Clicks", comparison.metrics.engagement, value => Math.round(value).toLocaleString()],
    ["Conversions", comparison.metrics.conversions, value => Math.round(value).toLocaleString()],
    ["Attributed Value", comparison.metrics.revenue, money]
  ];

  return `
    <section class="card" style="margin:0 0 28px;border-top:5px solid #173b6b;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#173b6b;">Comparative Intelligence</div>
          <h2 style="margin:7px 0 5px;">Current period versus previous ${comparison.period.days}-day period</h2>
          <div style="color:#65776b;">${escapeHtml(comparison.period.startDate)}–${escapeHtml(
            comparison.period.endDate
          )} compared with ${escapeHtml(comparison.period.previousStartDate)}–${escapeHtml(
            comparison.period.previousEndDate
          )}</div>
        </div>
        <span style="padding:7px 10px;border-radius:999px;background:#e8eef7;color:#173b6b;font-size:12px;font-weight:800;">${escapeHtml(
          comparison.confidence
        )} confidence</span>
      </div>
      <div style="margin-top:18px;padding:17px;border-radius:12px;background:#102b50;color:#fff;font-size:16px;font-weight:650;line-height:1.5;">${escapeHtml(
        comparison.summary
      )}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:11px;margin-top:14px;">
        ${metricCards.map(([label, metric, formatter]) => `
          <div style="padding:14px;border:1px solid #dce4ee;border-radius:11px;background:#fff;">
            <div style="font-size:12px;color:#65776b;font-weight:800;">${label}</div>
            <div style="font-size:19px;font-weight:850;color:#102b50;margin-top:5px;">${formatter(
              metric.current
            )}</div>
            <div style="font-size:12px;color:${metric.delta >= 0 ? "#176b3a" : "#b42318"};margin-top:4px;font-weight:800;">${metric.delta >= 0 ? "+" : ""}${formatter(
              metric.delta
            )}${metric.percent === null ? " · new activity" : ` · ${metric.percent >= 0 ? "+" : ""}${metric.percent.toFixed(1)}%`}</div>
          </div>`).join("")}
      </div>
      ${comparison.drivers.length ? `<h3 style="margin:22px 0 9px;">Largest campaign drivers</h3><div style="display:grid;gap:8px;">${comparison.drivers.map(driver => `
        <a href="${escapeHtml(driver.href || options.fallbackHref || "#")}" style="display:flex;justify-content:space-between;gap:12px;padding:12px;border-radius:10px;background:#f4f7fb;text-decoration:none;color:inherit;">
          <strong>${escapeHtml(driver.name)}</strong>
          <span>${driver.revenueDelta >= 0 ? "+" : ""}${money(driver.revenueDelta)} value · ${driver.conversionDelta >= 0 ? "+" : ""}${driver.conversionDelta} conversions</span>
        </a>`).join("")}</div>` : ""}
      ${external.length ? `<h3 style="margin:22px 0 9px;">Verified external guidance</h3><div style="display:grid;gap:9px;">${external.map(item => `
        <div style="padding:14px;border:1px solid #dce8df;border-radius:10px;background:#fff;">
          <div style="font-size:11px;font-weight:900;color:#176b3a;text-transform:uppercase;">${escapeHtml(item.sourceType)}</div>
          <div style="font-weight:850;margin-top:5px;">${escapeHtml(item.title)}</div>
          <div style="color:#53675c;line-height:1.45;margin-top:6px;">${escapeHtml(item.text)}</div>
          <a href="${escapeHtml(item.source.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:800;">${escapeHtml(
            item.source.publisher
          )}: ${escapeHtml(item.source.title)} · reviewed ${escapeHtml(item.source.reviewedOn)} →</a>
        </div>`).join("")}</div>` : ""}
    </section>`;
}

function renderRenewalPricingRecommendations(items = []) {
  const recommendations = Array.isArray(items) ? items : [];
  if (!recommendations.length) {
    return "";
  }

  return `
    <section class="card" style="margin:0 0 28px;border-top:5px solid #8a6400;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#8a6400;">Renewal Action Center</div>
          <h2 style="margin:7px 0 5px;">Renewals requiring a decision in the next 90 days</h2>
          <div style="color:#65776b;">AI-supported guidance · Recommendations only · Nothing changes automatically</div>
        </div>
        <span style="padding:7px 10px;border-radius:999px;background:#fff6d8;color:#745300;font-size:12px;font-weight:800;">Enterprise only</span>
      </div>
      <div style="display:grid;gap:11px;margin-top:18px;">
        ${recommendations.slice(0, 6).map(item => {
          const recommendation = item.recommendation || {};
          return `
            <a href="${escapeHtml(item.href || "/org-renewals")}" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;align-items:center;padding:15px;border:1px solid #eadfb8;border-radius:11px;text-decoration:none;color:inherit;background:#fffdf6;">
              <div>
                <div style="font-weight:850;color:#473600;">${escapeHtml(item.name || "Renewal")}</div>
                <div style="font-size:12px;color:#65776b;margin-top:5px;">Current price ${money(item.currentPrice)}${item.endDate ? ` · Expires ${escapeHtml(item.endDate)}` : ""}</div>\n                <div style="font-size:12px;color:#65776b;margin-top:5px;">${count(item.scans).toLocaleString()} scans · ${count(item.clicks).toLocaleString()} clicks · ${count(item.conversions).toLocaleString()} conversions · ${money(item.revenue)} value</div>
              </div>
              <div>
                <div style="font-size:11px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:#65776b;">Recommended action</div>\n                <div style="font-weight:850;color:#8a6400;">${escapeHtml(recommendation.status || "Review")}</div>
                <div style="font-size:12px;color:#65776b;margin-top:5px;">${escapeHtml(recommendation.confidence || "Low")} confidence</div>
              </div>
              <div>
                <div style="font-weight:850;color:#073b22;">${recommendation.recommendation === null || recommendation.recommendation === undefined ? "Manual review" : `${money(recommendation.recommendation)} recommended`}</div>
                <div style="font-size:12px;color:#65776b;margin-top:5px;">${recommendation.low === undefined ? "No range available" : `${money(recommendation.low)}–${money(recommendation.high)} range`}</div>
              </div>
              <div style="font-size:13px;color:#53675c;line-height:1.45;">${escapeHtml(recommendation.reason || "")}</div>
            </a>`;
        }).join("")}
      </div>
      <div style="font-size:12px;color:#65776b;margin-top:14px;">Open any recommendation to review the renewal record. Pricing guidance uses measured performance and the current price as its baseline. It does not estimate market demand until sufficient comparable Vivid benchmark data exists.</div>
    </section>`;
}

module.exports = {
  APPROVED_EXTERNAL_SOURCES,
  calculatePreviousPeriod,
  buildComparativeIntelligence,
  buildRenewalPricingRecommendation,
  externalRecommendations,
  renderComparativeIntelligence,
  renderRenewalPricingRecommendations
};
