"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  APPROVED_EXTERNAL_SOURCES,
  calculatePreviousPeriod,
  buildComparativeIntelligence,
  buildRenewalPricingRecommendation,
  externalRecommendations,
  renderComparativeIntelligence
} = require("../comparative-intelligence");

test("calculates an immediately preceding equal-length period", () => {
  assert.deepEqual(calculatePreviousPeriod("2026-09-01", "2026-09-15"), {
    startDate: "2026-09-01",
    endDate: "2026-09-15",
    previousStartDate: "2026-08-17",
    previousEndDate: "2026-08-31",
    days: 15
  });
  assert.equal(calculatePreviousPeriod("", "2026-09-15"), null);
});

test("builds comparison totals and identifies campaign drivers", () => {
  const result = buildComparativeIntelligence({
    role: "advertiser",
    period: calculatePreviousPeriod("2026-09-01", "2026-09-15"),
    currentCampaigns: [
      { id: 1, name: "A", scans: 20, intent: 5, conversions: 2, revenue: 200 },
      { id: 2, name: "B", scans: 10, intent: 2, conversions: 0, revenue: 0 }
    ],
    previousCampaigns: [
      { id: 1, name: "A", scans: 10, intent: 2, conversions: 1, revenue: 75 },
      { id: 2, name: "B", scans: 8, intent: 1, conversions: 0, revenue: 0 }
    ]
  });

  assert.equal(result.available, true);
  assert.equal(result.metrics.revenue.delta, 125);
  assert.equal(result.metrics.conversions.delta, 1);
  assert.equal(result.drivers[0].name, "A");
  assert.match(result.summary, /increased by \$125\.00/);
});

test("comparison requires explicit start and end dates", () => {
  const result = buildComparativeIntelligence({
    role: "enterprise",
    period: null,
    currentCampaigns: []
  });
  assert.equal(result.available, false);
  assert.match(result.message, /both a start and end date/i);
});

test("pricing engine supports measured increase and protects low-data renewals", () => {
  const strong = buildRenewalPricingRecommendation({
    currentPrice: 100,
    revenue: 350,
    conversions: 3,
    scans: 30,
    revenueTrendPercent: 25,
    expiringSoon: true
  });
  assert.equal(strong.status, "Increase supported");
  assert.equal(strong.recommendation, 108);
  assert.equal(strong.high, 112);
  assert.ok(strong.projectedRoi > 200);

  const limited = buildRenewalPricingRecommendation({
    currentPrice: 100,
    scans: 3
  });
  assert.equal(limited.status, "Hold price");
  assert.equal(limited.recommendation, 100);
  assert.equal(limited.confidence, "Low");
});

test("external guidance is approved, cited, and conditionally relevant", () => {
  assert.ok(APPROVED_EXTERNAL_SOURCES.length >= 3);
  assert.ok(
    APPROVED_EXTERNAL_SOURCES.every(
      source => source.publisher && source.title && source.url && source.reviewedOn
    )
  );
  const recommendations = externalRecommendations({
    engagement: 4,
    conversions: 0
  });
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].sourceType, "External Best Practice");
  assert.match(recommendations[0].source.url, /^https:\/\/support\.google\.com\//);
});

test("comparison renderer escapes campaign content", () => {
  const comparison = buildComparativeIntelligence({
    role: "advertiser",
    period: calculatePreviousPeriod("2026-09-01", "2026-09-15"),
    currentCampaigns: [
      { id: 1, name: "<script>alert(1)</script>", scans: 6, revenue: 10 }
    ],
    previousCampaigns: []
  });
  const html = renderComparativeIntelligence(comparison);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
