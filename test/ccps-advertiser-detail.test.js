'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {PGlite}=require('@electric-sql/pglite');
const detail=require('../ccps-advertiser-detail'),scope=require('../ccps-demo-data-scope');
test('Coastal detail reconciles two contracts without exposing another sponsor or campaign',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE TABLE contracts(id int,organization_id int,advertising_request_id int,advertiser_id int,contract_name text,total_contract_value int,location_id int,status text);
 CREATE TABLE organization_advertising_requests(id int,organization_id int,created_qr_id int,business_name text,contact_name text,email text);
 CREATE TABLE qr_codes(id int,name text,is_active boolean,is_archived boolean);
 CREATE TABLE spaces(id int,organization_id int,name text,location text,is_archived boolean);
 INSERT INTO contracts VALUES(41,13,51,1,'Gym Banner',500,36,'active'),(43,13,53,1,'Stadium Fence Banner',500,36,'active'),(42,13,52,1,'Outdoor',750,40,'active'),(99,39,99,1,'Other demo',9000,99,'active');
 INSERT INTO organization_advertising_requests(id,organization_id,created_qr_id) VALUES(51,13,97),(53,13,99),(52,13,98),(99,39,199);
 INSERT INTO qr_codes VALUES(97,'Gym',true,false),(99,'Stadium',true,false),(98,'Outdoor',true,false),(199,'Other demo',true,false);
 INSERT INTO spaces VALUES(36,13,'Barron Collier','Naples',false),(40,13,'Gulf Coast','Naples',false),(99,39,'Other demo','Elsewhere',false);`);
 const qrResult={rows:[{id:97,location_id:36,placement_value:500}]},locationResult={rows:[{id:36,campaigns:1,qr_placements:1}]};
 await scope.run(true,()=>detail.reconcile((sql,p)=>db.query(scope.sqlFor(sql),p),{organizationId:13,advertiserId:1300041,locationIds:[36,40],qrResult,locationResult}));
 assert.deepEqual(qrResult.rows.map(r=>[r.id,r.contract_id,r.placement_value]),[[97,41,500],[99,43,500]]);
 assert.equal(locationResult.rows[0].qr_placements,2);assert.equal(locationResult.rows[0].campaigns,1);
 assert.equal((await db.query('SELECT advertiser_id FROM contracts WHERE id=41')).rows[0].advertiser_id,1);
 }finally{await db.close();}
});
test('installer preserves ordinary behavior and compiles with the full CCPS installer',()=>{
 const original=fs.readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
 const patched=detail.install(original);new vm.Script(patched);
 assert.equal(detail.install(patched),patched);
 assert.ok(patched.includes('req.ccpsReviewVerified ? "" : "LIMIT 1"'));
 assert.ok(patched.includes('req.ccpsReviewVerified ? currentContractResult.rows : [currentContract]'));
 new vm.Script(require('../ccps-review-access').install(original));
});
