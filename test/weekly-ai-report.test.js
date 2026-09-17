"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  comparisonLabel,
  renderWeeklyAiPreferences,
  renderWeeklyAiReport,
  safeHref
} = require("../weekly-ai-report");

test("weekly report renders clickable metrics, priorities, events and external intelligence", () => {
  const html = renderWeeklyAiReport({
    role: "advertiser",
    accountName: "Vivid Test",
    metrics: { scans: 12, clicks: 9, conversions: 2, revenue: 125 },
    previousMetrics: { scans: 6, clicks: 3, conversions: 1, revenue: 50 },
    priorities: [{ title: "Improve CTA", reason: "Measured gap", evidence: "12 scans", action: "Open campaign", href: "/admin/edit-campaign/1" }],
    events: [{ name: "Home Football", type: "Football", campaign: "Game Night", placement: "Stadium", startsAt: "2026-09-18T23:00:00Z", timezone: "America/New_York", href: "/admin/event-calendar" }],
    externalSignals: [{ title: "Seasonal guidance", source: "Official source", url: "https://example.com/guidance", summary: "Relevant context." }]
  });
  assert.match(html, /Vivid AI Weekly Report · Advertiser/);
  assert.match(html, /href="\/admin\/edit-campaign\/1"/);
  assert.match(html, /href="\/admin\/event-calendar"/);
  assert.match(html, /Outside Vivid · Official source/);
  assert.match(html, /Vivid AI Campaign Operator/);
});

test("weekly report escapes user-controlled content and rejects unsafe links", () => {
  const html = renderWeeklyAiReport({
    accountName: '<script>alert("x")</script>',
    priorities: [{ title: "Unsafe", reason: "Test", evidence: "Test", href: "javascript:alert(1)" }]
  });
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.equal(safeHref("https://example.com/a"), "https://example.com/a");
  assert.equal(safeHref("//evil.example"), "#");
});

test("comparison labels handle increases, declines and new activity", () => {
  assert.equal(comparisonLabel(10, 5), "+100.0% vs. prior week");
  assert.equal(comparisonLabel(5, 10), "-50.0% vs. prior week");
  assert.equal(comparisonLabel(2, 0), "New activity");
  assert.equal(comparisonLabel(0, 0), "No change");
});

test("preference form exposes weekly delivery controls", () => {
  const html = renderWeeklyAiPreferences({ enabled: true, deliveryDay: 1, deliveryHour: 8, timezone: "America/New_York", includeExternal: true });
  assert.match(html, /Send my weekly report/);
  assert.match(html, /Monday/);
  assert.match(html, /8:00 AM/);
  assert.match(html, /verified external intelligence/);
});
