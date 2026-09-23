"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {registerQrEditRoutes,renderQrEdit}=require('../qr-edit');
const {install}=require('../install-qr-edit');
function harness(q){
 const routes={};registerQrEditRoutes({app:{get:(p,...f)=>routes.GET=f,post:(p,...f)=>routes.POST=f},q,page:(_,body)=>body,requireLogin:(req,res,next)=>req.session.user?next():res.redirect('/login')});
 return async(method,{session={user:{id:7,role:'customer'}},id='61',body={},query={}}={})=>{
  const req={session,params:{qrId:id},body,query};const res={code:200,status(c){this.code=c;return this},set(){return this},send(b){this.body=b;return this},redirect(c,u){this.code=typeof c==='number'?c:302;this.location=u||c;return this}};
  let i=0;const next=()=>routes[method][i++]?.(req,res,next);await next();return {req,res};
 };
}
test('login and CSRF gate QR edits before database access',async()=>{
 const run=harness(()=>{throw Error('Unexpected query')});
 assert.equal((await run('GET',{session:{}})).res.location,'/login');
 assert.equal((await run('GET',{id:'-1'})).res.code,400);
 assert.equal((await run('POST',{body:{csrf:'bad'}})).res.code,403);
});
test('QR form escapes content and presents the stored date without timezone conversion',()=>{
 const html=renderQrEdit({qr:{id:61,name:'<script>x</script>',space_id:41,live_date_text:'2026-09-28',end_date_text:'2026-10-01',is_imported:true,description:'" onfocus="alert(1)'},spaces:[{id:41,name:'Hall',location:'Louisville'}],csrf:'test'});
 assert.match(html,/name="live_date" type="date" value="2026-09-28"/);assert.doesNotMatch(html,/<script>|name="end_date"/);assert.equal(html.split('Current Destination URL').length,2);
});
test('PostgreSQL QR edit preserves links/costs and blocks foreign writes, invalid dates, and stale forms',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE spaces(id INT PRIMARY KEY,user_id INT,name TEXT,location TEXT);
   CREATE TABLE qr_codes(id INT PRIMARY KEY,name TEXT,space_id INT,live_date DATE,end_date DATE,slug TEXT,description TEXT,is_imported BOOLEAN,contract_cost NUMERIC,annual_impressions INT);
   CREATE TABLE qr_campaigns(id INT PRIMARY KEY,qr_id INT,campaign_id INT,started_at DATE);
   CREATE TABLE campaign_schedules(id INT PRIMARY KEY,qr_id INT,campaign_id INT,start_time TIME,end_time TIME);
   INSERT INTO spaces VALUES(41,7,'Summit','Louisville'),(42,8,'Other','Other'),(43,7,'Second hall','Louisville');
   INSERT INTO qr_codes VALUES(61,'2026 Polymer Booth',41,'2026-09-28','2026-10-01','hexpol-qr','https://example.com',false,800,3200),(62,'Other QR',42,'2026-09-28',NULL,'other',NULL,false,500,1000);
   INSERT INTO qr_campaigns VALUES(1,61,55,'2026-09-23');INSERT INTO campaign_schedules VALUES(1,61,55,'00:00','23:59');`);
  const run=harness((s,a)=>db.query(s,a));const {req,res}=await run('GET');const session=req.session;
  assert.equal(res.code,200);assert.match(res.body,/value="2026-09-28"/);
  assert.equal((await run('GET',{id:'62'})).res.code,404);
  const version=async()=> (await db.query('SELECT xmin::text AS v FROM qr_codes WHERE id=61')).rows[0].v;
  const post=async(extra={},id='61',s=session)=>run('POST',{session:s,id,body:{csrf:session.qrEditCsrf,version:await version(),name:'2026 Polymer Booth',space_id:'41',live_date:'2026-09-23',...extra}});
  for(const date of ['2026-02-30','2026-10-02','',undefined,['2026-09-23']])assert.equal((await post({live_date:date})).res.code,400);
  assert.equal((await post({},'62')).res.code,404); // Cannot steal another owner's QR by selecting an owned location.
  assert.equal((await post({space_id:'42'})).res.code,409);
  const before=(await db.query('SELECT id,space_id,slug,description,end_date::text,contract_cost,annual_impressions FROM qr_codes WHERE id=61')).rows;
  const links=(await db.query('SELECT * FROM qr_campaigns')).rows,schedules=(await db.query('SELECT * FROM campaign_schedules')).rows;
  const saved=await post({end_date:'2040-01-01',slug:'changed',contract_cost:0,campaign_id:99});assert.equal(saved.res.code,303);
  assert.equal((await db.query('SELECT live_date::text AS d FROM qr_codes WHERE id=61')).rows[0].d,'2026-09-23');
  assert.deepEqual((await db.query('SELECT id,space_id,slug,description,end_date::text,contract_cost,annual_impressions FROM qr_codes WHERE id=61')).rows,before);
  assert.deepEqual((await db.query('SELECT * FROM qr_campaigns')).rows,links);assert.deepEqual((await db.query('SELECT * FROM campaign_schedules')).rows,schedules);
  assert.match((await run('GET',{session,query:{saved:'1'}})).res.body,/QR changes saved/);
  const stale=await version();await db.exec("UPDATE qr_codes SET name='Updated elsewhere' WHERE id=61");assert.equal((await post({version:stale})).res.code,409);
  assert.equal((await post({space_id:'43'})).res.code,303); // Existing owned location editing still works.
  const racing=harness(async(s,a)=>{if(s.startsWith('UPDATE qr_codes qr'))await db.exec('UPDATE spaces SET user_id=8 WHERE id=43');return db.query(s,a)});
  assert.equal((await racing('POST',{session,body:{csrf:session.qrEditCsrf,version:await version(),name:'Booth',space_id:'41',live_date:'2026-09-24'}})).res.code,409);
  const admin={user:{id:1,role:'super_admin'}};await run('GET',{session:admin,id:'62'});const av=(await db.query('SELECT xmin::text AS v FROM qr_codes WHERE id=62')).rows[0].v;
  assert.equal((await run('POST',{session:admin,id:'62',body:{csrf:admin.qrEditCsrf,version:av,name:'Other QR',space_id:'42',live_date:'2026-09-23'}})).res.code,303);
 }finally{await db.close()}
});
test('installer replaces both legacy QR handlers and is idempotent',()=>{
 const fs=require('node:fs');const source=fs.readFileSync(require.resolve('../server.js'),'utf8');const updated=install(source);
 assert.equal(install(updated),updated);assert.doesNotMatch(updated,/app\.(get|post)\("\/admin\/edit-qr\/:qrId"/);assert.match(updated,/registerQrEditRoutes/);assert.match(updated,/"\/admin\/qr-setup-choice"/);
});
