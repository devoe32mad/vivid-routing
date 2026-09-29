"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {crossPlatformRecommendations}=require("../marketing-performance-insights");
const period={from:"2026-09-01",to:"2026-09-30"};
test("cross-platform recommendations compare compatible fresh evidence without claiming ROI",()=>{
  const now=new Date("2026-09-28T13:00:00Z"),connection=(id,name)=>({id,account_name:name,currency_code:"USD",status:"connected",last_synced_at:"2026-09-28T12:30:00Z",last_error:""});
  const evidence=(id,name,cost)=>({connections:[connection(id,name)],rows:[{connection_id:id,impressions:5000,clicks:100,cost_micros:cost,conversions:2,conversion_value:50}]});
  const items=crossPlatformRecommendations([
    {id:"meta",name:"Meta Ads",evidence:evidence(1,"Meta",50000000),href:id=>`/meta/${id}`},
    {id:"tiktok",name:"TikTok Ads",evidence:evidence(2,"TikTok",100000000),href:id=>`/tiktok/${id}`}
  ],period,now);
  assert.equal(items.length,2);assert.match(items[0].title,/Meta Ads/);assert.match(items[0].signal,/Medium confidence/);assert.match(items[0].reason,/lower CPC alone does not establish better customers or ROI/);assert.equal(items[0].href,"/meta/1");
  assert.equal(crossPlatformRecommendations([{id:"meta",name:"Meta",evidence:evidence(1,"Meta",50000000),href:()=>"/meta"}],period,now).length,0);
  assert.equal(crossPlatformRecommendations([{id:"meta",name:"Meta",evidence:{connections:[{...connection(1,"Meta"),last_synced_at:"2026-09-28T08:00:00Z"}],rows:evidence(1,"Meta",50000000).rows},href:()=>"/meta"},{id:"tiktok",name:"TikTok",evidence:evidence(2,"TikTok",100000000),href:()=>"/tiktok"}],period,now).length,0);
});
