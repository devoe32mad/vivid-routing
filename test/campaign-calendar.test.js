"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateEventSchedule,
  eventStatus,
  renderCampaignCalendar
} = require("../campaign-calendar");

test("validates a complete dated event schedule", () => {
  const result = validateEventSchedule({
    eventName: "Home football game",
    eventType: "Football",
    startAt: "2026-09-18T18:00:00-04:00",
    endAt: "2026-09-18T22:00:00-04:00",
    qrId: 4,
    campaignId: 9
  });
  assert.equal(result.valid, true);
  assert.equal(result.value.eventType, "Football");
});

test("rejects missing names and invalid time windows", () => {
  const result = validateEventSchedule({
    startAt: "2026-09-18T22:00:00Z",
    endAt: "2026-09-18T18:00:00Z",
    qrId: 4,
    campaignId: 9
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Event name|after event start/);
});

test("reports upcoming, live, and completed states", () => {
  const now = new Date("2026-09-18T20:00:00Z");
  assert.equal(eventStatus({event_start_at:"2026-09-18T21:00:00Z",event_end_at:"2026-09-18T22:00:00Z"}, now), "Upcoming");
  assert.equal(eventStatus({event_start_at:"2026-09-18T19:00:00Z",event_end_at:"2026-09-18T21:00:00Z"}, now), "Live now");
  assert.equal(eventStatus({event_start_at:"2026-09-18T18:00:00Z",event_end_at:"2026-09-18T19:00:00Z"}, now), "Completed");
});

test("calendar rendering escapes customer-controlled content", () => {
  const html = renderCampaignCalendar([{
    event_name: "<script>alert(1)</script>",
    event_type: "Football",
    event_start_at: "2026-09-18T18:00:00Z",
    event_end_at: "2026-09-18T21:00:00Z",
    qr_name: "Field",
    campaign_name: "Sponsor"
  }]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
