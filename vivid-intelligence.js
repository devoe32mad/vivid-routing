"use strict";

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

function plural(value, singular, pluralForm = `${singular}s`) {
  return count(value) === 1 ? singular : pluralForm;
}

function buildOrganizationIntelligence(input = {}) {
  const organizationName =
    String(input.organizationName || "This organization").trim() ||
    "This organization";
  const organizationId = count(input.organizationId);
  const totals = input.totals || {};
  const locations = Array.isArray(input.locations) ? input.locations : [];
  const qrPlacements = count(totals.qrPlacements);
  const campaigns = count(totals.activeCampaigns);
  const scans = count(totals.scans);
  const intent = count(totals.intent);
  const conversions = count(totals.conversions);
  const conversionValue = number(totals.conversionValue);
  const availableSpots = count(input.availableSpots);
  const pendingSpots = count(input.pendingSpots);
  const pendingRevenue = number(input.pendingRevenue);
  const advertiserCount = count(input.advertiserCount);
  const activeContracts = count(input.activeContracts);
  const queryString = String(input.queryString || "").trim();
  const suffix = queryString ? `&${queryString}` : "";
  const organizationSuffix = organizationId
    ? `?organization_id=${organizationId}`
    : "";

  const evidence = [];
  const attention = [];
  const recommendations = [];

  let summary;
  if (campaigns === 0 && scans === 0) {
    summary = `${organizationName} does not yet have measurable campaign activity in the selected period.`;
  } else if (conversions > 0) {
    summary = `${organizationName} generated ${conversions.toLocaleString()} tracked ${plural(
      conversions,
      "conversion"
    )} worth ${money(conversionValue)} from ${scans.toLocaleString()} ${plural(
      scans,
      "scan"
    )} in the selected period.`;
  } else if (intent > 0) {
    summary = `${organizationName} generated ${intent.toLocaleString()} measurable intent ${plural(
      intent,
      "action"
    )}, but no tracked conversions were recorded in the selected period.`;
  } else {
    summary = `${organizationName} recorded ${scans.toLocaleString()} ${plural(
      scans,
      "scan"
    )} across ${campaigns.toLocaleString()} active ${plural(
      campaigns,
      "campaign"
    )}, with no tracked conversions in the selected period.`;
  }

  evidence.push(
    `${qrPlacements.toLocaleString()} active ${plural(qrPlacements, "placement")}`,
    `${campaigns.toLocaleString()} active ${plural(campaigns, "campaign")}`,
    `${advertiserCount.toLocaleString()} ${plural(advertiserCount, "advertiser")}`,
    `${activeContracts.toLocaleString()} active ${plural(activeContracts, "contract")}`
  );

  if (locations.length === 0) {
    attention.push({
      title: "No active locations",
      text: "Vivid cannot measure or compare performance until at least one location is active.",
      href: `/org-locations${organizationSuffix}`,
      linkLabel: "Review locations"
    });
  } else if (qrPlacements === 0) {
    attention.push({
      title: "No active QR placements",
      text: "The organization has locations, but no active QR placements are available for measurement.",
      href: `/org-locations${organizationSuffix}`,
      linkLabel: "Review locations"
    });
  }

  if (campaigns > 0 && scans === 0) {
    attention.push({
      title: "Active campaigns have no scans",
      text: "Confirm that each QR code is visible, working, and connected to the intended campaign.",
      href: `/org-business-breakdown?organization_id=${organizationId}&metric=active${suffix}`,
      linkLabel: "Review active advertising"
    });
  }

  if (intent > 0 && conversions === 0) {
    attention.push({
      title: "Interest is not reaching conversion",
      text: `${intent.toLocaleString()} intent ${plural(
        intent,
        "action"
      )} were measured without a tracked conversion. Review the destination, offer, and conversion confirmation path.`,
      href: `/org-business-breakdown?organization_id=${organizationId}&metric=advertiser-revenue${suffix}`,
      linkLabel: "Review attributed results"
    });
  }

  if (pendingSpots > 0) {
    attention.push({
      title: `${pendingSpots.toLocaleString()} pending advertising ${plural(
        pendingSpots,
        "request"
      )}`,
      text: `${money(pendingRevenue)} in potential advertising revenue is awaiting review.`,
      href: `/org-business-breakdown?organization_id=${organizationId}&metric=pending${suffix}`,
      linkLabel: "Review pending advertising"
    });
  }

  const strongestLocation = [...locations]
    .map(location => ({
      id: count(location.id),
      name: String(location.name || "Unnamed Location"),
      conversions: count(location.conversions),
      conversionValue: number(location.conversion_value),
      intent: count(location.intent),
      scans: count(location.scans)
    }))
    .sort(
      (a, b) =>
        b.conversionValue - a.conversionValue ||
        b.conversions - a.conversions ||
        b.intent - a.intent ||
        b.scans - a.scans
    )[0];

  if (
    strongestLocation &&
    (strongestLocation.conversionValue > 0 ||
      strongestLocation.conversions > 0 ||
      strongestLocation.intent > 0 ||
      strongestLocation.scans > 0)
  ) {
    recommendations.push({
      title: `Learn from ${strongestLocation.name}`,
      text:
        strongestLocation.conversions > 0
          ? `This is the strongest measured location, with ${strongestLocation.conversions.toLocaleString()} tracked ${plural(
              strongestLocation.conversions,
              "conversion"
            )} worth ${money(strongestLocation.conversionValue)}.`
          : `This location currently has the strongest click activity. Compare its placement, message, and offer with lower-activity locations.`,
      href: `/org-location/${strongestLocation.id}?organization_id=${organizationId}`,
      linkLabel: "Open location"
    });
  }

  if (availableSpots > 0) {
    recommendations.push({
      title: "Promote available inventory",
      text: `${availableSpots.toLocaleString()} available advertising ${plural(
        availableSpots,
        "spot"
      )} can be presented through the marketplace and targeted outreach.`,
      href: `/org-business-breakdown?organization_id=${organizationId}&metric=available`,
      linkLabel: "Review available advertising"
    });
  }

  if (campaigns > 0 && scans > 0 && intent === 0) {
    recommendations.push({
      title: "Strengthen the call to action",
      text: `${scans.toLocaleString()} ${plural(
        scans,
        "scan"
      )} produced no measured clicks. Test a clearer offer or more direct next step.`,
      href: `/org-business-breakdown?organization_id=${organizationId}&metric=active${suffix}`,
      linkLabel: "Review campaigns"
    });
  }

  if (conversions > 0) {
    recommendations.push({
      title: "Use measured outcomes in renewals",
      text: `Include the ${conversions.toLocaleString()} tracked ${plural(
        conversions,
        "conversion"
      )} and ${money(conversionValue)} in advertiser performance and renewal conversations.`,
      href: `/org-contracts${organizationSuffix}`,
      linkLabel: "Review contracts"
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Complete the measurement foundation",
      text: "Add active placements and campaigns, then verify the full scan-to-conversion journey before evaluating performance.",
      href: `/org-locations${organizationSuffix}`,
      linkLabel: "Review setup"
    });
  }

  return {
    summary,
    evidence,
    attention: attention.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    performanceHref: organizationId
      ? `/org-performance?organization_id=${organizationId}${suffix}`
      : "/org-performance",
    disclaimer:
      "Based only on Vivid data for the selected period. Recommendations do not change campaigns, pricing, or account data."
  };
}

