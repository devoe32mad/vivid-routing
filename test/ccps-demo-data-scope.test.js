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
 const q=sql=>db.query(scope.sqlFor(sql));
 await scope.run(true,async()=>{
 assert.deepEqual((await q('SELECT count(*)::int n,sum(total_contract_value)::int value FROM contracts')).rows,[{n:3,value:1750}]);
 assert.deepEqual((await q('SELECT count(*)::int n,sum(total_cost)::int value FROM qr_codes')).rows,[{n:3,value:1750}]);
 assert.equal((await q('SELECT * FROM contracts WHERE id=9')).rows.length,0);
 assert.equal((await q('WITH totals AS (SELECT count(*)::int n FROM events) SELECT * FROM totals')).rows[0].n,3);
 assert.equal((await q('SELECT * FROM campaigns')).rows.length,2);
 assert.equal((await q('SELECT * FROM organization_advertising_requests')).rows.length,3);
 });
 assert.equal((await q('SELECT * FROM contracts')).rows.length,5);
 await Promise.all([scope.run(true,async()=>{await new Promise(r=>setTimeout(r,5));assert.match(scope.sqlFor('SELECT * FROM contracts'),/^WITH/);}),scope.run(false,async()=>{await new Promise(r=>setTimeout(r,10));assert.equal(scope.sqlFor('SELECT * FROM contracts'),'SELECT * FROM contracts');})]);
 assert.equal(scope.run(true,()=>scope.sqlFor('UPDATE contracts SET total_contract_value=1')),'UPDATE contracts SET total_contract_value=1');
 }finally{await db.close();}
});
