"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {aiSource,organicMedium,websiteInsights,organicInsights,aiInsights,paidInsights}=require("../performance-center-evidence");
const {renderPerformanceCenter}=require("../performance-center");

test("classifies AI and organic traffic without treating paid traffic as organic",()=>{
  assert.equal(aiSource("chatgpt.com"),true);
  assert.equal(aiSource("perplexity.ai"),true);
  assert.equal(aiSource("google.com"),false);
  assert.equal(organicMedium("organic_social"),true);
  assert.equal(organicMedium("paid-social"),false);
  assert.equal(organicMedium("cpc"),false);
});

test("renders inline segment findings and actions",()=>{
  const insight={title:"A measured finding",reason:"12 sessions and 4 engaged sessions.",action:"Review the landing page.",href:"/evidence"};
  const html=renderPerformanceCenter({segmentInsights:{paid:[insight],website:[insight],organic:[insight],ai:[insight]}});
  assert.equal((html.match(/A measured finding/g)||[]).length,4);
  assert.match(html,/Insights/);
  assert.match(html,/Recommendations/);
  assert.match(html,/12 sessions and 4 engaged sessions/);
  assert.match(html,/Review the landing page/);
  assert.doesNotMatch(html,/Inspect evidence/);
  assert.match(html,/View supporting data/);
  assert.match(html,/href="\/evidence"/);
});

test("turns modest GA4 evidence into several honest recommendations",()=>{
  const analytics={rows:[
    {source:"(direct)",medium:"(none)",sessions:"560",engaged_sessions:"150",key_events:"0"},
    {source:"chatgpt.com",medium:"ai-assistant",sessions:"48",engaged_sessions:"34",key_events:"0"},
    {source:"google",medium:"organic",sessions:"18",engaged_sessions:"15",key_events:"0"},
    {source:"facebook",medium:"organic_social",sessions:"10",engaged_sessions:"2",key_events:"0"}
  ]},range={from:"2026-09-01",to:"2026-09-30"};
  const website=websiteInsights(analytics,null,range),organic=organicInsights(analytics,null,range),ai=aiInsights(analytics,range);
  assert.equal(website.length,3);assert.match(website[1].title,/direct/i);assert.match(website[2].title,/no key actions/i);
  assert.equal(organic.length,3);assert.match(organic[0].title,/28 website sessions/);
  assert.equal(ai.length,3);assert.match(ai[0].title,/48 identifiable visits/);assert.match(ai[1].title,/70\.8%/);
});

test("paid evidence produces directional insights below budget-decision thresholds",()=>{
  const range={from:"2026-09-01",to:"2026-09-30"},sources=[{id:"google_ads",name:"Google Ads",evidence:{connections:[{id:1}],rows:[{impressions:"6",clicks:"0",conversions:"0"}]},href:()=>"/google"}];
  const items=paidInsights(sources,range,new Date("2026-09-30T12:00:00Z"));
  assert.equal(items.length,3);assert.match(items[0].title,/connected/);assert.match(items[1].title,/most measured paid delivery/);assert.match(items[2].title,/No platform-reported conversions/);
  assert.ok(items.every(item=>item.action));
});