function renderItems(items, emptyText, accent) {
  if (!items.length) {
    return `<div style="padding:14px;border-radius:10px;background:#f5f8f5;color:#315b4c;line-height:1.5;">${escapeHtml(
      emptyText
    )}</div>`;
  }

  return items
    .map(
      item => `
        <a href="${escapeHtml(item.href)}" style="display:block;text-decoration:none;color:inherit;padding:14px;border:1px solid #e4ece6;border-left:4px solid ${accent};border-radius:10px;background:#fff;">
          <div style="font-weight:800;color:#073b22;">${escapeHtml(item.title)}</div>
          <div style="margin-top:6px;color:#53675c;line-height:1.45;">${escapeHtml(item.text)}</div>
          <div style="margin-top:9px;color:#176b3a;font-size:13px;font-weight:800;">${escapeHtml(
            item.linkLabel
          )} →</div>
        </a>`
    )
    .join("");
}

function renderOrganizationIntelligence(intelligence) {
  return `
    <section class="card" style="margin:0 0 30px;border:1px solid #dce8df;background:linear-gradient(145deg,#ffffff 0%,#f4f8f5 100%);">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#176b3a;">Vivid Intelligence · Read-only preview</div>
          <h2 style="margin:7px 0 0;color:#073b22;">Ask Vivid: What needs attention?</h2>
        </div>
        <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;">
          <span style="padding:7px 10px;border-radius:999px;background:#e5f4e8;color:#176b3a;font-size:12px;font-weight:800;">Measured data only</span>
          <a href="${escapeHtml(
            intelligence.performanceHref
          )}" style="display:inline-block;padding:9px 12px;border-radius:9px;background:#176b3a;color:#fff;text-decoration:none;font-size:13px;font-weight:800;">View Full Performance Insights →</a>
        </div>
      </div>

      <div style="margin-top:18px;padding:18px;border-radius:12px;background:#073b22;color:#fff;line-height:1.55;font-size:17px;font-weight:650;">
        ${escapeHtml(intelligence.summary)}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        ${intelligence.evidence
          .map(
            item => `<span style="padding:6px 9px;border-radius:999px;background:#edf3ee;color:#315b4c;font-size:12px;font-weight:750;">${escapeHtml(
              item
            )}</span>`
          )
          .join("")}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:22px;">
        <div>
          <h3 style="margin:0 0 11px;color:#7f1d1d;">Items needing attention</h3>
          <div style="display:grid;gap:10px;">
            ${renderItems(
              intelligence.attention,
              "No immediate performance or setup issue was detected in the selected period.",
              "#b42318"
            )}
          </div>
        </div>

        <div>
          <h3 style="margin:0 0 11px;color:#176b3a;">Recommended next actions</h3>
          <div style="display:grid;gap:10px;">
            ${renderItems(
              intelligence.recommendations,
              "Continue monitoring measured performance.",
              "#176b3a"
            )}
          </div>
        </div>
      </div>

      <div style="margin-top:16px;color:#65776b;font-size:12px;line-height:1.45;">
        ${escapeHtml(intelligence.disclaimer)}
      </div>
    </section>`;
}

