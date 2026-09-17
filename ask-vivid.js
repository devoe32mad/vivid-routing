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

function safeHref(value, fallback) {
  const href = String(value || "").trim();
  return /^\/[a-z0-9/_?&=.%+-]*$/i.test(href) ? href : fallback;
}

function normalizeCampaign(campaign = {}, role) {
  const scans = count(campaign.scans);
  const engagement = count(
    campaign.engagement === undefined ? campaign.intent : campaign.engagement
  );
  const conversions = count(campaign.conversions);
  const revenue = number(campaign.revenue);
  const investment = Math.max(
    0,
    number(
      campaign.investment === undefined
        ? campaign.allocatedCost
        : campaign.investment
    )
  );
  const roi =
    campaign.roi === null || campaign.roi === undefined
      ? investment > 0
        ? ((revenue - investment) / investment) * 100
        : null
      : number(campaign.roi);
  const confidence = String(campaign.confidence || "").trim() ||
    (conversions >= 2 || scans >= 20
      ? "High"
      : conversions === 1 || engagement >= 2 || scans >= 5
        ? "Medium"
        : "Low");
  const fallbackHref = role === "enterprise"
      ? "/org-performance"
      : `/admin/edit-campaign/${count(campaign.id)}`;
  const href = safeHref(campaign.href, fallbackHref);

  return {
    id: count(campaign.id),
    name: String(campaign.name || "Unnamed Campaign"),
    advertiser: String(campaign.advertiser || ""),
    scans,
    engagement,
    conversions,
    revenue,
    investment,
    roi,
    confidence,
    classification: String(
      campaign.classification || campaign.status || "Monitoring"
    ),
    recommendation: String(campaign.recommendation || ""),
    href
  };
}

function campaignRank(a, b) {
  return (
    b.revenue - a.revenue ||
    b.conversions - a.conversions ||
    (b.roi ?? -Infinity) - (a.roi ?? -Infinity) ||
    b.engagement - a.engagement ||
    b.scans - a.scans
  );
}

