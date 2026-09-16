"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  answerAskVivid,
  renderAskVivid
} = require("../ask-vivid");

const advertiserCampaigns = [
  {
    id: 58,
    name: "Test SJN",
    scans: 6,
    intent: 1,
    conversions: 1,
    revenue: 35,
    allocatedCost: 2.73,
    status: "Performing Well"
  },
  {
    id: 59,
    name: "Interest Only",
    scans: 12,
    intent: 4,
    conversions: 0,
    revenue: 0,
    allocatedCost: 10,
    status: "Needs Attention"
  }
];

test("advertiser renewal answer cites measured campaign results", () => {
  const result = answerAskVivid({
    role: "advertiser",
    question: "Should I renew?",
    campaigns: advertiserCampaigns
  });

  assert.equal(result.intent, "renewal");
  assert.match(result.answer, /Test SJN/);
  assert.match(result.answer, /\$35\.00/);
  assert.match(result.answer, /renewal candidate/i);
  assert.equal(result.confidence, "High");
  assert.match(result.links[0].href, /58/);
});

test("advertiser conversion answer identifies the conversion gap", () => {
  const result = answerAskVivid({
    role: "advertiser",
    question: "Why are scans not converting?",
    campaigns: advertiserCampaigns
  });

  assert.equal(result.intent, "conversion");
  assert.match(result.answer, /Interest Only/);
  assert.match(result.answer, /4 measurable engagement actions/);
});

test("enterprise inventory answer stays within supplied scope", () => {
  const result = answerAskVivid({
    role: "enterprise",
    organizationName: "Saint John Neumann High School",
    question: "Where is unused inventory?",
    campaigns: advertiserCampaigns,
    inventory: {
      availableSpots: 4,
      pendingSpots: 2,
      pendingRevenue: 800
    },
    inventoryHref: "/org-marketplace?organization_id=23"
  });

  assert.equal(result.intent, "inventory");
  assert.match(result.answer, /4 available advertising spots/);
  assert.match(result.answer, /\$800\.00/);
  assert.equal(result.links[0].href, "/org-marketplace?organization_id=23");
});

test("comparison question refuses to invent prior-period results", () => {
  const result = answerAskVivid({
    role: "enterprise",
    question: "Why did performance decline?",
    campaigns: advertiserCampaigns
  });

  assert.equal(result.intent, "comparison");
  assert.match(result.answer, /will not claim/i);
  assert.match(result.answer, /prior period/i);
});

test("unsupported question returns a grounded summary", () => {
  const result = answerAskVivid({
    role: "advertiser",
    question: "Tell me something useful",
    campaigns: advertiserCampaigns
  });

  assert.equal(result.intent, "summary");
  assert.match(result.answer, /could not match/i);
  assert.match(result.answer, /2 active campaigns/);
  assert.match(result.answer, /1 tracked conversion/);
});

test("Ask Vivid renderer escapes questions, data, links, and hidden fields", () => {
  const result = answerAskVivid({
    role: "enterprise",
    organizationName: "<script>alert(1)</script>",
    question: "<img src=x onerror=alert(1)>",
    campaigns: [
      {
        id: 3,
        name: "<b>Campaign</b>",
        scans: 1,
        href: "javascript:alert(1)"
      }
    ]
  });

  const html = renderAskVivid(result, {
    action: "/org-performance",
    hiddenFields: { organization_id: '23\"><script>' }
  });

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("enterprise assistant is initialized after its revenue data", () => {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "ask-vivid-install-")
  );
  const projectRoot = path.join(__dirname, "..");

  for (const filename of [
    "server.js",
    "vivid-intelligence.js",
    "ask-vivid.js",
    "install-vivid-intelligence.js"
  ]) {
    fs.copyFileSync(
      path.join(projectRoot, filename),
      path.join(tempDirectory, filename)
    );
  }

  const installation = spawnSync(
    process.execPath,
    [path.join(tempDirectory, "install-vivid-intelligence.js")],
    { encoding: "utf8" }
  );

  assert.equal(installation.status, 0, installation.stderr);

  const generatedServer = fs.readFileSync(
    path.join(tempDirectory, "server.js"),
    "utf8"
  );
  const assistantIndex = generatedServer.indexOf(
    "const organizationAskVivid ="
  );
  const revenueIndex = generatedServer.lastIndexOf(
    "const advertiserRevenueGenerated =",
    assistantIndex
  );

  assert.ok(revenueIndex >= 0, "enterprise revenue initializer was not found");
  assert.ok(
    assistantIndex > revenueIndex,
    "enterprise assistant must be initialized after advertiser revenue"
  );

  const syntax = spawnSync(
    process.execPath,
    ["--check", path.join(tempDirectory, "server.js")],
    { encoding: "utf8" }
  );
  assert.equal(syntax.status, 0, syntax.stderr);
});
