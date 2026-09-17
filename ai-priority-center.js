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

function campaignPriority(campaign, role) {
  const scans = count(campaign.scans);
  const clicks = count(
    campaign.engagement === undefined ? campaign.intent : campaign.engagement
  );
  const conversions = count(campaign.conversions);
  const revenue = Math.max(0, number(campaign.revenue));
  const investment = Math.max(0, number(campaign.investment ?? campaign.allocatedCost));
  const href = String(campaign.href || (role === "enterprise" ? "/org-performance" : `/admin/edit-campaign/${count(campaign.id)}`));
  const confidence = String(campaign.confidence || (conversions >= 2 || scans >= 20 ? "High" : scans >= 5 || clicks >= 2 || conversions === 1 ? "Medium" : "Low"));

  if (clicks > 0 && conversions === 0) {
    return {
      rank: 1,
      title: `Fix the conversion path for ${campaign.name || "this campaign"}`,
      reason: "People are taking a measurable next step, but no tracked conversion is being completed.",
      action: "Review destination and conversion path",
      evidence: `${scans} scans · ${clicks} clicks · 0 conversions`,
      confidence,
      impact: investment > 0 ? `${money(investment)} in measured investment needs attention` : "Conversion opportunity",
      href
    };
  }
  if (scans > 0 && clicks === 0) {
    return {
      rank: 2,
      title: `Improve the call to action for ${campaign.name || "this campaign"}`,
      reason: "Scans are occurring without a measurable click. Test a clearer offer and more direct next step.",
      action: "Open campaign",
      evidence: `${scans} scans · 0 clicks · 0 conversions`,
      confidence,
      impact: "Click opportunity",
      href
    };
  }
  if (conversions > 0 || revenue > 0) {
    return {
      rank: 4,
      title: `Replicate what is working in ${campaign.name || "this campaign"}`,
      reason: "This campaign has produced measurable business outcomes. Preserve the working placement and offer.",
      action: "Review winning campaign",
      evidence: `${scans} scans · ${clicks} clicks · ${conversions} conversions`,
      confidence,
      impact: `${money(revenue)} attributed value`,
      href
    };
  }
  return null;
}

function buildPriorityCenter(input = {}) {
  const role = input.role === "enterprise" ? "enterprise" : "advertiser";
  const priorities = [];

  if (role === "enterprise") {
    for (const item of input.renewals || []) {
      const recommendation = item.recommendation || {};
      priorities.push({
        rank: 0,
        title: `Review renewal pricing for ${item.name || "an expiring placement"}`,
        reason: recommendation.reason || "A renewal decision is approaching and measured performance is available for review.",
        action: "Open renewal recommendation",
        evidence: `${count(item.scans)} scans · ${count(item.clicks)} clicks · ${count(item.conversions)} conversions`,
        confidence: recommendation.confidence || "Low",
        impact: recommendation.recommendation == null ? "Manual price review" : `${money(recommendation.recommendation)} recommended price`,
        href: item.href || "/org-renewals"
      });
    }
  }

  for (const campaign of input.campaigns || []) {
    const priority = campaignPriority(campaign, role);
    if (priority) priorities.push(priority);
  }

  if (role === "enterprise" && count(input.availableSpots) > 0) {
    priorities.push({
      rank: 3,
      title: `Promote ${count(input.availableSpots)} available advertising ${count(input.availableSpots) === 1 ? "spot" : "spots"}`,
      reason: "Available inventory represents a direct revenue-growth opportunity.",
      action: "Open advertising inventory",
      evidence: `${count(input.pendingSpots)} pending requests · ${money(input.pendingRevenue)} pending value`,
      confidence: "High",
      impact: "Revenue opportunity",
      href: input.inventoryHref || "/org-marketplace"
    });
  }

  return {
    role,
    priorities: priorities.sort((a, b) => a.rank - b.rank).slice(0, 3)
  };
}

function renderPriorityCenter(center = {}) {
  const items = Array.isArray(center.priorities) ? center.priorities : [];
  const roleLabel = center.role === "enterprise" ? "Enterprise" : "Advertiser";
  return `
    <section class="card" style="margin:0 0 28px;border:1px solid #cfdced;border-top:6px solid #173b6b;background:linear-gradient(145deg,#fff 0%,#f3f7fc 100%);">
      <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#173b6b;">Vivid AI Priority Center · ${roleLabel}</div>
          <h2 style="margin:7px 0 5px;color:#102b50;">What deserves attention now</h2>
          <div style="color:#65776b;">Up to three recommended actions, prioritized from measured Vivid data.</div>
        </div>
        <span style="padding:7px 10px;border-radius:999px;background:#e8eef7;color:#173b6b;font-size:12px;font-weight:800;">Read only · You remain in control</span>
      </div>
      <div style="display:grid;gap:11px;margin-top:18px;">
        ${items.length ? items.map((item, index) => `
          <a href="${escapeHtml(item.href)}" style="display:grid;grid-template-columns:auto minmax(220px,1.25fr) minmax(190px,.9fr) minmax(160px,.7fr);gap:14px;align-items:center;padding:16px;border:1px solid #dce4ee;border-radius:12px;background:#fff;text-decoration:none;color:inherit;">
            <div style="width:34px;height:34px;border-radius:50%;background:#173b6b;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;">${index + 1}</div>
            <div><div style="font-weight:850;color:#102b50;">${escapeHtml(item.title)}</div><div style="font-size:13px;color:#53675c;line-height:1.45;margin-top:5px;">${escapeHtml(item.reason)}</div></div>
            <div><div style="font-size:12px;color:#65776b;">${escapeHtml(item.evidence)}</div><div style="font-size:12px;color:#173b6b;font-weight:800;margin-top:6px;">${escapeHtml(item.confidence)} confidence</div></div>
            <div><div style="font-weight:850;color:#176b3a;">${escapeHtml(item.impact)}</div><div style="font-size:12px;color:#173b6b;font-weight:800;margin-top:7px;">${escapeHtml(item.action)} →</div></div>
          </a>`).join("") : `<div style="padding:18px;border-radius:12px;background:#fff;color:#53675c;">No urgent action is supported by the measured data yet. Continue collecting scans, clicks, and conversions.</div>`}
      </div>
      <div style="font-size:12px;color:#65776b;margin-top:14px;">Recommendations are evidence-based and do not change campaigns, pricing, contracts, or inventory automatically.</div>
    </section>`;
}

module.exports = { buildPriorityCenter, renderPriorityCenter };
