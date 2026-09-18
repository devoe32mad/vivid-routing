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

function safeHref(value, fallback = "#") {
  const href = String(value || "").trim();
  return /^\/(?!\/)[^\s]*$/.test(href) || /^https:\/\/[^\s]+$/i.test(href)
    ? href
    : fallback;
}

function formatDateTime(value, timezone = "America/New_York") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not set";
  try {
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone
    });
  } catch (_) {
    return date.toLocaleString("en-US");
  }
}

function comparisonLabel(current, previous) {
  const now = number(current);
  const before = number(previous);
  if (now === before) return "No change";
  if (before === 0) return now > 0 ? "New activity" : "No change";
  const pct = ((now - before) / Math.abs(before)) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs. prior week`;
}

function metricCard(label, value, comparison, href) {
  return `<a href="${escapeHtml(safeHref(href))}" style="display:block;text-decoration:none;color:inherit;border:1px solid #dbe4f0;border-radius:14px;padding:16px;background:#fff;box-shadow:0 4px 14px rgba(16,43,80,.06);">
    <div style="font-size:12px;color:#657184;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(label)}</div>
    <div style="font-size:27px;color:#102b50;font-weight:900;margin-top:7px;">${escapeHtml(value)}</div>
    <div style="font-size:12px;color:#52667e;margin-top:6px;">${escapeHtml(comparison)}</div>
  </a>`;
}

function renderEvent(event, fallbackHref) {
  const href = safeHref(event.href, fallbackHref);
  return `<a href="${escapeHtml(href)}" style="display:block;text-decoration:none;color:inherit;padding:14px 0;border-bottom:1px solid #edf1f6;">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
      <div><strong style="color:#102b50;">${escapeHtml(event.name || "Scheduled event")}</strong><div style="font-size:13px;color:#52667e;margin-top:4px;">${escapeHtml(event.campaign || "Campaign")} · ${escapeHtml(event.placement || "Placement")}</div></div>
      <span style="font-size:11px;font-weight:900;color:#1559c7;background:#eaf2ff;border-radius:999px;padding:6px 8px;white-space:nowrap;">${escapeHtml(event.type || "Event")}</span>
    </div>
    <div style="font-size:13px;color:#173b6b;font-weight:800;margin-top:8px;">${escapeHtml(formatDateTime(event.startsAt, event.timezone))} →</div>
  </a>`;
}

function renderPriority(priority, index) {
  return `<a href="${escapeHtml(safeHref(priority.href))}" style="display:block;text-decoration:none;color:inherit;border:1px solid #dbe4f0;border-radius:13px;padding:15px;background:#fff;">
    <div style="display:flex;gap:11px;align-items:flex-start;"><div style="width:30px;height:30px;flex:0 0 30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#173b6b;color:#fff;font-weight:900;">${index + 1}</div><div><strong style="color:#102b50;">${escapeHtml(priority.title)}</strong><div style="font-size:13px;line-height:1.45;color:#52667e;margin-top:5px;">${escapeHtml(priority.reason)}</div></div></div>
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid #edf1f6;"><span style="font-size:12px;color:#52667e;">${escapeHtml(priority.evidence)}</span><span style="font-size:12px;font-weight:900;color:#1559c7;">${escapeHtml(priority.action || "Review")} →</span></div>
  </a>`;
}

function renderExternalSignal(item) {
  const href = safeHref(item.url, "#");
  return `<a href="${escapeHtml(href)}" ${href.startsWith("https://") ? 'target="_blank" rel="noopener noreferrer"' : ""} style="display:block;text-decoration:none;color:inherit;padding:13px 0;border-bottom:1px solid #edf1f6;">
    <div style="font-size:11px;color:#657184;font-weight:900;text-transform:uppercase;letter-spacing:.04em;">Outside Vivid · ${escapeHtml(item.source || "Verified source")}</div>
    <strong style="display:block;color:#102b50;margin-top:5px;">${escapeHtml(item.title || "Relevant guidance")}</strong>
    <div style="font-size:13px;color:#52667e;line-height:1.45;margin-top:5px;">${escapeHtml(item.summary || "")}</div>
  </a>`;
}

function renderWeeklyAiReport(report = {}) {
  const role = report.role === "enterprise" ? "Enterprise" : "Advertiser";
  const baseHref = report.role === "enterprise"
    ? `/org-performance?organization_id=${count(report.organizationId)}`
    : "/admin/ai-insights";
  const calendarHref = report.role === "enterprise" ? baseHref : "/admin/event-calendar";
  const operatorLabel = "Prepare Campaign Plan";
  const operatorHref = report.role === "enterprise"
    ? `/org-ai-campaign-operator?organization_id=${count(report.organizationId)}`
    : "/admin/ai-campaign-operator";
  const metrics = report.metrics || {};
  const previous = report.previousMetrics || {};
  const priorities = Array.isArray(report.priorities) ? report.priorities : [];
  const events = Array.isArray(report.events) ? report.events : [];
  const externalSignals = Array.isArray(report.externalSignals) ? report.externalSignals : [];
  const rangeLabel = report.rangeLabel || "This week";

  return `<main style="max-width:1250px;margin:0 auto;padding:26px 22px 50px;">
    <section style="padding:24px;border-radius:18px;background:linear-gradient(135deg,#0b1f3a,#2563eb);color:#fff;box-shadow:0 12px 30px rgba(16,43,80,.18);">
      <div style="font-size:12px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:#dbeafe;">Vivid AI Weekly Report · ${role}</div>
      <h1 style="margin:8px 0 6px;font-size:32px;">${escapeHtml(report.accountName || "Your advertising performance")}</h1>
      <div style="color:#dbeafe;">${escapeHtml(rangeLabel)} · Measured results, upcoming events and recommended actions</div>
      <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:17px;"><a href="${escapeHtml(baseHref)}" style="background:#fff;color:#173b6b!important;padding:10px 13px;border-radius:9px;text-decoration:none;font-weight:900;">Open Performance Insights</a><a href="${escapeHtml(calendarHref)}" style="background:#173b6b;color:#fff!important;padding:10px 13px;border:1px solid #7aa2df;border-radius:9px;text-decoration:none;font-weight:900;">Open Campaign Scheduling</a></div>
    </section>

    <section style="margin-top:22px;"><div style="display:flex;justify-content:space-between;gap:12px;align-items:end;flex-wrap:wrap;"><div><div style="font-size:12px;font-weight:900;color:#1559c7;text-transform:uppercase;">Inside Vivid · Measured</div><h2 style="margin:5px 0;color:#102b50;">This week at a glance</h2></div><span style="font-size:12px;color:#657184;">Every card opens its source</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:12px;margin-top:14px;">
        ${metricCard("Scans", count(metrics.scans), comparisonLabel(metrics.scans, previous.scans), baseHref)}
        ${metricCard("Clicks", count(metrics.clicks), comparisonLabel(metrics.clicks, previous.clicks), baseHref)}
        ${metricCard("Conversions", count(metrics.conversions), comparisonLabel(metrics.conversions, previous.conversions), baseHref)}
        ${metricCard("Attributed value", money(metrics.revenue), comparisonLabel(metrics.revenue, previous.revenue), baseHref)}
      </div>
    </section>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;margin-top:22px;align-items:start;">
      <section style="border-radius:16px;background:#f5f8fc;border:1px solid #dbe4f0;padding:18px;">
        <div style="font-size:12px;font-weight:900;color:#1559c7;text-transform:uppercase;">Vivid AI · Recommended</div><h2 style="margin:6px 0 14px;color:#102b50;">What to do next</h2>
        <div style="display:grid;gap:10px;">${priorities.length ? priorities.map(renderPriority).join("") : '<div style="color:#52667e;padding:12px 0;">No urgent recommendation is supported by the measured data yet.</div>'}</div>
      </section>
      <section style="border-radius:16px;background:#fff;border:1px solid #dbe4f0;padding:18px;">
        <div style="font-size:12px;font-weight:900;color:#1559c7;text-transform:uppercase;">Campaign calendar</div><h2 style="margin:6px 0 5px;color:#102b50;">Upcoming events</h2><div style="font-size:13px;color:#657184;margin-bottom:8px;">Next 14 days</div>
        ${events.length ? events.map(event => renderEvent(event, calendarHref)).join("") : `<div style="color:#52667e;padding:14px 0;">No dated campaign events are scheduled in the next 14 days.</div>`}
        <a href="${escapeHtml(calendarHref)}" style="display:inline-block;margin-top:13px;color:#1559c7;font-weight:900;">Review campaign schedule →</a>
      </section>
    </div>

    <section style="margin-top:22px;border-radius:16px;background:#fff;border:1px solid #dbe4f0;padding:18px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div><div style="font-size:12px;font-weight:900;color:#7c3aed;text-transform:uppercase;">External intelligence</div><h2 style="margin:6px 0;color:#102b50;">Relevant information beyond Vivid</h2></div><span style="font-size:12px;color:#657184;">Clearly labeled · Source-linked</span></div>
      ${externalSignals.length ? externalSignals.map(renderExternalSignal).join("") : '<div style="color:#52667e;padding:12px 0;">No verified outside guidance is relevant to this account this week. Vivid will not fill this section with generic content.</div>'}
    </section>

    <section style="margin-top:22px;border-radius:16px;background:#eef4ff;border:1px solid #c8d9f3;padding:18px;display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;">
      <div><div style="font-size:12px;font-weight:900;color:#1559c7;text-transform:uppercase;">Vivid AI Campaign Operator</div><h2 style="margin:6px 0;color:#102b50;">Prepare campaigns and schedules for approval</h2><div style="font-size:13px;color:#52667e;max-width:720px;line-height:1.5;">Vivid can use measured performance, upcoming events and available placements to prepare a campaign plan. Nothing is published or changed until an authorized user approves it.</div></div>
      <a href="${escapeHtml(operatorHref)}" style="background:#2563eb;color:#fff!important;border-radius:10px;padding:12px 15px;text-decoration:none;font-weight:900;">${operatorLabel}</a>
    </section>
  </main>`;
}

function renderWeeklyAiPreferences(preferences = {}, options = {}) {
  const action = safeHref(options.action, "/weekly-ai-report/preferences");
  const testAction = safeHref(options.testAction, "#");
  return `<section style="max-width:760px;margin:22px auto;padding:20px;border:1px solid #dbe4f0;border-radius:16px;background:#fff;">
    <div style="font-size:12px;font-weight:900;color:#1559c7;text-transform:uppercase;">Weekly delivery</div><h2 style="margin:6px 0;color:#102b50;">Email my interactive Vivid AI report</h2><p style="color:#52667e;line-height:1.5;">The email contains a secure link. The report itself stays interactive so every event, recommendation and metric can open the relevant Vivid workflow.</p>
    <form method="POST" action="${escapeHtml(action)}">
      <label style="display:flex;gap:9px;align-items:center;font-weight:800;"><input type="checkbox" name="enabled" value="1" ${preferences.enabled ? "checked" : ""} style="width:auto;margin:0;"> Send my weekly report</label>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:16px;">
        <div><label style="font-size:13px;font-weight:800;">Delivery day</label><select name="delivery_day"><option value="1" ${number(preferences.deliveryDay) === 1 ? "selected" : ""}>Monday</option><option value="2" ${number(preferences.deliveryDay) === 2 ? "selected" : ""}>Tuesday</option><option value="3" ${number(preferences.deliveryDay) === 3 ? "selected" : ""}>Wednesday</option><option value="4" ${number(preferences.deliveryDay) === 4 ? "selected" : ""}>Thursday</option><option value="5" ${number(preferences.deliveryDay) === 5 ? "selected" : ""}>Friday</option></select></div>
        <div><label style="font-size:13px;font-weight:800;">Delivery time</label><select name="delivery_hour">${[6,7,8,9,10,11,12,13,14,15,16,17].map(hour => `<option value="${hour}" ${number(preferences.deliveryHour) === hour ? "selected" : ""}>${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? "PM" : "AM"}</option>`).join("")}</select></div>
        <div><label style="font-size:13px;font-weight:800;">Timezone</label><select name="timezone"><option value="America/New_York" ${preferences.timezone !== "America/Chicago" && preferences.timezone !== "America/Denver" && preferences.timezone !== "America/Los_Angeles" ? "selected" : ""}>Eastern</option><option value="America/Chicago" ${preferences.timezone === "America/Chicago" ? "selected" : ""}>Central</option><option value="America/Denver" ${preferences.timezone === "America/Denver" ? "selected" : ""}>Mountain</option><option value="America/Los_Angeles" ${preferences.timezone === "America/Los_Angeles" ? "selected" : ""}>Pacific</option></select></div>
      </div>
      <label style="display:flex;gap:9px;align-items:center;font-weight:800;margin-top:12px;"><input type="checkbox" name="include_external" value="1" ${preferences.includeExternal !== false ? "checked" : ""} style="width:auto;margin:0;"> Include verified external intelligence when relevant</label>
      <button type="submit" style="margin-top:17px;background:#2563eb;color:#fff;border:0;border-radius:10px;padding:12px 16px;font-weight:900;cursor:pointer;">Save weekly report settings</button>
    </form>
    ${testAction !== "#" ? `<form method="POST" action="${escapeHtml(testAction)}" style="margin-top:10px;"><button type="submit" style="background:#fff;color:#173b6b;border:1px solid #b8cae6;border-radius:10px;padding:11px 15px;font-weight:900;cursor:pointer;">Send Test Report to Me</button></form>` : ""}
  </section>`;
}

module.exports = {
  comparisonLabel,
  renderWeeklyAiPreferences,
  renderWeeklyAiReport,
  safeHref
};
