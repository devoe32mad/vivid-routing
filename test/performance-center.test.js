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
  assert.match(html, /Choose what you want to improve/);
  assert.match(html, /Social &amp; search advertising/);
  assert.match(html, /Traffic &amp; search performance/);
  assert.match(html, /Unpaid content performance/);
  assert.match(html, /AI-referred website traffic/);
  assert.match(html, /platform=paid_media/);
  assert.match(html, /platform=ga4/);
  assert.match(html, /platform=organic/);
  assert.match(html, /platform=ai_traffic/);
  assert.match(html, /Across all marketing/);
  assert.match(html, /What worked\?/);
  assert.match(html, /What should I do next\?/);
  assert.match(html, /AI recommendation · For review/);
  assert.match(html, /Next step:/);
  assert.match(html, /Inspect evidence/);
  assert.match(html, /href="\/admin\/edit-campaign\/7"/);
  assert.match(html, /href="\/admin\/marketing-command-center\?from=2026-09-01&amp;to=2026-09-29"/);
  assert.match(html, /ROAS divides value by advertising cost/);
  assert.doesNotMatch(html, /Executive Performance/);
});

test("performance center startup installer is included in production start", () => {
  const scripts = require("../package.json").scripts;
  assert.match(scripts.start, /install-performance-center\.js/);
});

test("performance center removes duplicate recommendations for the same attention campaign", () => {
  const html = renderPerformanceCenter({
    topFiveAttentionCampaigns: [{id: 8, name: "Old creative", allocatedCost: 80, revenue: 0}],
    executiveInsights: [
      {type: "Investment Risk", text: "Old creative has cost but no recorded sales."},
      {type: "Revenue Opportunity", text: "A different measured opportunity exists."}
    ]
  });
  assert.equal((html.match(/Old creative/g) || []).length, 1);
  assert.match(html, /A different measured opportunity exists/);
});

test("installer scopes super-admin performance to the remembered Marketing Center account", () => {
  const fs = require("fs"), os = require("os"), path = require("path"), {execFileSync} = require("child_process");
  const root = path.join(__dirname, ".."), temp = fs.mkdtempSync(path.join(os.tmpdir(), "vivid-performance-scope-"));
  for (const file of ["server.js", "install-performance-center.js", "performance-center.js"]) fs.copyFileSync(path.join(root, file), path.join(temp, file));
  execFileSync(process.execPath, [path.join(temp, "install-performance-center.js")], {stdio:"pipe", env:{...process.env, VIVID_SERVER_FILE:path.join(temp, "server.js")}});
  const installed = fs.readFileSync(path.join(temp, "server.js"), "utf8");
  const route = installed.slice(installed.indexOf('app.get("/admin/ai-insights"'), installed.indexOf('app.get("/admin/weekly-ai-report"'));
  assert.match(route, /const performanceUserId =/);
  assert.match(route, /req\.session\.marketingAccountId/);
  assert.doesNotMatch(route, /isSuperAdmin\s*\? \[null\]/);
  fs.rmSync(temp, {recursive:true, force:true});
});

test("performance center explains missing calculations honestly", () => {
  const html = renderPerformanceCenter({});
  assert.match(html, /Not ready/);
  assert.match(html, /Not enough data/);
  assert.match(html, /Nothing urgent/);
});
