"use strict";

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString("en-US",{style:"currency",currency:"USD"}) : "$0.00";
}

function rate(numerator, denominator) {
  const top = Number(numerator || 0), bottom = Number(denominator || 0);
  return bottom > 0 ? (top / bottom) * 100 : 0;
}

function placementAudienceWarning(audience, placement) {
  const a = String(audience || "").toLowerCase(), p = String(placement || "").toLowerCase();
  const contexts = [
    { audience: ["car line","pickup","drop-off","drop off"], placement: ["car line","roadside","entrance","pickup","drop-off"] },
    { audience: ["game","athletic","fan","concession","football","basketball","baseball"], placement: ["stadium","gym","athletic","concession","football","basketball","baseball"] },
    { audience: ["student","campus"], placement: ["campus","hall","student","cafeteria","classroom"] }
  ];
  const expected = contexts.find(group => group.audience.some(word => a.includes(word)));
  if (!expected || expected.placement.some(word => p.includes(word))) return "";
  return `Audience and placement may not align: “${audience}” does not clearly match “${placement}.” Confirm the audience or choose a more relevant placement before approval.`;
}

function comparableSummary(item) {
  const scans = Number(item.scans || 0), clicks = Number(item.clicks || 0), conversions = Number(item.conversions || 0);
  return { id:Number(item.id || 0), qrId:Number(item.qr_id || item.qrId || 0), name:item.name || "Comparable campaign", offer:item.offer || item.name || "Offer not recorded", placement:item.placement || "", startDate:item.start_date || item.startDate || "", endDate:item.end_date || item.endDate || "", scans, clicks, conversions,
    clickRate:rate(clicks,scans), conversionRate:rate(conversions,clicks || scans), source:item.source || "account" };
}

function validateCampaignBrief(input = {}) {
  const value = {
    name: String(input.name || "").trim().slice(0,120),
    objective: ["engagement","conversion","awareness","inventory"].includes(input.objective) ? input.objective : "engagement",
    audience: String(input.audience || "").trim().slice(0,300),
    offer: String(input.offer || "").trim().slice(0,300),
    placementId: Number(input.placementId || 0),
    startDate: String(input.startDate || "").trim(),
    endDate: String(input.endDate || "").trim(),
    budget: Math.max(0,Number(input.budget || 0)),
    eventNotes: String(input.eventNotes || "").trim().slice(0,500)
  };
  const errors = [];
  if (!value.name) errors.push("Campaign name is required.");
  if (!value.audience) errors.push("Audience is required.");
  if (!value.offer) errors.push("Offer or message is required.");
  if (!Number.isInteger(value.placementId) || value.placementId <= 0) errors.push("A placement is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.startDate)) errors.push("A valid start date is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.endDate)) errors.push("A valid end date is required.");
  if (value.startDate && value.endDate && value.endDate < value.startDate) errors.push("End date must be on or after start date.");
  return { valid: errors.length === 0, errors, value };
}

