'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const store=require('../responsibility-store'),routes=require('../responsibility-routes');
const scope={organizationId:1,dataset:'live',canEdit:true,allowedLocationIds:[10],locations:[{id:10,name:'Main'}]};
function fixture(){return store.buildModel([{id:1,title:'Print ad',space_id:10,program_id:4,status:'Sold',price:100},{id:2,title:'Banner',space_id:10,status:'Available',price:200},{id:3,title:'Booth',space_id:10,status:'Pending',price:300}],[{id:11,opportunity_id:1,status:'Approved',price:100},{id:12,opportunity_id:3,status:'Pending',price:350}],[{id:21,advertising_request_id:11,status:'Active',total_contract_value:125,renewal_date:'2026-11-12'},{id:22,renewed_from_contract_id:21,status:'Draft',total_contract_value:150}],[],[],'2026-10-13');}
test('lifecycle links share one owner and aggregate once; renewals stay separate',()=>{const m=fixture();assert.equal(m.entities.get('contract:22').root,'opportunity:1');assert.equal(m.roots.length,3);assert.equal(m.roots[0].status,'approved');assert.equal(m.roots[0].value,125);assert.equal(m.roots[0].renewals.length,1);assert.equal(routes.stageRows(m.roots,'approved',{}).length,1);assert.equal(routes.stageRows(m.roots,'pending',{})[0].value,350);assert.equal(routes.stageRows(m.roots,'available',{})[0].value,200);assert.equal(routes.stageRows(m.roots,'renewals',{start_date:'2026-12-01'}).length,0);});
test('renewal ownership survives missing direct opportunity links and cycles terminate',()=>{const m=store.buildModel([],[],[{id:2,renewed_from_contract_id:1},{id:1,renewed_from_contract_id:2}],[],[]);assert.equal(m.entities.size,2);});
test('report validates foreign location, rep, program and invalid dates',()=>{const m=fixture();for(const query of [{location_id:'99'},{rep_id:'99'},{program_id:'99'},{start_date:'2026-02-30'},{start_date:'2026-12-01',end_date:'2026-01-01'}])assert.throws(()=>routes.filterRows(m,query,scope));});
test('database persists ownership, enforces tenant rep isolation, versions and atomic history',async()=>{
 const db=new PGlite();try{await db.exec('CREATE TABLE organizations(id integer PRIMARY KEY); CREATE TABLE users(id integer PRIMARY KEY); INSERT INTO organizations VALUES(1),(2);');await db.exec(store.SCHEMA);const q=(s,p)=>db.query(s,p);
 await q("INSERT INTO organization_sales_reps(organization_id,name) VALUES(1,'Jane Doe'),(2,'Bill Smith')");const root={kind:'opportunity',id:7};
 const form={rep_id:'1',version:'0',next_action:'Call advertiser',due_date:'2026-10-20',follow_up_status:'In progress'};
 assert.equal((await store.save(q,scope,root,form,'Alice')).version,1);
 await assert.rejects(()=>store.save(q,scope,root,form,'Bob'),e=>e.status===409);
 await assert.rejects(()=>store.save(q,scope,root,{...form,version:1,rep_id:2},'Bob'),e=>e.status===403);
 await assert.rejects(()=>store.save(q,{...scope,canEdit:false},root,{...form,version:1},'Reader'),e=>e.status===403);
 await assert.rejects(()=>q("UPDATE organization_responsibility SET rep_id=2 WHERE organization_id=1"));
 await store.save(q,scope,root,{...form,version:1,rep_id:''},'Bob');
 const rows=(await q('SELECT * FROM organization_responsibility')).rows;assert.equal(rows.length,1);assert.equal(rows[0].version,2);assert.equal(rows[0].rep_id,null);
 assert.equal((await q('SELECT * FROM organization_responsibility_audit ORDER BY version')).rows.length,2);
 }finally{await db.close();}
});
test('normal access revalidates membership and demo session cannot bypass verification',async()=>{
 await assert.rejects(()=>routes.access({query:{},session:{ccpsReview:{},orgUser:{organization_id:13,id:10}}},()=>{throw Error('must not query');}),e=>e.status===403);
 await assert.rejects(()=>routes.access({query:{organization_id:'2'},session:{orgUser:{organization_id:1,id:4}}},()=>{throw Error('must not query');}),e=>e.status===403);
 await assert.rejects(()=>routes.access({query:{},session:{orgUser:{organization_id:1,id:4}}},async()=>({rows:[]})),e=>e.status===403);
});
test('installer is idempotent and inserts explicit inventory/renewal markers',()=>{const fs=require('fs'),install=require('../install-responsibility').install;const source=fs.readFileSync(require.resolve('../server.js'),'utf8');const result=install(source);assert.equal(install(result),result);assert.match(result,/data-responsibility-kind="opportunity"/);assert.match(result,/data-responsibility-kind="contract"/);});
test('HTTP report, assignment save and renewal reload use persisted tenant-scoped records',async()=>{
 const express=require('express');const db=new PGlite();let server;
 try{
 await db.exec(`CREATE TABLE organizations(id int PRIMARY KEY,name text,is_active boolean);CREATE TABLE users(id int PRIMARY KEY,account_status text);
 CREATE TABLE organization_users(organization_id int,user_id int,role text,is_active boolean);
 CREATE TABLE spaces(id int,organization_id int,name text,is_archived boolean);CREATE TABLE location_users(space_id int,user_id int,is_active boolean);
 CREATE TABLE organization_programs(id int,organization_id int,name text);
 CREATE TABLE organization_opportunities(id int,organization_id int,space_id int,program_id int,title text,status text,price numeric,is_active boolean,created_at timestamptz);
 CREATE TABLE organization_advertising_requests(id int,organization_id int,location_id int,opportunity_id int,business_name text,status text,price numeric,created_at timestamptz);
 CREATE TABLE advertisers(id int,organization_id int,name text);
 CREATE TABLE contracts(id int,organization_id int,location_id int,advertiser_id int,opportunity_id int,advertising_request_id int,renewed_from_contract_id int,status text,total_contract_value numeric,renewal_date date,created_at timestamptz);
 INSERT INTO organizations VALUES(1,'Magazine',true),(2,'Other',true); INSERT INTO users VALUES(4,'active'); INSERT INTO organization_users VALUES(1,4,'owner',true);
 INSERT INTO spaces VALUES(10,1,'October',false),(20,2,'Private',false);INSERT INTO organization_programs VALUES(4,1,'Print');
 INSERT INTO organization_opportunities VALUES(7,1,10,4,'Full page','Sold',500,true,now()),(8,2,20,NULL,'Private','Available',1000,true,now());
 INSERT INTO organization_advertising_requests VALUES(11,1,10,7,'Acme','Approved',500,now());
 INSERT INTO contracts VALUES(21,1,10,NULL,NULL,11,NULL,'Active',550,'2026-11-12',now()),(22,1,10,NULL,NULL,NULL,21,'Draft',600,'2027-11-12',now());`);
 await db.exec(store.SCHEMA);await db.exec("INSERT INTO organization_sales_reps(organization_id,name) VALUES(1,'Jane Doe'),(2,'Bill Smith')");
 const session={orgUser:{id:4,organization_id:1,email:'owner@example.test'}};
 const app=express();app.use(express.urlencoded({extended:false}));app.use((req,res,next)=>{req.session=session;next();});routes.register(app,{q:(s,p)=>db.query(s,p)});
 server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});const base='http://127.0.0.1:'+server.address().port;
 let response=await fetch(base+'/org-sales-reps?organization_id=1');let body=await response.text();assert.equal(response.status,200);assert.match(body,/Full page/);assert.doesNotMatch(body,/Private/);assert.match(body,/\$550/);
 response=await fetch(base+'/org-responsibility?organization_id=1&kind=contract&id=22');body=await response.text();assert.equal(response.status,200);assert.match(body,/name="kind" value="opportunity"/);
 const input={csrf:session.responsibilityCsrf,kind:'contract',id:'22',rep_id:'1',version:'0',next_action:'Renew October ad',follow_up_status:'In progress',due_date:'2026-10-20'};
 response=await fetch(base+'/org-responsibility/save?organization_id=1',{method:'POST',body:new URLSearchParams({...input,csrf:'invalid'}),redirect:'manual'});assert.equal(response.status,403);
 response=await fetch(base+'/org-responsibility/save?organization_id=1',{method:'POST',body:new URLSearchParams(input),redirect:'manual'});assert.equal(response.status,302);
 response=await fetch(base+'/org-responsibility?organization_id=1&kind=request&id=11');body=await response.text();assert.match(body,/Responsible party: <strong>Jane Doe/);assert.match(body,/Renew October ad/);assert.match(body,/Revision 1/);
 response=await fetch(base+'/org-responsibility?organization_id=1&kind=opportunity&id=8');assert.equal(response.status,404);
 response=await fetch(base+'/org-sales-reps?organization_id=2');assert.equal(response.status,403);
 await db.exec("UPDATE organization_users SET role='viewer'");response=await fetch(base+'/org-responsibility/save?organization_id=1',{method:'POST',body:new URLSearchParams({...input,version:'1'}),redirect:'manual'});assert.ok([403,404].includes(response.status));assert.equal((await db.query('SELECT version FROM organization_responsibility')).rows[0].version,1);
 }finally{if(server)await new Promise(r=>server.close(r));await db.close();}
});