function buildCampaignIntelligence(campaigns = [], options = {}) {
  const organizationId = count(options.organizationId);

  return campaigns.map(campaign => {
    const scans = count(campaign.scans);
    const engagement = count(campaign.intent);
    const conversions = count(campaign.conversions);
    const revenue = number(campaign.revenue);
    const endDate = campaign.endDate ? new Date(campaign.endDate) : null;
    const daysToEnd =
      endDate && !Number.isNaN(endDate.getTime())
        ? Math.ceil((endDate.getTime() - Date.now()) / 86400000)
        : null;

    let classification = "Monitoring";
    let recommendation =
      "Continue collecting measured activity before making a material campaign change.";
    let priority = 5;

    if (conversions > 0 || revenue > 0) {
      classification =
        daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 90
          ? "Renewal Candidate"
          : "Performing Well";
      recommendation =
        classification === "Renewal Candidate"
          ? "Prepare the measured results for the advertiser and begin the renewal conversation."
          : "Preserve the working placement and offer; use these results as the benchmark for similar campaigns.";
      priority = classification === "Renewal Candidate" ? 1 : 4;
    } else if (engagement > 0) {
      classification = "Conversion Path Review";
      recommendation =
        "Interest is being measured. Review the destination, offer, and conversion confirmation path.";
      priority = 1;
    } else if (scans > 0) {
      classification = "Call-to-Action Opportunity";
      recommendation =
        "Scans are occurring without a measurable next action. Test a clearer offer and more direct call to action.";
      priority = 2;
    } else {
      classification = "Insufficient Activity";
      recommendation =
        "Confirm that the QR code is visible, working, and connected to the intended campaign before judging performance.";
      priority = 3;
    }

    const confidence =
      conversions >= 2 || scans >= 20
        ? "High"
        : scans >= 5 || engagement >= 2 || conversions === 1
          ? "Medium"
          : "Low";

    const advertiser = String(campaign.advertiser || "").trim();
    const href = advertiser
      ? `/org-advertiser/${encodeURIComponent(
          advertiser.toLowerCase()
        )}?organization_id=${organizationId}`
      : `/org-performance?organization_id=${organizationId}`;

    return {
      id: count(campaign.id),
      name: String(campaign.name || "Unnamed Campaign"),
      advertiser: advertiser || "Advertiser not set",
      scans,
      engagement,
      conversions,
      revenue,
      classification,
      recommendation,
      confidence,
      priority,
      href
    };
  }).sort(
    (a, b) =>
      a.priority - b.priority ||
      b.revenue - a.revenue ||
      b.conversions - a.conversions ||
      b.engagement - a.engagement ||
      b.scans - a.scans
  );
}