function prepareCampaignPlan(brief, context = {}) {
  const objectiveActions = {
    engagement: "Use one direct action such as View Offer, Get Directions, or Learn More.",
    conversion: "Use one trackable conversion action and confirm completion through the Vivid conversion path.",
    awareness: "Lead with the clearest brand benefit, then provide one measurable next step.",
    inventory: "Highlight availability, timing, audience and measurable placement value."
  };
  const measurement = brief.objective === "conversion"
    ? ["Scans","Clicks","Conversions","Attributed value","Cost per conversion"]
    : ["Scans","Clicks","Clicks per scan","Conversions"];
  const placement = context.placementName || `Placement ${brief.placementId}`;
  const comparables = (context.comparables || []).map(comparableSummary);
  const best = comparables[0] || null;
  const current = comparableSummary({name:"Selected placement — last 90 days",...(context.metrics || {}),source:"placement"});
  const benchmark = context.benchmark ? comparableSummary({...context.benchmark,name:"Anonymous Vivid benchmark",source:"benchmark"}) : null;
  return {
    headline: brief.offer,
    callToAction: objectiveActions[brief.objective],
    audience: brief.audience,
    placement,
    schedule: `${brief.startDate} through ${brief.endDate}`,
    budget: brief.budget,
    measurement,
    rationale: best ? `Prepared from the ${brief.objective} objective and compared with successful measured campaigns. The strongest relevant example was “${best.name}”${best.placement ? ` at ${best.placement}` : ""}.` : `Prepared from the ${brief.objective} objective, selected Vivid placement and supplied audience.`,
    evidence: context.evidence || "No prior measured activity was available for this placement; start with a controlled test.",
    eventNotes: brief.eventNotes,
    warning: placementAudienceWarning(brief.audience,placement),
    currentPerformance: current,
    comparables,
    benchmark,
    targets: {
      clickRate: best ? Math.max(current.clickRate,best.clickRate) : current.clickRate,
      conversionRate: best ? Math.max(current.conversionRate,best.conversionRate) : current.conversionRate,
      guidance: best ? "Use the comparable campaign as a performance target, not a guarantee. Review results weekly and adjust message or timing when performance trails the target." : "Treat this as a controlled test. Establish a baseline before increasing budget or expanding the schedule."
    },
    scheduleRecommendation: brief.eventNotes ? `Prioritize the supplied timing constraint: ${brief.eventNotes}. Use the event calendar or recurring schedule after approval.` : "Match delivery to the placement’s highest-traffic events or recurring time windows, then review performance by event and time period."
  };
}

