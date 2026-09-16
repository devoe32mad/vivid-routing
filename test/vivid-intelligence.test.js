"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildOrganizationIntelligence,
  renderOrganizationIntelligence
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
