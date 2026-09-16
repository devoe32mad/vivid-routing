"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MIN_ORGANIZATIONS,
  MIN_CAMPAIGNS,
  buildVividBenchmark,
  renderVividBenchmark
} = require("../vivid-benchmarks");

function campaigns(organizations = 10, campaignCount = 20) {
  return Array.from({ length: campaignCount }, (_, index) => ({
    organizationId: (index % organizations) + 1,
    scans: 10 + index,
    engagement: 4 + index,
    conversions: index % 5,
    revenue: index * 25,
    advertiser: `Private advertiser ${index}`,
    name: `Private campaign ${index}`
  }));
}

test("keeps benchmark private until both thresholds are met", () => {
  const result = buildVividBenchmark({
    campaigns: campaigns(MIN_ORGANIZATIONS - 1, MIN_CAMPAIGNS)
  });
  assert.equal(result.available, false);
  assert.equal(result.requiredOrganizations, 1);
  assert.match(result.explanation, /privacy and reliability/i);
});

test("does not publish a benchmark from enough organizations but too few campaigns", () => {
  const result = buildVividBenchmark({
    campaigns: campaigns(MIN_ORGANIZATIONS, MIN_CAMPAIGNS - 1)
  });
  assert.equal(result.available, false);
  assert.equal(result.requiredCampaigns, 1);
});

test("publishes aggregate medians and AI interpretation at threshold", () => {
  const result = buildVividBenchmark({
    campaigns: campaigns(),
    subject: { campaigns: 2, scans: 50, engagement: 25, conversions: 5, revenue: 1000 }
  });
  assert.equal(result.available, true);
  assert.equal(result.organizationCount, 10);
  assert.equal(result.campaignCount, 20);
  assert.equal(result.metrics.engagementRate.subject, 50);
  assert.ok(result.aiInterpretation.recommendation);
  assert.equal(JSON.stringify(result).includes("Private advertiser"), false);
  assert.equal(JSON.stringify(result).includes("Private campaign"), false);
});

test("escapes benchmark rendering and never renders cohort identities", () => {
  const result = buildVividBenchmark({
    campaigns: campaigns(),
    subject: { campaigns: 1, scans: 20, engagement: 5, conversions: 1, revenue: 50 }
  });
  result.privacy = '<script>alert("x")</script>';
  const html = renderVividBenchmark(result, { role: "advertiser" });
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /Private advertiser|Private campaign/);
  assert.match(html, /AI interpretation/);
});
