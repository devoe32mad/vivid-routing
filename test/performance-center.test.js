"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { renderPerformanceCenter } = require("../performance-center");

test("performance center uses compact clickable plain-English cards", () => {
  const html = renderPerformanceCenter({
    startDate: "2026-09-01", endDate: "2026-09-29",
    advertisingInvestment: 100, conversionRevenue: 250, roi: 150,
    conversions: 5, cac: 20, intentRate: 40, intent: 4, scans: 10,
    activeCampaigns: 2,
    topFiveCampaigns: [{id: 7, name: "Fall offer", revenue: 250, conversions: 5}],
    topFiveAttentionCampaigns: [{id: 8, name: "Old creative", allocatedCost: 80, revenue: 0}],
    topFiveLocations: [{name: "Main Street", revenue: 250, conversions: 5}],
    topFivePlacements: [{name: "Lobby screen", revenue: 250, conversions: 5}],
    executiveInsights: [{type: "Investment Risk", text: "One campaign has cost but no recorded sales."}]
  });
  assert.match(html, /Know what is working—and what to do next/);
  assert.match(html, /What happened\?/);
  assert.match(html, /What worked\?/);
  assert.match(html, /What needs attention\?/);
  assert.match(html, /href="\/admin\/edit-campaign\/7"/);
  assert.match(html, /href="\/admin\/marketing-command-center"/);
  assert.match(html, /ROI means how much came back after cost/);
  assert.doesNotMatch(html, /Executive Performance/);
});

test("performance center explains missing calculations honestly", () => {
  const html = renderPerformanceCenter({});
  assert.match(html, /Not ready/);
  assert.match(html, /Not enough data/);
  assert.match(html, /Nothing urgent/);
});
