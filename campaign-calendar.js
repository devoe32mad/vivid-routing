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
    const [year, monthNumber] = month.split("-").map(Number);
    const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const eventsByDay = new Map();
    monthEvents.sort((a, b) => new Date(a.event_start_at) - new Date(b.event_start_at)).forEach(event => {
      const timezone = EVENT_TIMEZONES.includes(event.event_timezone) ? event.event_timezone : "America/New_York";
      const day = Number(new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: timezone }).format(new Date(event.event_start_at)));
      if (!eventsByDay.has(day)) eventsByDay.set(day, []);
      eventsByDay.get(day).push(event);
    });
    const cells = [];
    for (let blank = 0; blank < firstWeekday; blank += 1) cells.push('<div style="min-height:108px;background:#f7f9fc;border:1px solid #e3e8f0;"></div>');
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayEvents = (eventsByDay.get(day) || []).map(event => {
        const start = new Date(event.event_start_at);
        const status = eventStatus(event);
        const timezone = EVENT_TIMEZONES.includes(event.event_timezone) ? event.event_timezone : "America/New_York";
        const detail = `${event.event_type || "Event"} · ${event.qr_name || "Placement"} · ${event.campaign_name || "Campaign"}`;
        return `<div title="${escapeHtml(detail)}" style="margin-top:5px;padding:6px;border-radius:7px;background:${status === "Live now" ? "#dcfce7" : "#e8f0ff"};border-left:3px solid ${status === "Live now" ? "#16803b" : "#2459a9"};font-size:12px;line-height:1.3;"><strong>${escapeHtml(start.toLocaleTimeString("en-US", {hour:"numeric",minute:"2-digit",timeZone:timezone}))}</strong> ${escapeHtml(event.event_name || "Scheduled event")}</div>`;
      }).join("");
      cells.push(`<div style="min-height:108px;padding:8px;background:#fff;border:1px solid #e3e8f0;"><strong style="color:#173b6b;">${day}</strong>${dayEvents}</div>`);
    }
    const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => `<div style="padding:7px;">${day}</div>`).join("");
    return `<section class="card" style="margin-top:24px;"><h2 style="margin-top:0;">${escapeHtml(label)}</h2><div style="overflow-x:auto;"><div style="min-width:760px;"><div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:13px;font-weight:800;color:#657184;">${weekdays}</div><div style="display:grid;grid-template-columns:repeat(7,1fr);">${cells.join("")}</div></div></div><div style="margin-top:12px;"><a href="${escapeHtml(action)}">Add another event</a></div></section>`;
  }).join("");
}

module.exports = {
  EVENT_TYPES,
  EVENT_TIMEZONES,
  validateEventSchedule,
  eventStatus,
  renderCampaignCalendar
};
