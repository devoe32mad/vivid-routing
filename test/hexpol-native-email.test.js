"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm"), crypto = require("node:crypto");
const {createRequire} = require("node:module");
const {PGlite} = require("@electric-sql/pglite");
const {provisionContactEmail} = require("../hexpol-quality-email");
const {createContactClicks} = require("../hexpol-contact-clicks");
const {omitWebsiteButtonsFromRouting} = require("../install-website-page-tracking");

const origin="https://www.hexpol.com", pageUrl=origin+"/rubber/what-we-offer/qualityjourney";
const original=fs.readFileSync(require.resolve("../server.js"),"utf8");
const patched=omitWebsiteButtonsFromRouting(original);
const route=(start)=>patched.slice(patched.indexOf(start),patched.indexOf("\napp.",patched.indexOf(start)+start.length));
async function fixture(){
  const db=new PGlite();
  await db.exec(`CREATE TABLE campaigns(id integer primary key,user_id integer,advertiser text,start_date date,end_date date,is_archived boolean);
    CREATE TABLE qr_codes(id integer primary key,name text,space_id int,is_imported boolean,description text,is_archived boolean);
    CREATE TABLE qr_campaigns(qr_id int,campaign_id int,is_active boolean);
    CREATE TABLE campaign_destinations(id serial primary key,campaign_id int,name text,destination_type text,destination_url text,
      conversion_url text,estimated_value numeric,display_order int,is_active boolean,created_at timestamp default now(),updated_at timestamp default now());
    CREATE TABLE events(id serial primary key,qr_id int,campaign_id int,campaign_destination_id int,vivid_click_id text,type text,
      value numeric default 0,created_at timestamp default current_timestamp);
    INSERT INTO campaigns VALUES (55,9,'Hexpol',NULL,NULL,true),(94,9,'Hexpol',NULL,NULL,false),(93,9,'Hexpol',NULL,NULL,true);
    INSERT INTO qr_codes VALUES (61,'2026 Polymer Booth',41,false,NULL,false),(96,'Other QR',42,false,NULL,false);
    INSERT INTO qr_campaigns VALUES (61,94,true);`);
  await db.query("INSERT INTO campaign_destinations(campaign_id,name,destination_type,destination_url,display_order,is_active) VALUES(94,'Visit Website','website',$1,1,true)",[pageUrl+'/']);
  return db;
}
function response(){
  return {code:200,status(code){this.code=code;return this;},redirect(url){this.url=url;},send(body){this.body=body;}};
}
test("live QR routes past Contact Email; both WordPress buttons populate existing Customer Actions without conversions",async()=>{
  const db=await fixture(), q=(s,p)=>db.query(s,p), tracker=createContactClicks(q);
  try{
    assert.equal(await provisionContactEmail(db),"configured");
    assert.equal(await provisionContactEmail(db),"already configured");
    const action=(await q("SELECT * FROM campaign_destinations WHERE website_click_key IS NOT NULL")).rows[0];
    assert.equal(action.name,"Contact Email");assert.equal(action.conversion_url,null);assert.equal(Number(action.estimated_value),0);
    assert.equal(omitWebsiteButtonsFromRouting(patched),patched);
    const handlers={};
    const ctx={app:{get:(key,fn)=>{handlers[key]=fn;}},crypto,q,require:createRequire(require.resolve("../server.js")),
      console, activeCampaignForQr:async()=>({id:94}),saveEvent:async e=>q(
        "INSERT INTO events(qr_id,campaign_id,campaign_destination_id,vivid_click_id,type) VALUES($1,$2,$3,$4,$5)",
        [e.qrId,e.campaignId,e.campaignDestinationId||null,e.vividClickId,e.type]),
      addVividClickIdToUrl:(url,id)=>url+"?vivid_click_id="+id};
    vm.runInNewContext(route('app.get("/r/:qrId",'),ctx);
    vm.runInNewContext(route('app.get(\n  "/destination-click/:destinationId",'),ctx);
    let res=response();await handlers["/r/:qrId"]({params:{qrId:"61"}},res);
    const next=new URL(res.url,"https://vivid.example");
    assert.equal(next.pathname,"/destination-click/1");
    const scan=next.searchParams.get("vivid_click_id");
    res=response();await handlers["/destination-click/:destinationId"]({params:{destinationId:"1"},query:{qr_id:"61",vivid_click_id:scan}},res);
    assert.equal(res.url,pageUrl+'/?vivid_click_id='+scan);
    res=response();await handlers["/destination-click/:destinationId"]({params:{destinationId:String(action.id)},query:{qr_id:"61",vivid_click_id:scan}},res);
    assert.equal(res.code,404);assert.equal(res.url,undefined);

    const tap=(key,overrides={})=>tracker.record({campaign_id:94,vivid_click_id:scan,click_event_id:crypto.randomUUID(),page_url:pageUrl,button_key:key,...overrides},origin);
    const first=crypto.randomUUID(); await Promise.all([tap("contact_today",{click_event_id:first}),tap("contact_today",{click_event_id:first})]);
    await tap("start_conversation",{campaign_id:55}); // shared WordPress installation
    // Use the standard campaign screen's actual aggregate to prove row semantics.
    const detail=route('app.get(\n  "/admin/view-campaign/:id",');
    const sql=detail.match(/const destinationsResult = await q\(\s*`([\s\S]+?)`,\s*\[id\]/)[1];
    const report=(await q(sql,[94])).rows.find(r=>r.id===action.id);
    assert.equal(report.clicks,2);assert.equal(report.unique_journeys,1);assert.equal(report.conversions,0);assert.equal(Number(report.conversion_revenue),0);
    assert.equal((await q("SELECT count(*)::int AS n FROM events WHERE type='scan'")).rows[0].n,1);
    await tap("other");await tap("contact_today",{page_url:origin+"/rubber/contact"});await tap("contact_today",{vivid_click_id:crypto.randomUUID()});
    await q("UPDATE events SET created_at=created_at-INTERVAL '25 hours' WHERE type='scan'");
    await tap("contact_today");
    await q("UPDATE events SET created_at=now() WHERE type='scan'");
    await q("UPDATE campaign_destinations SET is_active=false WHERE id=$1",[action.id]);
    assert.equal(await provisionContactEmail(db),"already configured");await tap("contact_today");
    assert.equal((await q(sql,[94])).rows.find(r=>r.id===action.id).clicks,2);
  }finally{await db.close();}
});
test("no setup for a different owner and no replacement of preexisting email actions",async()=>{
  const db=await fixture();
  try{
    await db.query("UPDATE campaigns SET user_id=10 WHERE id=94");
    assert.equal(await provisionContactEmail(db),"not applicable");
    await db.query("UPDATE campaigns SET user_id=9 WHERE id=94");
    await db.query("INSERT INTO campaign_destinations(campaign_id,name,destination_url,is_active) VALUES(94,'Sales','mailto:HCA.InsideSales@hexpol.com',true)");
    assert.equal(await provisionContactEmail(db),"existing email action needs review");
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM campaign_destinations")).rows[0].n,2);
  }finally{await db.close();}
});
