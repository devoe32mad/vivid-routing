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
  const insight={title:"A measured finding",reason:"12 visits and 4 meaningful visits.",action:"Review the destination page.",href:"/evidence",bestPractice:"Match the page to the ad.",bestPracticeLabel:"Official guidance",bestPracticeHref:"https://example.com/guidance"};
  const html=renderPerformanceCenter({segmentInsights:{paid:[insight],website:[insight],organic:[insight],ai:[insight]}});
  assert.equal((html.match(/A measured finding/g)||[]).length,4);
  assert.match(html,/Insights/);
  assert.match(html,/Recommendations/);
  assert.match(html,/12 visits and 4 meaningful visits/);
  assert.match(html,/Review the destination page/);
  assert.match(html,/External best practice/);
  assert.match(html,/Official guidance/);
  assert.match(html,/target="_blank"/);
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
  assert.equal(website.length,3);assert.match(website[1].title,/source.*unknown/i);assert.match(website[2].title,/leads or sales/i);
  assert.equal(organic.length,3);assert.match(organic[0].title,/28 website visits/);
  assert.equal(ai.length,3);assert.match(ai[0].title,/48 identifiable website visits/);assert.match(ai[1].title,/70\.8%/);
  assert.ok([...website,...organic,...ai].every(item=>item.bestPractice&&item.bestPracticeHref));
});

test("paid evidence produces directional insights below budget-decision thresholds",()=>{
  const range={from:"2026-09-01",to:"2026-09-30"},sources=[{id:"google_ads",name:"Google Ads",evidence:{connections:[{id:1}],rows:[{campaign_name:"Local Search",impressions:"6",clicks:"0",conversions:"0"}]},href:()=>"/google"}];
  const items=paidInsights(sources,range,new Date("2026-09-30T12:00:00Z"));
  assert.equal(items.length,3);assert.match(items[0].title,/Local Search/);assert.match(items[0].title,/no business result/);assert.match(items[1].title,/attention but no recorded result/);
  assert.ok(items.every(item=>item.action));
});

test("does not copy a click-leading campaign without a measured business result",()=>{
  const range={from:"2026-09-01",to:"2026-09-30"},sources=[
    {id:"linkedin",name:"LinkedIn Ads",evidence:{connections:[{id:1}],rows:[{campaign_name:"Trade Show Decision Makers",impressions:"7876",clicks:"18",conversions:"0"}]},href:()=>"/linkedin"},
    {id:"google_ads",name:"Google Ads",evidence:{connections:[{id:2}],rows:[{campaign_name:"Search Test",impressions:"44",clicks:"0",conversions:"0"}]},href:()=>"/google"}
  ];
  const analytics={rows:[{source:"linkedin",medium:"paid-social",sessions:"9",engaged_sessions:"2",key_events:"0",revenue:"0"}]};
  const items=paidInsights(sources,range,new Date("2026-09-30T12:00:00Z"),analytics);
  assert.match(items[0].title,/Trade Show Decision Makers/);assert.match(items[0].title,/no business result/);assert.match(items[0].reason,/7,876 views, 18 clicks/);
  assert.match(items[0].action,/Do not copy/);assert.match(items[1].title,/9 website visits/);assert.doesNotMatch(items.map(i=>i.title).join(" "),/approach on Google/);
});

test("recommends a cross-platform test only after a measured result",()=>{
  const range={from:"2026-09-01",to:"2026-09-30"},sources=[
    {id:"linkedin",name:"LinkedIn Ads",evidence:{connections:[{id:1}],rows:[{campaign_name:"Proven Offer",impressions:"2000",clicks:"40",conversions:"2"}]},href:()=>"/linkedin"},
    {id:"google_ads",name:"Google Ads",evidence:{connections:[{id:2}],rows:[{campaign_name:"Search Test",impressions:"100",clicks:"1",conversions:"0"}]},href:()=>"/google"}
  ];
  const items=paidInsights(sources,range,new Date("2026-09-30T12:00:00Z"),{rows:[]});
  assert.match(items[0].title,/strongest measured paid result/);assert.match(items[1].title,/LinkedIn Ads approach on Google Ads/);
});
