'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {seed,events}=require('../seed-ccps-performance-demo');
test('paid example seeds consistent events and website visits exactly once',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 try{
 await db.exec(`CREATE TABLE users(id integer,email text);CREATE TABLE campaigns(id integer,user_id integer,name text,is_test boolean);CREATE TABLE qr_codes(id integer,space_id integer);CREATE TABLE spaces(id integer,organization_id integer);CREATE TABLE qr_campaigns(qr_id integer,campaign_id integer);
 CREATE TABLE events(id serial primary key,campaign_id integer,qr_id integer,type text,value numeric,created_at timestamp,vivid_click_id text,vivid_session_id text);
 CREATE TABLE campaign_website_visits(scan_event_id integer,campaign_id integer,qr_id integer,vivid_click_id text,page_url text,page_name text,created_at timestamp,UNIQUE(campaign_id,vivid_click_id,page_url));
 INSERT INTO users VALUES(10,'mike@vividspots.com');INSERT INTO campaigns VALUES(69,10,'Test Analytics Upgrade (2)',false);INSERT INTO qr_codes VALUES(98,40);INSERT INTO spaces VALUES(40,13);INSERT INTO qr_campaigns VALUES(98,69);`);
 const q={query:(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(sql,args)};
 await seed(q);await seed(q);
 const counts=(await db.query("SELECT type,COUNT(*)::int AS n,SUM(value)::int AS value FROM events GROUP BY type ORDER BY type")).rows;
 assert.deepEqual(counts,[{type:'conversion',n:8,value:400},{type:'maps',n:24,value:0},{type:'offer',n:64,value:0},{type:'scan',n:240,value:0},{type:'waze',n:8,value:0}]);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM campaign_website_visits')).rows[0].n,80);
 assert.equal(events().length,344);
 }finally{await db.close()}
});
test('CCPS demo unlocks only Gulf Coast and MCC queries only the paid demo scope',async()=>{
 const helper=require('../report-performance-upgrade');
 const q=async sql=>({rows:sql.includes('FROM sponsorship_performance_plans')?[{qr_id:97,campaign_id:68,location_id:36},{qr_id:98,campaign_id:69,location_id:40}]:[{qr_id:97,campaign_id:68,location_id:36},{qr_id:98,campaign_id:69,location_id:40}]});
 const state=await helper.load({q,req:{session:{user:{id:10,role:'customer',ccpsReview:true}},originalUrl:'/reports'}});
 assert.equal(helper.restricted(state,'campaign_id',69),false);assert.equal(helper.restricted(state,'qr_id',98),false);assert.equal(helper.restricted(state,'location_id',40),false);assert.equal(helper.restricted(state,'location_id',36),true);
 assert.match(helper.render(state,'campaign_id',69),/Demo paid placement/);
 const html=await require('../marketing-command-center-routes').renderHfhsMarketingDemo({q:async(sql,args)=>{assert.deepEqual(args.slice(0,2),[[69],[98]]);return {rows:[{id:69,name:'Gulf Coast — Performance Demo',scans:240,clicks:96,conversions:8,conversion_value:400}]}},range:{from:'2026-09-14',to:'2026-10-13'},scope:{campaignIds:[68,69],qrIds:[97,98]},user:{id:10,ccpsReview:true}});
 assert.match(html,/CCPS · Vivid Performance/);assert.match(html,/240/);assert.doesNotMatch(html,/HFHS demonstration/);
});