function renderCampaignIntelligence(campaigns) {
  const items = Array.isArray(campaigns) ? campaigns : [];

  return `
    <section class="card" style="margin:0 0 30px;border-top:5px solid #176b3a;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
        <div>
          <div class="label">Vivid Intelligence</div>
          <h2 style="margin:5px 0 7px;">Campaign Intelligence</h2>
          <div style="color:#65776b;">Measured campaign status, supporting evidence, and the recommended next action.</div>
        </div>
        <span style="padding:7px 10px;border-radius:999px;background:#e5f4e8;color:#176b3a;font-size:12px;font-weight:800;">Read only</span>
      </div>

      <div style="display:grid;gap:12px;margin-top:20px;">
        ${
          items.length
            ? items
                .slice(0, 8)
                .map(
                  campaign => `
                    <a href="${escapeHtml(campaign.href)}" style="display:grid;grid-template-columns:minmax(180px,1.1fr) minmax(170px,.8fr) minmax(260px,1.7fr);gap:16px;align-items:center;padding:16px;border:1px solid #dce6de;border-radius:12px;text-decoration:none;color:inherit;background:#fff;">
                      <div>
                        <div style="font-weight:850;color:#073b22;">${escapeHtml(
                          campaign.name
                        )}</div>
                        <div style="font-size:13px;color:#65776b;margin-top:4px;">${escapeHtml(
                          campaign.advertiser
                        )}</div>
                      </div>
                      <div>
                        <div style="font-weight:800;color:#176b3a;">${escapeHtml(
                          campaign.classification
                        )}</div>
                        <div style="font-size:12px;color:#65776b;margin-top:4px;">${escapeHtml(
                          campaign.confidence
                        )} confidence</div>
                      </div>
                      <div>
                        <div style="font-size:13px;color:#315b4c;line-height:1.45;">${escapeHtml(
                          campaign.recommendation
                        )}</div>
                        <div style="font-size:12px;color:#65776b;margin-top:7px;">${campaign.scans.toLocaleString()} scans · ${campaign.engagement.toLocaleString()} clicks · ${campaign.conversions.toLocaleString()} conversions · ${money(
                          campaign.revenue
                        )}</div>
                      </div>
                    </a>`
                )
                .join("")
            : `<div style="padding:18px;background:#f3f7f3;border-radius:12px;color:#315b4c;">No campaigns are available for intelligence in the selected period.</div>`
        }
      </div>
    </section>`;
}