function answerAskVivid(input = {}) {
  const role = input.role === "enterprise" ? "enterprise" : "advertiser";
  const question = String(input.question || "").trim().slice(0, 300);
  const normalizedQuestion = question.toLowerCase();
  const campaigns = (Array.isArray(input.campaigns) ? input.campaigns : [])
    .map(campaign => normalizeCampaign(campaign, role));
  const ranked = [...campaigns].sort(campaignRank);
  const strongest = ranked[0] || null;
  const conversionGap = campaigns
    .filter(campaign => campaign.engagement > 0 && campaign.conversions === 0)
    .sort((a, b) => b.engagement - a.engagement)[0] || null;
  const scanGap = campaigns
    .filter(
      campaign =>
        campaign.scans > 0 &&
        campaign.engagement === 0 &&
        campaign.conversions === 0
    )
    .sort((a, b) => b.scans - a.scans)[0] || null;
  const renewalCandidates = campaigns
    .filter(
      campaign =>
        (campaign.conversions > 0 || campaign.revenue > 0) &&
        (campaign.roi === null || campaign.roi >= 0)
    )
    .sort(campaignRank);
  const attention = campaigns
    .filter(
      campaign =>
        /attention|review|opportunity|insufficient/i.test(
          campaign.classification
        ) ||
        (campaign.investment > 0 && campaign.conversions === 0) ||
        (campaign.roi !== null && campaign.roi < 0)
    )
    .sort(
      (a, b) =>
        b.investment - a.investment ||
        a.conversions - b.conversions ||
        a.revenue - b.revenue
    );
  const totals = campaigns.reduce(
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
  const metrics = input.metrics || {};
  const inventory = input.inventory || {};
  const comparison = input.comparison || null;
  const organizationName =
    String(input.organizationName || "This organization").trim() ||
    "This organization";
  const links = [];
  const evidence = [];
  let intent = "summary";
  let headline = role === "enterprise"
    ? `${organizationName} performance summary`
    : "Advertiser performance summary";
  let answer = campaigns.length
    ? `${campaigns.length.toLocaleString()} active ${plural(
        campaigns.length,
        "campaign"
      )} generated ${totals.conversions.toLocaleString()} tracked ${plural(
        totals.conversions,
        "conversion"
      )} and ${money(totals.revenue)} in attributed value from ${totals.scans.toLocaleString()} ${plural(
        totals.scans,
        "scan"
      )}.`
    : "Vivid does not yet have active campaign data in this view to support a performance conclusion.";

  const asksRenewal = /renew|keep|continue|extend/.test(normalizedQuestion);
  const asksStrongest = /best|strong|top|performing|winner/.test(
    normalizedQuestion
  );
  const asksConversion = /convert|conversion|scan|engagement|click/.test(
    normalizedQuestion
  );
  const asksAttention = /attention|problem|risk|weak|fix|wrong|priority/.test(
    normalizedQuestion
  );
  const asksInventory = /inventory|unused|available|unsold|vacant|spot/.test(
    normalizedQuestion
  );
  const asksRevenue = /revenue|value|roi|return|investment|money/.test(
    normalizedQuestion
  );
  const asksDecline = /declin|drop|decreas|down|previous|compare/.test(
    normalizedQuestion
  );
  const asksNext = /next|recommend|should|action|do now/.test(
    normalizedQuestion
  );

  if (asksDecline) {
    intent = "comparison";
    if (comparison?.available) {
      headline = "Period-over-period performance change";
      answer = comparison.summary;
      evidence.push(
        `${comparison.period.days}-day equal-period comparison`,
        `${comparison.confidence} confidence`,
        `${comparison.metrics.conversions.delta >= 0 ? "+" : ""}${comparison.metrics.conversions.delta} conversions`,
        `${money(comparison.metrics.revenue.delta)} attributed-value change`
      );
      const driver = comparison.drivers?.[0];
      if (driver?.href) {
        links.push({
          label: `Open ${driver.name}`,
          href: driver.href
        });
      }
    } else {
      headline = "A comparison period is required";
      answer =
        "The current view contains one selected reporting period. Vivid will not claim that performance increased or declined without a comparable prior period. Select both a start and end date to compare equal-length periods.";
      evidence.push("No prior-period dataset is included in this answer");
    }
  } else if (role === "enterprise" && asksInventory) {
    intent = "inventory";
    const availableSpots = count(inventory.availableSpots);
    const pendingSpots = count(inventory.pendingSpots);
    const pendingRevenue = number(inventory.pendingRevenue);
    headline = "Available inventory and pending revenue";
    answer = availableSpots > 0 || pendingSpots > 0
      ? `${organizationName} has ${availableSpots.toLocaleString()} available advertising ${plural(
          availableSpots,
          "spot"
        )} and ${pendingSpots.toLocaleString()} pending ${plural(
          pendingSpots,
          "request"
        )} representing ${money(pendingRevenue)} in potential revenue. Review pending requests first, then promote the remaining available inventory.`
      : `${organizationName} has no available spots or pending advertising requests in the current scoped view.`;
    evidence.push(
      `${availableSpots.toLocaleString()} available spots`,
      `${pendingSpots.toLocaleString()} pending requests`,
      `${money(pendingRevenue)} pending value`
    );
    if (input.inventoryHref) {
      links.push({
        label: "Review advertising inventory",
        href: safeHref(input.inventoryHref, "/org-marketplace")
      });
    }
  } else if (asksRenewal) {
    intent = "renewal";
    headline = "Renewal readiness";
    if (renewalCandidates.length) {
      const candidate = renewalCandidates[0];
      answer = `${candidate.name} is the strongest measured renewal candidate because it produced ${candidate.conversions.toLocaleString()} tracked ${plural(
        candidate.conversions,
        "conversion"
      )} and ${money(candidate.revenue)} in attributed value${
        candidate.roi === null ? "." : ` with ${candidate.roi.toFixed(1)}% ROI.`
      } Present the measured evidence and confirm the advertiser's objectives before finalizing a renewal.`;
      evidence.push(
        `${candidate.conversions.toLocaleString()} conversions`,
        `${money(candidate.revenue)} attributed value`,
        `${candidate.confidence} confidence`
      );
      links.push({ label: `Open ${candidate.name}`, href: candidate.href });
    } else {
      answer =
        "No campaign currently has enough positive measured outcome data to support a renewal recommendation. Continue measuring activity and correct conversion-path gaps before making the case to renew.";
      evidence.push("0 campaigns with positive measured renewal evidence");
    }
  } else if (asksAttention || asksNext) {
    intent = "attention";
    headline = "Highest-priority next action";
    const campaign = attention[0] || conversionGap || scanGap;
    if (campaign) {
      answer = `${campaign.name} deserves attention first. ${
        campaign.recommendation ||
        (campaign.engagement > 0
          ? "Review the destination, offer, and conversion confirmation path."
          : "Confirm QR visibility and test a clearer call to action.")
      }`;
      evidence.push(
        `${campaign.scans.toLocaleString()} scans`,
        `${campaign.engagement.toLocaleString()} clicks`,
        `${campaign.conversions.toLocaleString()} conversions`,
        `${money(campaign.revenue)} attributed value`,
        `${campaign.confidence} confidence`
      );
      links.push({ label: `Open ${campaign.name}`, href: campaign.href });
    } else {
      answer = campaigns.length
        ? "No active campaign currently shows a material measured performance problem. Continue monitoring results and preserve the strongest working placement and offer."
        : "Complete the measurement foundation by activating a campaign and confirming its QR-to-conversion journey.";
    }
  } else if (asksConversion) {
    intent = "conversion";
    headline = "Scan-to-conversion path";
    const campaign = conversionGap || scanGap;
    if (campaign) {
      answer = conversionGap
        ? `${campaign.name} generated ${campaign.engagement.toLocaleString()} measurable engagement ${plural(
            campaign.engagement,
            "action"
          )} from ${campaign.scans.toLocaleString()} scans but no tracked conversions. Interest exists; review the destination, offer, and conversion confirmation path.`
        : `${campaign.name} generated ${campaign.scans.toLocaleString()} scans without a measurable next action. The first test should be a clearer offer and more direct call to action.`;
      evidence.push(
        `${campaign.scans.toLocaleString()} scans`,
        `${campaign.engagement.toLocaleString()} clicks`,
        "0 tracked conversions"
      );
      links.push({ label: `Open ${campaign.name}`, href: campaign.href });
    } else {
      answer = totals.conversions > 0
        ? `The selected campaigns produced ${totals.conversions.toLocaleString()} tracked ${plural(
            totals.conversions,
            "conversion"
          )}. No campaign currently shows a clear click-without-conversion gap.`
        : "There is not enough measured scan and click activity to diagnose the conversion path yet.";
    }
  } else if (asksStrongest) {
    intent = "strongest";
    headline = "Strongest measured campaign";
    if (strongest) {
      answer = `${strongest.name} currently leads based on business outcomes: ${strongest.conversions.toLocaleString()} tracked ${plural(
        strongest.conversions,
        "conversion"
      )}, ${money(strongest.revenue)} in attributed value, ${strongest.engagement.toLocaleString()} engagement ${plural(
        strongest.engagement,
        "action"
      )}, and ${strongest.scans.toLocaleString()} scans.`;
      evidence.push(
        `${money(strongest.revenue)} attributed value`,
        `${strongest.conversions.toLocaleString()} conversions`,
        `${strongest.confidence} confidence`
      );
      links.push({ label: `Open ${strongest.name}`, href: strongest.href });
    } else {
      answer = "No active campaign has enough measured activity to identify a leader.";
    }
  } else if (asksRevenue) {
    intent = "revenue";
    const investment = number(metrics.investment || totals.investment);
    const revenue = number(metrics.revenue || totals.revenue);
    const roi = investment > 0 ? ((revenue - investment) / investment) * 100 : null;
    headline = role === "enterprise"
      ? "Measured conversion value"
      : "Advertising return";
    answer = `${money(revenue)} in attributed conversion value was measured${
      investment > 0
        ? ` against ${money(investment)} in advertising investment, producing ${roi.toFixed(1)}% ROI.`
        : ". No measured investment is available in this view, so ROI cannot be calculated responsibly."
    }`;
    evidence.push(
      `${money(revenue)} attributed value`,
      `${money(investment)} measured investment`,
      roi === null ? "ROI not available" : `${roi.toFixed(1)}% ROI`
    );
  } else {
    if (question) {
      headline = "Current measured summary";
      answer = `I could not match that question to a supported Vivid analysis yet. Based on the current scoped data: ${answer}`;
    }
    evidence.push(
      `${campaigns.length.toLocaleString()} active campaigns`,
      `${totals.scans.toLocaleString()} scans`,
      `${totals.conversions.toLocaleString()} conversions`,
      `${money(totals.revenue)} attributed value`
    );
    if (strongest) {
      links.push({ label: `Open ${strongest.name}`, href: strongest.href });
    }
  }

  const evidenceVolume = totals.scans + totals.engagement + totals.conversions;
  const confidence =
    evidenceVolume >= 20 || totals.conversions >= 2
      ? "High"
      : evidenceVolume >= 5 || totals.conversions === 1
        ? "Medium"
        : "Low";

  return {
    role,
    question,
    intent,
    headline,
    answer,
    evidence,
    links,
    confidence,
    periodLabel: String(input.periodLabel || "Selected reporting period"),
    disclaimer:
      "Read-only answer based only on the Vivid data visible in this account and reporting period. Ask Vivid does not change campaigns, budgets, pricing, or account records."
  };
}

function renderAskVivid(assistant, options = {}) {
  const role = assistant.role === "enterprise" ? "enterprise" : "advertiser";
  const viewLabel = String(
    options.viewLabel ||
      (role === "enterprise" ? "Enterprise" : "Advertiser")
  );
  const action = String(options.action || "");
  const hiddenFields = options.hiddenFields || {};
  const presets = role === "enterprise"
    ? [
        "What needs attention first?",
        "Which campaigns should we renew?",
        "Where is unused inventory?",
        "Which campaign is strongest?",
        "Where are conversions being lost?",
        "What should we do next?"
      ]
    : [
        "What needs attention first?",
        "Which campaign is strongest?",
        "Should I renew?",
        "Why are scans not converting?",
        "What is my advertising return?",
        "What should I do next?"
      ];

  return `
    <section class="card" style="margin:0 0 28px;border:1px solid #dce8df;border-top:5px solid #176b3a;background:linear-gradient(145deg,#fff 0%,#f4f8f5 100%);">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#176b3a;">Ask Vivid · ${escapeHtml(viewLabel)}</div>
          <h2 style="margin:7px 0 5px;color:#073b22;">Ask a question about measured performance</h2>
          <div style="color:#65776b;">${escapeHtml(assistant.periodLabel)} · Permission-scoped data only</div>
        </div>
        <span style="padding:7px 10px;border-radius:999px;background:#e5f4e8;color:#176b3a;font-size:12px;font-weight:800;">Read only</span>
      </div>

      <form method="GET" action="${escapeHtml(action)}" style="margin-top:18px;">
        ${Object.entries(hiddenFields)
          .filter(([, value]) => value !== null && value !== undefined && value !== "")
          .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
          .join("")}
        <div style="display:flex;gap:9px;align-items:stretch;flex-wrap:wrap;">
          <input name="ask" maxlength="300" value="${escapeHtml(
            assistant.question
          )}" placeholder="Example: Which campaigns should we renew?" aria-label="Ask Vivid a question" style="flex:1 1 360px;margin:0;min-height:46px;">
          <button class="btn" type="submit" style="min-height:46px;">Ask Vivid</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:11px;">
          ${presets.map(question => `<button type="submit" name="ask" value="${escapeHtml(
            question
          )}" style="border:1px solid #cfe0d3;border-radius:999px;background:#fff;color:#176b3a;padding:7px 10px;font-size:12px;font-weight:800;cursor:pointer;">${escapeHtml(
            question
          )}</button>`).join("")}
        </div>
      </form>

      <div style="margin-top:18px;padding:18px;border-radius:12px;background:#073b22;color:#fff;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div style="font-size:18px;font-weight:850;">${escapeHtml(assistant.headline)}</div>
          <span style="padding:5px 8px;border-radius:999px;background:#e5f4e8;color:#176b3a;font-size:11px;font-weight:900;">${escapeHtml(
            assistant.confidence
          )} confidence</span>
        </div>
        <div style="margin-top:10px;line-height:1.55;font-size:16px;font-weight:600;">${escapeHtml(
          assistant.answer
        )}</div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        ${assistant.evidence.map(item => `<span style="padding:6px 9px;border-radius:999px;background:#edf3ee;color:#315b4c;font-size:12px;font-weight:750;">${escapeHtml(
          item
        )}</span>`).join("")}
      </div>

      ${assistant.links.length
        ? `<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px;">${assistant.links.map(link => `<a href="${escapeHtml(
            link.href
          )}" style="display:inline-block;padding:8px 11px;border-radius:9px;background:#176b3a;color:#fff;text-decoration:none;font-size:13px;font-weight:800;">${escapeHtml(
            link.label
          )} →</a>`).join("")}</div>`
        : ""}

      <div style="margin-top:16px;color:#65776b;font-size:12px;line-height:1.45;">${escapeHtml(
        assistant.disclaimer
      )}</div>
    </section>`;
}

module.exports = {
  answerAskVivid,
  renderAskVivid
};
