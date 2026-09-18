"use strict";

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString("en-US",{style:"currency",currency:"USD"}) : "$0.00";
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
  return {
    headline: brief.offer,
    callToAction: objectiveActions[brief.objective],
    audience: brief.audience,
    placement: context.placementName || `Placement ${brief.placementId}`,
    schedule: `${brief.startDate} through ${brief.endDate}`,
    budget: brief.budget,
    measurement,
    rationale: `Prepared from the ${brief.objective} objective, selected Vivid placement and supplied audience.`,
    evidence: context.evidence || "No prior measured activity was available for this placement; start with a controlled test.",
    eventNotes: brief.eventNotes
  };
}

function renderPlanCard(plan, options = {}) {
  const data = typeof plan.plan_json === "string" ? JSON.parse(plan.plan_json) : (plan.plan_json || {});
  const action = options.action || "/admin/ai-approval-center/action";
  const scopeInput = options.organizationId ? `<input type="hidden" name="organization_id" value="${Number(options.organizationId)}">` : "";
  return `<article style="border:1px solid #dbe4f0;border-radius:15px;padding:18px;background:#fff;box-shadow:0 5px 16px rgba(16,43,80,.06);">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div><div style="font-size:11px;font-weight:900;color:#1559c7;text-transform:uppercase;">AI-prepared campaign</div><h3 style="margin:6px 0;color:#102b50;">${escapeHtml(plan.name)}</h3></div><span style="height:max-content;border-radius:999px;background:#eaf2ff;color:#173b6b;padding:7px 10px;font-size:12px;font-weight:900;">${escapeHtml(plan.status || "pending")}</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:12px;"><div><small>Audience</small><div>${escapeHtml(data.audience)}</div></div><div><small>Placement</small><div>${escapeHtml(data.placement)}</div></div><div><small>Schedule</small><div>${escapeHtml(data.schedule)}</div></div><div><small>Budget</small><div>${money(data.budget)}</div></div></div>
    <div style="margin-top:13px;padding:13px;border-radius:10px;background:#f6f8fc;"><strong>Recommended message</strong><div style="margin-top:5px;">${escapeHtml(data.headline)}</div><div style="font-size:13px;color:#52667e;margin-top:5px;">${escapeHtml(data.callToAction)}</div></div>
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