function renderPlanCard(plan, options = {}) {
  const data = typeof plan.plan_json === "string" ? JSON.parse(plan.plan_json) : (plan.plan_json || {});
  const action = options.action || "/admin/ai-approval-center/action";
  const scopeInput = options.organizationId ? `<input type="hidden" name="organization_id" value="${Number(options.organizationId)}">` : "";
  const comparisons = Array.isArray(data.comparables) ? data.comparables : [];
  const performance = data.currentPerformance || {}, targets = data.targets || {};
  const sourceHref = item => {
    if (!Number(item.id)) return "";
    if (options.organizationId) {
      const qr = Number(item.qrId) ? `&qr_id=${Number(item.qrId)}` : "";
      const dates = item.startDate && item.endDate ? `&start_date=${encodeURIComponent(item.startDate)}&end_date=${encodeURIComponent(item.endDate)}` : "";
      return `/org-campaign/${Number(item.id)}?organization_id=${Number(options.organizationId)}${qr}${dates}`;
    }
    return `/admin/view-campaign/${Number(item.id)}`;
  };
  return `<article style="border:1px solid #dbe4f0;border-radius:15px;padding:18px;background:#fff;box-shadow:0 5px 16px rgba(16,43,80,.06);">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div><div style="font-size:11px;font-weight:900;color:#1559c7;text-transform:uppercase;">AI-prepared campaign</div><h3 style="margin:6px 0;color:#102b50;">${escapeHtml(plan.name)}</h3></div><span style="height:max-content;border-radius:999px;background:#eaf2ff;color:#173b6b;padding:7px 10px;font-size:12px;font-weight:900;">${escapeHtml(plan.status || "pending")}</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:12px;"><div><small>Audience</small><div>${escapeHtml(data.audience)}</div></div><div><small>Placement</small><div>${escapeHtml(data.placement)}</div></div><div><small>Schedule</small><div>${escapeHtml(data.schedule)}</div></div><div><small>Budget</small><div>${money(data.budget)}</div></div></div>
    <div style="margin-top:13px;padding:13px;border-radius:10px;background:#f6f8fc;"><strong>Recommended message</strong><div style="margin-top:5px;">${escapeHtml(data.headline)}</div><div style="font-size:13px;color:#52667e;margin-top:5px;">${escapeHtml(data.callToAction)}</div></div>
    ${data.warning ? `<div style="margin-top:12px;padding:12px;border-radius:10px;background:#fff7e6;color:#7a4b00;"><strong>Review before approval:</strong> ${escapeHtml(data.warning)}</div>` : ""}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px;"><div style="padding:12px;border-radius:10px;background:#f6f8fc;"><small>Current click actions / scan</small><div style="font-weight:900;font-size:18px;">${(Number(performance.clickRate||0)/100).toFixed(2)}x</div></div><div style="padding:12px;border-radius:10px;background:#f6f8fc;"><small>Current conversion rate</small><div style="font-weight:900;font-size:18px;">${Number(performance.conversionRate||0).toFixed(1)}%</div></div><div style="padding:12px;border-radius:10px;background:#eaf2ff;"><small>Recommended actions / scan target</small><div style="font-weight:900;font-size:18px;">${(Number(targets.clickRate||0)/100).toFixed(2)}x</div></div><div style="padding:12px;border-radius:10px;background:#eaf2ff;"><small>Recommended conversion target</small><div style="font-weight:900;font-size:18px;">${Number(targets.conversionRate||0).toFixed(1)}%</div></div></div>
    <div style="margin-top:12px;"><strong>Recommended timing</strong><div style="font-size:13px;color:#52667e;margin-top:4px;">${escapeHtml(data.scheduleRecommendation||"")}</div></div>
    ${comparisons.length ? `<div style="margin-top:12px;"><strong>Successful campaigns used as evidence</strong><div style="display:grid;gap:7px;margin-top:7px;">${comparisons.slice(0,3).map(item=>{const href=sourceHref(item);return `<div style="padding:12px;border:1px solid #dbe4f0;border-radius:9px;"><strong>${escapeHtml(item.name)}</strong><div style="font-size:13px;margin-top:4px;"><strong>Offer:</strong> ${escapeHtml(item.offer||item.name||"Offer not recorded")}</div><div style="font-size:13px;"><strong>Where:</strong> ${escapeHtml(item.placement||"Placement not recorded")}</div><div style="font-size:13px;"><strong>When:</strong> ${escapeHtml(item.startDate||"Date not recorded")}${item.endDate&&item.endDate!==item.startDate?` through ${escapeHtml(item.endDate)}`:""}</div><div style="font-size:12px;color:#52667e;margin-top:4px;">${Number(item.scans||0)} scans · ${Number(item.clicks||0)} click actions · ${Number(item.conversions||0)} conversions · ${(Number(item.clickRate||0)/100).toFixed(2)} actions per scan</div>${href?`<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:8px;color:#1559c7;font-weight:900;text-decoration:none;">View source campaign →</a>`:""}</div>`;}).join("")}</div></div>` : `<div style="font-size:13px;color:#52667e;margin-top:12px;">No qualified prior campaign was available. This recommendation is marked as a controlled test.</div>`}
    ${data.benchmark ? `<div style="font-size:13px;color:#52667e;margin-top:10px;"><strong>Anonymous Vivid benchmark:</strong> ${Number(data.benchmark.clickRate||0).toFixed(1)}% clicks/scans and ${Number(data.benchmark.conversionRate||0).toFixed(1)}% conversion rate. No organization or advertiser identity is disclosed.</div>` : ""}
    <div style="font-size:13px;color:#52667e;line-height:1.5;margin-top:12px;"><strong>Why Vivid prepared this:</strong> ${escapeHtml(data.rationale)} ${escapeHtml(data.evidence)}</div>
    ${plan.status === "pending" ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:15px;"><form method="POST" action="${escapeHtml(action)}"><input type="hidden" name="plan_id" value="${Number(plan.id)}"><input type="hidden" name="decision" value="approved">${scopeInput}<button type="submit" style="border:0;border-radius:9px;background:#2563eb;color:#fff;padding:10px 13px;font-weight:900;cursor:pointer;">Approve Plan</button></form><form method="POST" action="${escapeHtml(action)}"><input type="hidden" name="plan_id" value="${Number(plan.id)}"><input type="hidden" name="decision" value="dismissed">${scopeInput}<button type="submit" style="border:1px solid #cbd7e8;border-radius:9px;background:#fff;color:#173b6b;padding:9px 13px;font-weight:900;cursor:pointer;">Dismiss</button></form></div>` : ""}
  </article>`;
}

function renderOperatorPage({ role, organizationId, placements = [], plans = [], error = "" }) {
  const enterprise = role === "enterprise";
  const base = enterprise ? "/org-ai-campaign-operator" : "/admin/ai-campaign-operator";
  const query = enterprise ? `?organization_id=${Number(organizationId)}` : "";
  const approvalHref = enterprise ? `/org-ai-approval-center${query}` : "/admin/ai-approval-center";
  return `<main style="max-width:1180px;margin:0 auto;padding:26px 22px 50px;"><section style="background:linear-gradient(135deg,#0b1f3a,#2563eb);color:#fff;border-radius:18px;padding:24px;"><div style="font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#dbeafe;">Vivid AI Campaign Operator</div><h1 style="margin:7px 0;">Prepare a campaign for approval</h1><p style="color:#dbeafe;margin:0;max-width:760px;">Provide the business objective and constraints. Vivid prepares an explainable campaign plan using the selected placement. Nothing runs until an authorized user approves it.</p><a href="${approvalHref}" style="display:inline-block;margin-top:16px;background:#fff;color:#173b6b!important;padding:10px 14px;border-radius:9px;text-decoration:none;font-weight:900;">Open Approval Center</a></section>
  ${error ? `<div style="margin-top:16px;padding:13px;border-radius:10px;background:#fff0f0;color:#9b1c1c;">${escapeHtml(error)}</div>` : ""}
  <section style="margin-top:20px;border:1px solid #dbe4f0;border-radius:16px;padding:20px;background:#fff;"><h2 style="margin-top:0;color:#102b50;">Campaign brief</h2><form method="POST" action="${base}${query}"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;"><div><label>Campaign name</label><input name="name" required placeholder="Friday Night Family Offer"></div><div><label>Objective</label><select name="objective"><option value="engagement">Increase clicks and engagement</option><option value="conversion">Generate conversions</option><option value="awareness">Build awareness</option><option value="inventory">Promote available inventory</option></select></div><div><label>Audience</label><input name="audience" required placeholder="Families attending home football games"></div><div><label>Offer or message</label><input name="offer" required placeholder="Show this page for a family-night offer"></div><div><label>Placement</label><select name="placement_id" required><option value="">Choose placement</option>${placements.map(item=>`<option value="${Number(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</select></div><div><label>Budget</label><input name="budget" type="number" min="0" step="0.01" value="0"></div><div><label>Start date</label><input name="start_date" type="date" required></div><div><label>End date</label><input name="end_date" type="date" required></div><div style="grid-column:1/-1;"><label>Events, timing or instructions</label><input name="event_notes" placeholder="Home games, Friday evenings, or other constraints"></div></div><button type="submit" style="margin-top:16px;border:0;border-radius:10px;background:#2563eb;color:#fff;padding:12px 16px;font-weight:900;cursor:pointer;">Prepare Campaign Plan</button></form></section>
  ${plans.length ? `<section style="margin-top:22px;"><h2 style="color:#102b50;">Recently prepared</h2><div style="display:grid;gap:13px;">${plans.map(plan=>renderPlanCard(plan,{action:enterprise?"/org-ai-approval-center/action":"/admin/ai-approval-center/action",organizationId})).join("")}</div></section>` : ""}</main>`;
}

module.exports = { prepareCampaignPlan, renderOperatorPage, renderPlanCard, validateCampaignBrief };
