const test=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {jobs,MAIN,initialActions,register}=require('../hexpol-careers');
const {seed}=require('../seed-hexpol-careers');
test('27 unique verified ADP destinations and routing isolated to QR125/campaign88',()=>{
 assert.equal(jobs.length,27);assert.equal(new Set(jobs.map(j=>j.url)).size,27);
 for(const j of jobs)assert.equal(new URL(j.url).searchParams.get('reqId'),j.reqId);
 const actions=[{id:1,destination_url:MAIN},{id:2,destination_url:jobs[0].url}];
 assert.deepEqual(initialActions(125,88,actions),[actions[0]]);
 assert.equal(initialActions(124,88,actions),actions);assert.equal(initialActions(125,87,actions),actions);
});
test('seed inserts exactly 27, preserves other campaigns and stays one-time',async()=>{
 const db=new PGlite();
 await db.exec(`CREATE TABLE campaigns(id int primary key,name text,advertiser text);
 CREATE TABLE qr_campaigns(campaign_id int,qr_id int,is_active bool);
 CREATE TABLE qr_codes(id int,space_id int);
 CREATE TABLE campaign_destinations(id serial primary key,campaign_id int,name text,destination_type text,destination_url text,estimated_value numeric,display_order int,is_active bool);
 INSERT INTO campaigns VALUES(88,'Online Job Listings','Hexpol'),(89,'HFHS','HFHS');
 INSERT INTO qr_codes VALUES(125,148); INSERT INTO qr_campaigns VALUES(88,125,true);`);
 await db.query('INSERT INTO campaign_destinations(campaign_id,destination_url,is_active) VALUES(88,$1,true),(89,$2,true)',[MAIN,'https://example.com/hfhs']);
 const client={query:(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(sql,args)};
 assert.equal((await seed(client)).inserted,27);
 assert.equal((await db.query('SELECT * FROM campaign_destinations WHERE campaign_id=88')).rows.length,28);
 assert.equal((await db.query('SELECT * FROM campaign_destinations WHERE campaign_id=89')).rows.length,1);
 await db.query('UPDATE campaign_destinations SET is_active=false WHERE destination_url=$1',[jobs[0].url]);
 assert.equal((await seed(client)).alreadyApplied,true);
 assert.equal((await db.query('SELECT is_active FROM campaign_destinations WHERE destination_url=$1',[jobs[0].url])).rows[0].is_active,false);
 await db.close();
});
test('job route validates IDs and uses fixed campaign destination',async()=>{
 const routes={};let queries=0;
 register({get:(path,fn)=>routes[path]=fn},async(sql,args)=>{queries++;assert.deepEqual(args,[jobs[0].url]);assert.match(sql,/cd.campaign_id=88/);return {rows:[{id:900}]};});
 const res={status(n){this.code=n;return this},send(t){this.body=t;return this},set(){return this},redirect(t){this.target=t;return this}};
 const route=routes['/hexpol-careers/job/:requisition'];
 await route({params:{requisition:'bad'},query:{}},res);assert.equal(res.code,404);assert.equal(queries,0);
 await route({params:{requisition:jobs[0].requisition},query:{vivid_click_id:'bad'}},res);assert.equal(res.code,400);assert.equal(queries,0);
 await route({params:{requisition:jobs[0].requisition},query:{}},res);assert.equal(res.target,'/destination-click/900?qr_id=125');
});
test('ADP helper retains QR attribution, ignores ordinary visits and unknown jobs',()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const code=fs.readFileSync(require('node:path').join(__dirname,'../public/vivid-hexpol-careers.js'),'utf8');
 const id='12345678-1234-4234-8234-123456789012',storage=new Map();
 function load(query=''){
  const location={hostname:'myjobs.adp.com',pathname:'/hexpolexternalcareersite/cx/job-listing',href:MAIN+query,assign(url){this.target=url}};
  const ctx={location,URL,Date,window:{},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
  vm.runInNewContext(code,ctx);return ctx;
 }
 let ctx=load();assert.equal(ctx.window.VividHexpolCareers.openJob(jobs[0].reqId),false);
 ctx=load('?vivid_click_id='+id);assert.equal(ctx.window.VividHexpolCareers.openJob(jobs[0].reqId),true);
 assert.match(ctx.location.target,new RegExp('/26-1039\\?vivid_click_id='+id+'$'));
 ctx=load();assert.equal(ctx.window.VividHexpolCareers.openJob('unknown'),false);
 assert.ok(ctx.window.VividHexpolCareers.trackingUrl(jobs[1].reqId).includes(id));
 storage.set('vivid-hexpol-88-click',JSON.stringify({id,at:Date.now()-86400001}));
 assert.equal(load().window.VividHexpolCareers.trackingUrl(jobs[0].reqId),null);
});
