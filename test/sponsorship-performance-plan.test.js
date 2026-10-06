"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {
  basicQrRestricted,
  basicCampaignRestricted,
  renderBasicSponsorshipDashboard
}=require("../sponsorship-performance-plan");

function qFor({basicQr=false,basicCampaign=false}={}) {
  return async(sql)=>{
    if(sql.includes("CREATE TABLE")) return {rows:[]};
    if(sql.includes("WHERE spp.qr_id=$2")) return {rows:basicQr?[{ok:1}]:[]};
    if(sql.includes("WHERE qc.campaign_id=$2")) return {rows:basicCampaign?[{ok:1}]:[]};
    return {rows:[]};
  };
}

test("Basic sponsorship blocks direct campaign and schedule changes",async()=>{
  assert.equal(await basicCampaignRestricted(qFor({basicCampaign:true}),7,55),true);
  assert.equal(await basicQrRestricted(qFor({basicQr:true}),7,10),true);
});

test("Performance sponsorship remains eligible for campaign and schedule changes",async()=>{
  assert.equal(await basicCampaignRestricted(qFor(),7,56),false);
  assert.equal(await basicQrRestricted(qFor(),7,11),false);
});

test("mixed plans expose controls only for the Performance placement",()=>{
  const html=renderBasicSponsorshipDashboard({
    title:"Mixed Sponsor",
    range:{from:"2026-09-07",to:"2026-10-06"},
    csrf:"token",
    placements:[
      {qr_id:10,qr_name:"Fence",space_name:"School A",campaign_id:55,campaign_name:"Fall",scans:12,plan:"basic",status:"active"},
      {qr_id:11,qr_name:"Gym",space_name:"School B",campaign_id:56,campaign_name:"Winter",scans:21,plan:"performance",status:"active"}
    ]
  });
  assert.doesNotMatch(html,/\/admin\/view-campaign\/55/);
  assert.match(html,/\/admin\/view-campaign\/56/);
  assert.match(html,/>33</);
  assert.match(html,/Add Vivid Performance — \$35\/month/);
  assert.match(html,/Vivid Performance active · \$35\/month/);
});
