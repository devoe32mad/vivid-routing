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
          : `This location currently has the strongest engagement signal. Compare its placement, message, and offer with lower-activity locations.`,
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
      )} produced no measured intent actions. Test a clearer offer or more direct next step.`,
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

module.exports = {
  buildOrganizationIntelligence,
  renderOrganizationIntelligence
};
