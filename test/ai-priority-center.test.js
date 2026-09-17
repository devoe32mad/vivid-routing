"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPriorityCenter,
  renderPriorityCenter
} = require("../ai-priority-center");

test("advertiser priorities focus on improvement and never prompt renewal", () => {
  const center = buildPriorityCenter({
    role: "advertiser",
    campaigns: [
      { id: 1, name: "Click Gap", scans: 20, engagement: 8, conversions: 0, investment: 500, href: "/admin/edit-campaign/1" },
      { id: 2, name: "Scan Gap", scans: 10, engagement: 0, conversions: 0, href: "/admin/edit-campaign/2" },
      { id: 3, name: "Winner", scans: 30, engagement: 12, conversions: 4, revenue: 900, href: "/admin/edit-campaign/3" },
      { id: 4, name: "Extra", scans: 5, engagement: 1, conversions: 0, href: "/admin/edit-campaign/4" }
    ]
  });

  assert.equal(center.priorities.length, 3);
  assert.match(center.priorities[0].title, /conversion path/i);
  assert.doesNotMatch(JSON.stringify(center), /should i renew|renewal candidate/i);
});

test("enterprise priorities put an approaching renewal first", () => {
  const center = buildPriorityCenter({
    role: "enterprise",
    renewals: [{
      name: "Stadium Partnership",
      scans: 40,
      clicks: 12,
      conversions: 3,
      href: "/org-renewals?organization_id=23",
      recommendation: {
        recommendation: 1050,
        reason: "Measured results support a pricing review.",
        confidence: "High"
      }
    }],
    campaigns: [{ id: 1, name: "Click Gap", scans: 20, engagement: 8, conversions: 0 }],
    availableSpots: 4,
    inventoryHref: "/org-marketplace?organization_id=23"
  });

  assert.equal(center.priorities.length, 3);
  assert.match(center.priorities[0].title, /renewal pricing/i);
  assert.equal(center.priorities[0].impact, "$1,050.00 recommended price");
});

test("priority center escapes customer-controlled content", () => {
  const html = renderPriorityCenter(buildPriorityCenter({
    role: "advertiser",
    campaigns: [{
      id: 1,
      name: "<script>alert(1)</script>",
      scans: 8,
      engagement: 2,
      conversions: 0,
      href: "/admin/edit-campaign/1"
    }]
  }));

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Read only/);
});
