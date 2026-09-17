"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildOrganizationIntelligence,
  renderOrganizationIntelligence,
  buildCampaignIntelligence,
  renderCampaignIntelligence,
  buildAdvertiserIntelligence,
  renderAdvertiserIntelligence
} = require("../vivid-intelligence");

test("profitable measured activity is not labeled as needing performance attention", () => {
  const result = buildOrganizationIntelligence({
    organizationId: 23,
    organizationName: "Saint John Neumann High School",
    totals: {
      qrPlacements: 1,
      activeCampaigns: 1,
      scans: 6,
      intent: 1,
      conversions: 1,
      conversionValue: 35
    },
    locations: [
      {
        id: 44,
        name: "Main Campus",
        scans: 6,
        intent: 1,
        conversions: 1,
        conversion_value: 35
      }
    ],
    availableSpots: 4,
    pendingSpots: 0,
    advertiserCount: 1,
    activeContracts: 1
  });

  assert.equal(result.attention.length, 0);
  assert.match(result.summary, /1 tracked conversion worth \$35\.00/);
  assert.ok(
    result.recommendations.some(item =>
      item.title.includes("Main Campus")
    )
  );
  assert.equal(
    result.performanceHref,
    "/org-performance?organization_id=23"
  );
});

test("performance insights link preserves the selected reporting period", () => {
  const result = buildOrganizationIntelligence({
    organizationId: 23,
    totals: {},
    locations: [],
    queryString: "from=2026-09-01&to=2026-09-15"
  });

  assert.equal(
    result.performanceHref,
    "/org-performance?organization_id=23&from=2026-09-01&to=2026-09-15"
  );
});

test("intent without conversion produces a conversion-path warning", () => {
  const result = buildOrganizationIntelligence({
    organizationId: 7,
    organizationName: "Example Organization",
    totals: {
      qrPlacements: 2,
      activeCampaigns: 2,
      scans: 20,
      intent: 5,
      conversions: 0,
      conversionValue: 0
    },
    locations: [{ id: 3, name: "Campus", scans: 20, intent: 5 }]
  });

  assert.ok(
    result.attention.some(
      item => item.title === "Interest is not reaching conversion"
    )
  );
});

test("active campaigns without scans produce a QR visibility warning", () => {
  const result = buildOrganizationIntelligence({
    organizationId: 7,
    totals: {
      qrPlacements: 3,
      activeCampaigns: 2,
      scans: 0
    },
    locations: [{ id: 3, name: "Campus" }]
  });

  assert.ok(
    result.attention.some(
      item => item.title === "Active campaigns have no scans"
    )
  );
});

test("rendered intelligence escapes organization-controlled content", () => {
  const result = buildOrganizationIntelligence({
    organizationId: 7,
    organizationName: "<script>alert(1)</script>",
    totals: {},
    locations: []
  });
  const html = renderOrganizationIntelligence(result);

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("campaign with conversions is performing, never needs attention", () => {
  const [campaign] = buildCampaignIntelligence(
    [
      {
        id: 58,
        name: "Test SJN",
        advertiser: "SJN Advertiser",
        scans: 6,
        intent: 1,
        conversions: 1,
        revenue: 35
      }
    ],
    { organizationId: 23 }
  );

  assert.equal(campaign.classification, "Performing Well");
  assert.equal(campaign.confidence, "Medium");
  assert.match(campaign.href, /organization_id=23/);
});

test("campaign intelligence distinguishes conversion and CTA opportunities", () => {
  const campaigns = buildCampaignIntelligence(
    [
      { id: 1, name: "Intent", scans: 10, intent: 3 },
      { id: 2, name: "Scans", scans: 8, intent: 0 }
    ],
    { organizationId: 23 }
  );

  assert.equal(campaigns[0].classification, "Conversion Path Review");
  assert.equal(campaigns[1].classification, "Call-to-Action Opportunity");
});

test("campaign intelligence renderer escapes campaign content", () => {
  const html = renderCampaignIntelligence([
    {
      name: "<script>alert(1)</script>",
      advertiser: "Test",
      classification: "Monitoring",
      confidence: "Low",
      recommendation: "Observe",
      scans: 0,
      engagement: 0,
      conversions: 0,
      revenue: 0,
      href: "/org-performance"
    }
  ]);

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("advertiser intelligence uses investment and results for campaign status", () => {
  const result = buildAdvertiserIntelligence([
    {
      id: 58,
      name: "Test SJN",
      scans: 6,
      intent: 1,
      conversions: 1,
      revenue: 35,
      allocatedCost: 2.73
    },
    {
      id: 59,
      name: "Interest Only",
      scans: 12,
      intent: 4,
      conversions: 0,
      revenue: 0,
      allocatedCost: 10
    }
  ]);

  const profitable = result.campaigns.find(campaign => campaign.id === 58);
  const conversionGap = result.campaigns.find(campaign => campaign.id === 59);

  assert.equal(profitable.status, "Performing Well");
  assert.ok(profitable.roi > 1100);
  assert.equal(profitable.confidence, "Medium");
  assert.equal(conversionGap.status, "Needs Attention");
  assert.match(conversionGap.recommendation, /conversion confirmation path/i);
  assert.match(result.summary, /tracked conversion/);
  assert.equal(result.answers.length, 2);
  assert.doesNotMatch(
    result.answers.map(item => item.question).join(" "),
    /renew/i
  );
});

test("advertiser intelligence flags negative return despite conversions", () => {
  const result = buildAdvertiserIntelligence([
    {
      id: 4,
      name: "Early Results",
      scans: 30,
      intent: 5,
      conversions: 2,
      revenue: 25,
      allocatedCost: 100
    }
  ]);

  assert.equal(result.campaigns[0].status, "Needs Attention");
  assert.equal(result.campaigns[0].confidence, "High");
  assert.equal(result.campaigns[0].costPerConversion, 50);
});

test("advertiser intelligence renderer escapes campaign and answer content", () => {
  const result = buildAdvertiserIntelligence([
    {
      id: 3,
      name: "<script>alert(1)</script>",
      scans: 1
    }
  ]);
  result.answers[0].answer = "<img src=x onerror=alert(1)>";

  const html = renderAdvertiserIntelligence(result);

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
