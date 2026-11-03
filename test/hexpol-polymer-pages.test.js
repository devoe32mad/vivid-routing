"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const {PGlite} = require("@electric-sql/pglite");
const {polymerBooth, configuredWebsitePages} = require("../website-page-config");
const {createTracker} = require("../website-page-tracking");
const {resume} = require("../resume-hexpol-polymer");

test("one Summit scan credits five assigned page campaigns, once per page, with no conversions", async()=>{
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE campaigns(id int primary key,user_id int,advertiser text,campaign_url text,start_date date,end_date date,is_archived boolean);
      CREATE TABLE spaces(id int primary key,name text);
      CREATE TABLE qr_codes(id int primary key,name text,space_id int,end_date date,is_archived boolean);
      CREATE TABLE qr_campaigns(qr_id int,campaign_id int,is_active boolean);
      CREATE TABLE campaign_destinations(id serial primary key,campaign_id int,destination_url text,is_active boolean);
      CREATE TABLE events(id serial primary key,qr_id int,campaign_id int,type text,vivid_click_id text,campaign_destination_id int,created_at timestamp default current_timestamp);
      INSERT INTO spaces VALUES(41,'2026 Global Polymer Summit');
      INSERT INTO qr_codes VALUES (61,'2026 Polymer Booth',41,'2026-10-14',false),(96,'Separate QR',41,'2026-10-14',false);
      INSERT INTO campaigns VALUES(55,7,'Hexpol','https://www.hexpol.com/rubber/',NULL,'2026-10-14',true);
      INSERT INTO events(qr_id,campaign_id,type,vivid_click_id) VALUES(61,93,'scan','00000000-0000-4000-8000-000000000061');`);
    const q=(sql,args)=>db.query(sql,args);
    const tracker=createTracker(q);
    for(const page of polymerBooth.pages) {
      await q("INSERT INTO campaigns VALUES($1,7,'Hexpol',NULL,NULL,NULL,false)",[page.campaignId]);
      await q("INSERT INTO qr_campaigns VALUES(61,$1,true)",[page.campaignId]);
      await q("INSERT INTO campaign_destinations(campaign_id,destination_url,is_active) VALUES($1,$2,true)",[page.campaignId,page.url]);
      assert.deepEqual(configuredWebsitePages({id:page.campaignId,name:"Polymer Summit - "+page.name,advertiser:"Hexpol"}),[page]);
    }
    const record=(url)=>tracker.record({campaign_id:55,vivid_click_id:"00000000-0000-4000-8000-000000000061",page_url:url,page_name:"wrong label"},"https://www.hexpol.com");
    for(const page of polymerBooth.pages) {
      assert.equal(await record(page.url),true);
      assert.equal(await record(page.url+"?ignored=1"),true);
    }
    assert.deepEqual((await q("SELECT campaign_id,page_name FROM campaign_website_visits ORDER BY campaign_id DESC")).rows,
      polymerBooth.pages.map(p=>({campaign_id:p.campaignId,page_name:p.name})));
    assert.equal((await q("SELECT COUNT(*)::int AS n FROM events")).rows[0].n,1);
    assert.equal(await record("https://www.hexpol.com/rubber/unconfigured/"),false);
    await q("UPDATE qr_campaigns SET is_active=false WHERE campaign_id=92");
    assert.equal(await record(polymerBooth.pages[1].url),false);
    await q("UPDATE qr_campaigns SET is_active=true WHERE campaign_id=92");
    await q("UPDATE campaigns SET user_id=8 WHERE id=92");
    assert.equal(await record(polymerBooth.pages[1].url),false);
    await resume(db);
    assert.notEqual((await q("SELECT end_date FROM qr_codes WHERE id=61")).rows[0].end_date,null);
    await q("UPDATE campaigns SET user_id=7 WHERE id=92");
    await resume(db);
    assert.equal((await q("SELECT end_date FROM qr_codes WHERE id=61")).rows[0].end_date,null);
    assert.notEqual((await q("SELECT end_date FROM qr_codes WHERE id=96")).rows[0].end_date,null);
    await q("UPDATE qr_codes SET end_date='2026-10-14' WHERE id=61");
    await resume(db);
    assert.notEqual((await q("SELECT end_date FROM qr_codes WHERE id=61")).rows[0].end_date,null);
  } finally {await db.close();}
});
