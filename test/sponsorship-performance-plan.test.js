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


test("real database preserves per-spot Basic and Performance entitlements",async()=>{
  const {PGlite}=require("@electric-sql/pglite");
  const db=new PGlite();
  try{
    await db.exec(`
      CREATE TABLE users(id INT PRIMARY KEY);
      CREATE TABLE spaces(id INT PRIMARY KEY,user_id INT,name TEXT,location TEXT);
      CREATE TABLE qr_codes(id INT PRIMARY KEY,space_id INT,name TEXT,description TEXT);
      CREATE TABLE campaigns(id INT PRIMARY KEY,user_id INT,name TEXT,is_test BOOLEAN DEFAULT false);
      CREATE TABLE qr_campaigns(id INT PRIMARY KEY,qr_id INT,campaign_id INT,is_active BOOLEAN DEFAULT true);
      CREATE TABLE organization_advertising_requests(
        id INT PRIMARY KEY,
        created_qr_id INT,
        created_vivid_user_id INT,
        status TEXT
      );
      CREATE TABLE events(
        id INT PRIMARY KEY,
        campaign_id INT,
        qr_id INT,
        type TEXT,
        created_at TIMESTAMPTZ
      );
      INSERT INTO users VALUES(7);
      INSERT INTO spaces VALUES(1,99,'Gulf Coast','Naples'),(2,99,'Barron Collier','Naples');
      INSERT INTO qr_codes VALUES
        (10,1,'Fence','https://example.com/basic'),
        (11,2,'Gym','https://example.com/performance');
      INSERT INTO campaigns VALUES(55,7,'Fall',false),(56,7,'Winter',false);
      INSERT INTO qr_campaigns VALUES(1,10,55,true),(2,11,56,true);
      INSERT INTO organization_advertising_requests VALUES
        (22,10,7,'Approved'),
        (23,11,7,'Approved');
      INSERT INTO events VALUES
        (1,55,10,'scan','2026-10-01T12:00:00Z'),
        (2,55,10,'scan','2026-10-02T12:00:00Z'),
        (3,56,11,'scan','2026-10-03T12:00:00Z'),
        (4,56,10,'scan','2026-10-03T12:00:00Z');
    `);
    const q=(sql,args=[])=>db.query(sql,args);
    const plan=require("../sponsorship-performance-plan");
    assert.equal(await plan.attachBasicPlanToMarketplaceQr(q,{qrId:10,marketplaceRequestId:22,userId:7}),true);
    await plan.ensureSchema(q);
    await q("INSERT INTO sponsorship_performance_plans(qr_id,plan,monthly_price,status) VALUES($1,'performance',35,'active')",[11]);

    assert.equal(await plan.basicQrRestricted(q,7,10),true);
    assert.equal(await plan.basicQrRestricted(q,7,11),false);
    assert.equal(await plan.basicCampaignRestricted(q,7,55),true);
    assert.equal(await plan.basicCampaignRestricted(q,7,56),false);

    const state=await plan.loadAdvertiserSponsorshipState(
      q,7,{from:"2026-10-01",to:"2026-10-06"},[{id:55},{id:56}]
    );
    assert.equal(state.sponsorshipOnly,true);
    const basic=state.rows.find(row=>Number(row.qr_id)===10 && Number(row.campaign_id)===55);
    const performance=state.rows.find(row=>Number(row.qr_id)===11 && Number(row.campaign_id)===56);
    assert.equal(Number(basic.scans),2);
    assert.equal(Number(performance.scans),1);
  } finally {
    await db.close();
  }
});
