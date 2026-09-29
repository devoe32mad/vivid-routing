"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {crossPlatformRecommendations,websiteTrafficRecommendations,campaignRecommendations}=require("../marketing-performance-insights");
const period={from:"2026-09-01",to:"2026-09-30"};
test("cross-platform recommendations compare compatible fresh evidence without claiming ROI",()=>{
  const now=new Date("2026-09-28T13:00:00Z"),connection=(id,name)=>({id,account_name:name,currency_code:"USD",status:"connected",last_synced_at:"2026-09-28T12:30:00Z",last_error:""});
  const evidence=(id,name,cost)=>({connections:[connection(id,name)],rows:[{connection_id:id,impressions:5000,clicks:100,cost_micros:cost,conversions:2,conversion_value:50}]});
  const items=crossPlatformRecommendations([
    {id:"meta",name:"Meta Ads",evidence:evidence(1,"Meta",50000000),href:id=>`/meta/${id}`},
    {id:"tiktok",name:"TikTok Ads",evidence:evidence(2,"TikTok",100000000),href:id=>`/tiktok/${id}`}
  ],period,now);
  assert.equal(items.length,2);assert.match(items[0].title,/Meta Ads/);assert.equal(items[0].confidence,"Medium");assert.match(items[0].reason,/lower CPC alone does not establish better customers or ROI/);assert.match(items[0].action,/controlled traffic test/);assert.equal(items[0].href,"/meta/1");
  assert.equal(crossPlatformRecommendations([{id:"meta",name:"Meta",evidence:evidence(1,"Meta",50000000),href:()=>"/meta"}],period,now).length,0);
  assert.equal(crossPlatformRecommendations([{id:"meta",name:"Meta",evidence:{connections:[{...connection(1,"Meta"),last_synced_at:"2026-09-28T08:00:00Z"}],rows:evidence(1,"Meta",50000000).rows},href:()=>"/meta"},{id:"tiktok",name:"TikTok",evidence:evidence(2,"TikTok",100000000),href:()=>"/tiktok"}],period,now).length,0);
});
test("cross-platform recommendations rank a controlled reported-return test",()=>{
  const now=new Date("2026-09-28T13:00:00Z"),connection=(id,name)=>({id,account_name:name,currency_code:"USD",status:"connected",last_synced_at:"2026-09-28T12:30:00Z",last_error:""});
  const evidence=(id,cost,conversions,value)=>({connections:[connection(id,"Account")],rows:[{connection_id:id,impressions:5000,clicks:100,cost_micros:cost,conversions,conversion_value:value}]});
  const items=crossPlatformRecommendations([{id:"google_ads",name:"Google Ads",evidence:evidence(1,100000000,3,60),href:()=>"/google"},{id:"linkedin",name:"LinkedIn Ads",evidence:evidence(2,100000000,6,300),href:()=>"/linkedin"}],period,now);
  assert.equal(items[0].priority,"High");assert.match(items[0].title,/LinkedIn Ads/);assert.match(items[0].action,/small approved test/);assert.match(items[0].limitation,/not verified profit/);
});
test("website recommendations connect paid traffic quality without claiming campaign attribution",()=>{
  const items=websiteTrafficRecommendations({rows:[
    {source:"google",medium:"cpc",sessions:100,users:90,engaged_sessions:70,key_events:8,revenue:0},
    {source:"facebook",medium:"paid-social",sessions:80,users:75,engaged_sessions:20,key_events:0,revenue:0}
  ]},period);
  assert.ok(items.some(item=>item.priority==="High"&&/Meta Ads/.test(item.title)));
  const comparison=items.find(item=>/landing experience/.test(item.title));assert.match(comparison.reason,/70.0%/);assert.match(comparison.limitation,/not verified sales/);assert.match(comparison.action,/test hypothesis/);
});
test("campaign recommendations flag outcome gaps and compare campaigns without declaring waste",()=>{
  const now=new Date("2026-09-28T13:00:00Z"),evidence={connections:[{id:3,account_name:"Account",currency_code:"USD",status:"connected",last_synced_at:"2026-09-28T12:30:00Z",last_error:""}],rows:[
    {connection_id:3,campaign_id:"a",campaign_name:"Offer A",impressions:6000,clicks:120,cost_micros:60000000,conversions:0,conversion_value:0},
    {connection_id:3,campaign_id:"b",campaign_name:"Offer B",impressions:4000,clicks:80,cost_micros:80000000,conversions:4,conversion_value:300}
  ]};
  const items=campaignRecommendations([{id:"linkedin",name:"LinkedIn Ads",evidence,href:()=>"/linkedin/3"}],period,now);
  assert.equal(items[0].priority,"High");assert.match(items[0].title,/Offer A/);assert.match(items[0].limitation,/does not prove the spend was wasted/);assert.match(items[0].action,/Verify the campaign objective/);
  assert.ok(items.some(item=>item.signal==="Campaign comparison"&&/controlled test/.test(item.action)));
});
