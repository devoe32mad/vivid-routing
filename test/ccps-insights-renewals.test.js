'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite'),scope=require('../ccps-demo-data-scope');
test('Performance Insights renewal query works under CCPS CTE scope and leaves other sessions unchanged',async()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../install-vivid-intelligence.js'),'utf8');
 const section=source.slice(source.indexOf('const renewalPricingResult ='));
 const query=section.slice(section.indexOf('SELECT'),section.indexOf('LIMIT 6')+7).replace(/\\\$\{eventDateSql\}/g,'').replace(/\\\$\{eventTestSql\}/g,'');
 assert.equal(scope.sqlFor(query),query);
 const db=new PGlite();try{
 await db.exec(`CREATE TABLE contracts(id int PRIMARY KEY,organization_id int,advertising_request_id int,advertiser_id int,contract_name text,total_contract_value int,end_date date,expiration_date date,qr_id int,location_id int,status text,renewed_from_contract_id int);
 CREATE TABLE organization_advertising_requests(id int,organization_id int,created_qr_id int);
 CREATE TABLE qr_codes(id int,name text);
 CREATE TABLE events(id int,qr_id int,type text,value numeric);
 INSERT INTO contracts VALUES(41,13,51,1,'Gym Banner',500,CURRENT_DATE+30,NULL,97,36,'active',NULL),(99,39,99,1,'Other demo',9000,CURRENT_DATE+30,NULL,199,99,'active',NULL);
 INSERT INTO organization_advertising_requests VALUES(51,13,97),(99,39,199);
 INSERT INTO qr_codes VALUES(97,'Gym Banner'),(199,'Other demo');
 INSERT INTO events VALUES(1,97,'scan',0),(2,97,'conversion',100),(3,199,'scan',0);`);
 const result=await scope.run(true,()=>db.query(scope.sqlFor(query),[13,[36,40],null]));
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].contract_name,'Gym Banner');assert.equal(result.rows[0].scans,1);assert.equal(result.rows[0].conversions,1);assert.equal(Number(result.rows[0].revenue),100);
 assert.equal(scope.sqlFor(query),query);
 }finally{await db.close();}
});
