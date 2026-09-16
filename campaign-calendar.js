"use strict";

const EVENT_TYPES = Object.freeze([
  "Football",
  "Basketball",
  "Baseball",
  "Volleyball",
  "Wrestling",
  "School Event",
  "Trade Show",
  "Community Event",
  "Other"
]);
const EVENT_TIMEZONES = Object.freeze([
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix"
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateEventSchedule(input = {}) {
  const eventName = String(input.eventName || "").trim();
  const eventType = EVENT_TYPES.includes(input.eventType)
    ? input.eventType
    : "Other";
  const start = validDate(input.startAt);
  const end = validDate(input.endAt);
  const qrId = Number(input.qrId);
  const campaignId = Number(input.campaignId);
  const timezone = EVENT_TIMEZONES.includes(input.timezone)
    ? input.timezone
    : "America/New_York";
  const errors = [];

  if (!eventName) errors.push("Event name is required.");
  if (!Number.isInteger(qrId) || qrId <= 0) errors.push("A valid QR placement is required.");
  if (!Number.isInteger(campaignId) || campaignId <= 0) errors.push("A valid campaign is required.");
  if (!start) errors.push("A valid event start is required.");
  if (!end) errors.push("A valid event end is required.");
  if (start && end && end <= start) errors.push("Event end must be after event start.");

  return {
    valid: errors.length === 0,
    errors,
    value: {
      eventName,
      eventType,
      startAt: start ? String(input.startAt) : null,
      endAt: end ? String(input.endAt) : null,
      timezone,
      qrId,
      campaignId,
      notes: String(input.notes || "").trim()
    }
  };
}

function eventStatus(event, now = new Date()) {
  const start = validDate(event.event_start_at);
  const end = validDate(event.event_end_at);
  if (!start || !end) return "Unscheduled";
  if (now < start) return "Upcoming";
  if (now > end) return "Completed";
  return "Live now";
}

function renderCampaignCalendar(events = [], options = {}) {
  const action = options.action || "/admin/schedule";
  if (!events.length) {
    return `<section class="card" style="margin-top:24px;"><h2>Event Calendar</h2><p>No event-based campaigns are scheduled yet. Add football games, basketball games, school events, trade shows, or other dated events above.</p></section>`;
  }

  const grouped = new Map();
  for (const event of events) {
    const start = validDate(event.event_start_at);
    if (!start) continue;
    const key = start.toISOString().slice(0, 7);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(event);
  }

  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, monthEvents]) => {
    const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    });
    const cards = monthEvents.sort((a, b) => new Date(a.event_start_at) - new Date(b.event_start_at)).map(event => {
      const start = new Date(event.event_start_at);
      const end = new Date(event.event_end_at);
      const status = eventStatus(event);
      const timezone = EVENT_TIMEZONES.includes(event.event_timezone)
        ? event.event_timezone
        : "America/New_York";
      return `<article style="border:1px solid #dbe3ef;border-left:5px solid ${status === "Live now" ? "#16803b" : "#173b6b"};border-radius:12px;padding:14px;background:#fff;">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div><strong>${escapeHtml(event.event_name || "Scheduled event")}</strong><div style="color:#657184;margin-top:4px;">${escapeHtml(event.event_type || "Event")} · ${escapeHtml(event.qr_name || "Placement")}</div></div>
          <span style="font-size:12px;font-weight:800;color:#173b6b;">${escapeHtml(status)}</span>
        </div>
        <div style="margin-top:9px;">${escapeHtml(start.toLocaleString("en-US", {dateStyle:"medium",timeStyle:"short",timeZone:timezone}))} – ${escapeHtml(end.toLocaleTimeString("en-US", {hour:"numeric",minute:"2-digit",timeZone:timezone}))} ${escapeHtml(timezone.replace("America/", ""))}</div>
        <div style="margin-top:5px;color:#46556b;">Campaign: ${escapeHtml(event.campaign_name || "Unnamed campaign")}${event.advertiser ? ` · ${escapeHtml(event.advertiser)}` : ""}</div>
        ${event.notes ? `<div style="margin-top:7px;color:#657184;">${escapeHtml(event.notes)}</div>` : ""}
      </article>`;
    }).join("");
    return `<section class="card" style="margin-top:24px;"><h2 style="margin-top:0;">${escapeHtml(label)}</h2><div style="display:grid;gap:10px;">${cards}</div><div style="margin-top:12px;"><a href="${escapeHtml(action)}">Add another event</a></div></section>`;
  }).join("");
}

module.exports = {
  EVENT_TYPES,
  EVENT_TIMEZONES,
  validateEventSchedule,
  eventStatus,
  renderCampaignCalendar
};
