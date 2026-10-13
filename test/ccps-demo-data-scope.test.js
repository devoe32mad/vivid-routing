'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');const scope=require('../ccps-demo-data-scope');
test('CCPS contracts, requests, placements, campaigns and events reconcile without changing source rows',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`CREATE TABLE contracts(id int,organization_id int,advertising_request_id int,total_contract_value int);
 CREATE TABLE organization_advertising_requests(id int,organization_id int,created_qr_id int);
 CREATE TABLE qr_codes(id int,total_cost int);
 CREATE TABLE campaigns(id int,user_id int);
 CREATE TABLE qr_campaigns(qr_id int,campaign_id int);
 CREATE TABLE events(id int,qr_id int);
 INSERT INTO contracts VALUES(41,13,51,500),(42,13,52,750),(43,13,53,500),(9,13,9,1000),(99,39,99,9000);
 INSERT INTO organization_advertising_requests VALUES(51,13,97),(52,13,98),(53,13,99),(9,13,9),(99,39,199);
 INSERT INTO qr_codes VALUES(97,500),(98,750),(99,500),(9,1000),(199,9000);
 INSERT INTO campaigns VALUES(68,10),(69,10),(57,10),(100,20);
 INSERT INTO qr_campaigns VALUES(97,68),(98,69),(99,69),(9,57),(199,100);
 INSERT INTO events VALUES(1,97),(2,98),(3,99),(4,9),(5,199);`);
 await db.exec(`ALTER TABLE contracts ADD COLUMN advertiser_id int;
 ALTER TABLE campaigns ADD COLUMN advertiser text; ALTER TABLE campaigns ADD COLUMN name text;
 ALTER TABLE organization_advertising_requests ADD COLUMN business_name text;
 ALTER TABLE organization_advertising_requests ADD COLUMN contact_name text;
 ALTER TABLE organization_advertising_requests ADD COLUMN email text;
 CREATE TABLE advertisers(id int,organization_id int,name text,relationship_status text,next_action text,is_active boolean);
 UPDATE campaigns SET advertiser='Vivid Spots',name='Original test campaign';
 UPDATE organization_advertising_requests SET business_name='Vivid Spots';`);
 await db.exec(`ALTER TABLE campaigns ADD COLUMN placement_id int; ALTER TABLE campaigns ADD COLUMN is_archived boolean DEFAULT false;
 ALTER TABLE qr_codes ADD COLUMN name text; ALTER TABLE qr_codes ADD COLUMN space_id int;
 ALTER TABLE qr_campaigns ADD COLUMN is_active boolean DEFAULT true; ALTER TABLE qr_campaigns ADD COLUMN assigned_at timestamp;
 CREATE TABLE spaces(id int PRIMARY KEY,name text,location text);`);
 const q=sql=>db.query(scope.sqlFor(sql));
 await scope.run(true,async()=>{
 assert.deepEqual((await q('SELECT count(*)::int n,sum(total_contract_value)::int value FROM contracts')).rows,[{n:3,value:1750}]);
 assert.deepEqual((await q('SELECT count(*)::int n,sum(total_cost)::int value FROM qr_codes')).rows,[{n:3,value:1750}]);
 assert.equal((await q('SELECT * FROM contracts WHERE id=9')).rows.length,0);
 assert.equal((await q('WITH totals AS (SELECT count(*)::int n FROM events) SELECT * FROM totals')).rows[0].n,3);
 assert.equal((await q('SELECT * FROM campaigns')).rows.length,2);
 // Execute both actual My Setup campaign queries against PostgreSQL, including c.*.
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
 const setup=source.slice(source.indexOf('const campaigns = await q(',source.indexOf('app.get("/my-setup"')));
 const queryBlock=setup.slice(0,setup.indexOf('const archivedCampaigns'));
 const queries=[...queryBlock.matchAll(/`([\s\S]*?)`/g)].map(m=>m[1]);
 assert.equal(queries.length,2);
 for(const query of queries){
  const rows=(await db.query(scope.sqlFor(query),query.includes('$1')?[10]:[])).rows;
  assert.deepEqual(rows.map(r=>r.id),[69,68]);
  assert.equal(rows[0].advertiser,'Gulf Coast Home Services (Demo)');
 }

 assert.equal((await q('SELECT * FROM organization_advertising_requests')).rows.length,3);
 const sponsors=(await q('SELECT a.name,sum(c.total_contract_value)::int value FROM contracts c JOIN advertisers a ON a.id=c.advertiser_id GROUP BY a.name ORDER BY a.name')).rows;
 assert.deepEqual(sponsors,[{name:'Coastal Family Dental (Demo)',value:1000},{name:'Gulf Coast Home Services (Demo)',value:750}]);
 assert.equal((await q('SELECT advertiser FROM campaigns WHERE id=69')).rows[0].advertiser,'Gulf Coast Home Services (Demo)');
 assert.equal((await q('SELECT business_name FROM organization_advertising_requests WHERE id=51')).rows[0].business_name,'Coastal Family Dental (Demo)');
 });
 assert.equal((await q('SELECT * FROM contracts')).rows.length,5);
 assert.equal((await q('SELECT advertiser FROM campaigns WHERE id=69')).rows[0].advertiser,'Vivid Spots');
 await Promise.all([scope.run(true,async()=>{await new Promise(r=>setTimeout(r,5));assert.match(scope.sqlFor('SELECT * FROM contracts'),/^WITH/);}),scope.run(false,async()=>{await new Promise(r=>setTimeout(r,10));assert.equal(scope.sqlFor('SELECT * FROM contracts'),'SELECT * FROM contracts');})]);
 assert.equal(scope.run(true,()=>scope.sqlFor('UPDATE contracts SET total_contract_value=1')),'UPDATE contracts SET total_contract_value=1');
 }finally{await db.close();}
});
test('active sponsorship totals include a contracted placement with no visible campaign',async()=>{
 const active=require('../org-active-advertising');let calls=0;
 const q=async()=>++calls===1?{rows:[{qr_id:97,campaign_id:68,placement_value:500},{qr_id:98,campaign_id:69,placement_value:750}]}:{rows:[{qr_id:99,campaign_id:null,placement_value:500}]};
 const rows=await scope.run(true,()=>active.load(q,{organizationId:13,allowedLocationIds:[36,40],selectedLocationId:null}));
 assert.deepEqual(active.summarize(rows.rows),{placements:3,campaigns:2,value:1750});assert.equal(calls,2);
 calls=0;await active.load(q,{organizationId:39,allowedLocationIds:[],selectedLocationId:null});assert.equal(calls,1);
});