function buildAdvertiserIntelligence(campaigns = [], options = {}) {
  const items = (Array.isArray(campaigns) ? campaigns : []).map(campaign => {
    const scans = count(campaign.scans);
    const engagement = count(campaign.intent);
    const conversions = count(campaign.conversions);
    const revenue = number(campaign.revenue);
    const investment = Math.max(0, number(campaign.allocatedCost));
    const roi = investment > 0
      ? ((revenue - investment) / investment) * 100
      : null;
    const costPerConversion =
      conversions > 0 ? investment / conversions : null;

    let status = "Building Data";
    let recommendation =
      "Continue collecting measured activity before making a material campaign change.";
    let priority = 4;

    if (conversions > 0 || revenue > 0) {
      if (roi !== null && roi < 0) {
        status = "Needs Attention";
        recommendation =
          "Conversions are being recorded, but attributed revenue has not yet covered the measured investment. Review the offer value and conversion path before expanding spend.";
        priority = 2;
      } else {
        status = "Performing Well";
        recommendation =
          "Preserve the working placement and offer. Use these measured results as the benchmark for renewal and similar campaigns.";
        priority = 3;
      }
    } else if (engagement > 0) {
      status = "Needs Attention";
      recommendation =
        "People are taking a measurable next step but are not reaching a tracked conversion. Review the destination, offer, and conversion confirmation path.";
      priority = 1;
    } else if (scans > 0) {
      status = "Needs Attention";
      recommendation =
        "Scans are occurring without measurable clicks. Test a clearer offer and a more direct call to action.";
      priority = 1;
    } else if (investment > 0) {
      status = "Needs Attention";
      recommendation =
        "Investment is active without measured response. Confirm QR visibility, routing, and placement before evaluating the campaign.";
      priority = 1;
    }

    const confidence =
      conversions >= 2 || scans >= 20
        ? "High"
        : conversions === 1 || engagement >= 2 || scans >= 5
          ? "Medium"
          : "Low";

    return {
      id: count(campaign.id),
      name: String(campaign.name || "Unnamed Campaign"),
      scans,
      engagement,
      conversions,
      revenue,
      investment,
      roi,
      costPerConversion,
      status,
      recommendation,
      confidence,
      priority,
      href: `/admin/edit-campaign/${count(campaign.id)}`
    };
  }).sort(
    (a, b) =>
      a.priority - b.priority ||
      b.revenue - a.revenue ||
      b.conversions - a.conversions ||
      b.engagement - a.engagement ||
      b.scans - a.scans
  );

  const totals = items.reduce(
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
  totals.roi =
    totals.investment > 0
      ? ((totals.revenue - totals.investment) / totals.investment) * 100
      : null;

  const strongest = [...items].sort(
    (a, b) =>
      b.revenue - a.revenue ||
      b.conversions - a.conversions ||
      (b.roi ?? -Infinity) - (a.roi ?? -Infinity) ||
      b.engagement - a.engagement
  )[0] || null;
  const conversionGap = items.find(
    campaign => campaign.engagement > 0 && campaign.conversions === 0
  ) || null;
  let summary =
    "There is not enough measured campaign activity yet to evaluate advertiser performance.";
  if (totals.conversions > 0 || totals.revenue > 0) {
    summary = `${totals.conversions.toLocaleString()} tracked ${plural(
      totals.conversions,
      "conversion"
    )} generated ${money(totals.revenue)} in attributed value from ${money(
      totals.investment
    )} in measured investment${
      totals.roi === null ? "." : `, producing ${totals.roi.toFixed(1)}% ROI.`
    }`;
  } else if (totals.engagement > 0) {
    summary = `${totals.engagement.toLocaleString()} measurable engagement ${plural(
      totals.engagement,
      "action"
    )} were recorded, but no tracked conversions have been completed.`;
  } else if (totals.scans > 0) {
    summary = `${totals.scans.toLocaleString()} ${plural(
      totals.scans,
      "scan"
    )} were recorded, but the campaigns have not yet produced measurable engagement or conversions.`;
  }

  const answers = [
    {
      question: "Which campaign is strongest?",
      answer: strongest
        ? `${strongest.name} currently leads with ${money(
            strongest.revenue
          )} in attributed value and ${strongest.conversions.toLocaleString()} tracked ${plural(
            strongest.conversions,
            "conversion"
          )}.`
        : "No campaign has enough measured activity to identify a leader yet."
    },
    {
      question: "Why are scans not converting?",
      answer: conversionGap
        ? `${conversionGap.name} recorded ${conversionGap.engagement.toLocaleString()} engagement ${plural(
            conversionGap.engagement,
            "action"
          )} without a tracked conversion. The destination, offer, and conversion confirmation path should be reviewed.`
        : "No campaign currently shows measurable engagement without a tracked conversion."
    }
  ];

  return {
    summary,
    totals,
    campaigns: items,
    answers,
    periodLabel: String(options.periodLabel || "Selected reporting period"),
    disclaimer:
      "Based only on measured Vivid data for the selected period. Recommendations are read-only and do not change campaigns, budgets, pricing, or account data."
  };
}

function renderAdvertiserIntelligence(intelligence, options = {}) {
  const totals = intelligence.totals || {};
  const viewLabel = String(options.viewLabel || "Advertiser");
  const scopeLabel = String(options.scopeLabel || "Active campaigns only");
  const campaigns = Array.isArray(intelligence.campaigns)
    ? intelligence.campaigns
    : [];
  const statusColor = status =>
    status === "Performing Well"
      ? "#176b3a"
      : status === "Needs Attention"
        ? "#b42318"
        : "#8a6400";

  return `
    <section class="card" style="margin:0 0 28px;border:1px solid #dce8df;border-top:5px solid #176b3a;background:linear-gradient(145deg,#fff 0%,#f4f8f5 100%);">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#176b3a;">Vivid Intelligence · ${escapeHtml(viewLabel)} view</div>
          <h2 style="margin:7px 0 5px;color:#073b22;">What the results mean—and what to do next</h2>
          <div style="color:#65776b;">${escapeHtml(intelligence.periodLabel)} · ${escapeHtml(scopeLabel)}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span style="padding:7px 10px;border-radius:999px;background:#e5f4e8;color:#176b3a;font-size:12px;font-weight:800;">Measured data only · Read only</span>
          <button type="button" onclick="window.print()" style="border:1px solid #176b3a;border-radius:9px;background:#fff;color:#176b3a;padding:8px 11px;font-weight:800;cursor:pointer;">Print / Save PDF</button>
        </div>
      </div>

      <div style="margin-top:18px;padding:18px;border-radius:12px;background:#073b22;color:#fff;line-height:1.55;font-size:17px;font-weight:650;">
        ${escapeHtml(intelligence.summary)}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <span style="padding:6px 9px;border-radius:999px;background:#edf3ee;color:#315b4c;font-size:12px;font-weight:750;">${count(
          totals.scans
        ).toLocaleString()} scans</span>
        <span style="padding:6px 9px;border-radius:999px;background:#edf3ee;color:#315b4c;font-size:12px;font-weight:750;">${count(
          totals.engagement
        ).toLocaleString()} clicks</span>
        <span style="padding:6px 9px;border-radius:999px;background:#edf3ee;color:#315b4c;font-size:12px;font-weight:750;">${count(
          totals.conversions
        ).toLocaleString()} conversions</span>
        <span style="padding:6px 9px;border-radius:999px;background:#edf3ee;color:#315b4c;font-size:12px;font-weight:750;">${money(
          totals.revenue
        )} attributed value</span>
        <span style="padding:6px 9px;border-radius:999px;background:#edf3ee;color:#315b4c;font-size:12px;font-weight:750;">${
          totals.roi === null || totals.roi === undefined
            ? "ROI not available"
            : `${number(totals.roi).toFixed(1)}% ROI`
        }</span>
      </div>

      <h3 style="margin:24px 0 10px;color:#073b22;">Campaign decisions</h3>
      <div style="display:grid;gap:11px;">
        ${
          campaigns.length
            ? campaigns.slice(0, 8).map(campaign => `
                <a href="${escapeHtml(campaign.href)}" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;align-items:center;padding:16px;border:1px solid #dce6de;border-radius:12px;text-decoration:none;color:inherit;background:#fff;">
                  <div>
                    <div style="font-weight:850;color:#073b22;">${escapeHtml(campaign.name)}</div>
                    <div style="font-size:12px;color:#65776b;margin-top:6px;">${campaign.scans.toLocaleString()} scans · ${campaign.engagement.toLocaleString()} clicks · ${campaign.conversions.toLocaleString()} conversions</div>
                  </div>
                  <div>
                    <div style="font-weight:850;color:${statusColor(campaign.status)};">${escapeHtml(campaign.status)}</div>
                    <div style="font-size:12px;color:#65776b;margin-top:4px;">${escapeHtml(campaign.confidence)} confidence</div>
                  </div>
                  <div>
                    <div style="font-size:13px;color:#315b4c;line-height:1.45;">${escapeHtml(campaign.recommendation)}</div>
                    <div style="font-size:12px;color:#65776b;margin-top:7px;">${money(campaign.investment)} investment · ${money(campaign.revenue)} value · ${
                      campaign.roi === null
                        ? "ROI N/A"
                        : `${campaign.roi.toFixed(1)}% ROI`
                    } · ${
                      campaign.costPerConversion === null
                        ? "Cost/conversion N/A"
                        : `${money(campaign.costPerConversion)} per conversion`
                    }</div>
                  </div>
                </a>`).join("")
            : `<div style="padding:18px;background:#f3f7f3;border-radius:12px;color:#315b4c;">No active campaigns are available for advertiser intelligence.</div>`
        }
      </div>

      <h3 style="margin:24px 0 10px;color:#073b22;">Ask Vivid</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">
        ${intelligence.answers.map(item => `
          <div style="padding:16px;border-radius:12px;background:#f3f7f3;">
            <div style="font-weight:850;color:#176b3a;">${escapeHtml(item.question)}</div>
            <div style="margin-top:8px;color:#315b4c;line-height:1.5;font-size:14px;">${escapeHtml(item.answer)}</div>
          </div>`).join("")}
      </div>

      <div style="margin-top:16px;color:#65776b;font-size:12px;line-height:1.45;">${escapeHtml(
        intelligence.disclaimer
      )}</div>
    </section>`;
}

module.exports = {
  buildOrganizationIntelligence,
  renderOrganizationIntelligence,
  buildCampaignIntelligence,
  renderCampaignIntelligence,
  buildAdvertiserIntelligence,
  renderAdvertiserIntelligence
};
