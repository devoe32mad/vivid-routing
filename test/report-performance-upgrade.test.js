"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const helper=require('../report-performance-upgrade');
test('report return permits only report paths and date filters',()=>{
 assert.equal(helper.reportReturn('/reports-qr?start_date=2026-10-01&end_date=2026-10-07&x=bad'),'/reports-qr?start_date=2026-10-01&end_date=2026-10-07');
 for(const s of ['https://evil.test','//evil.test','/admin/users','/\\evil.test','/reports?start_date=<script>'])assert.equal(helper.reportReturn(s),'/reports');
});
test('inline CTA targets one placement, deduplicates campaigns and renders pending state',()=>{
 const row={qr_id:97,qr_name:'Gym <Banner>',location_id:36,location_name:'School',campaign_id:68,status:'active'};
 const state={rows:[row,{...row,campaign_id:69}],csrf:'safe',returnTo:'/reports-qr?start_date=2026-10-01'};
 const html=helper.render(state,'location_id',36);
 assert.equal((html.match(/<form/g)||[]).length,1);assert.match(html,/value="97"/);assert.match(html,/Gym &lt;Banner&gt;/);assert.match(html,/\$35\/month/);
 assert.equal(helper.render(state,'campaign_id',70),'');
 assert.doesNotMatch(helper.render({...state,rows:[{...row,status:'upgrade_requested'}]},'qr_id',97),/<form/);
});
test('real database scopes upgrade offers to account and only Basic placements',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try{
 await db.exec(`CREATE TABLE users(id INT,advertiser_customer_id INT);CREATE TABLE spaces(id INT,user_id INT,name TEXT);CREATE TABLE qr_codes(id INT,space_id INT,name TEXT);CREATE TABLE qr_campaigns(qr_id INT,campaign_id INT,is_active BOOLEAN);CREATE TABLE organization_advertising_requests(created_qr_id INT,created_vivid_user_id INT,status TEXT);CREATE TABLE sponsorship_performance_plans(qr_id INT,plan TEXT,status TEXT);
 INSERT INTO users VALUES(10,NULL),(11,10),(20,NULL);INSERT INTO spaces VALUES(36,99,'School');INSERT INTO qr_codes VALUES(97,36,'Gym'),(98,36,'Fence'),(99,36,'Other');INSERT INTO qr_campaigns VALUES(97,68,true),(98,69,true),(99,70,true);INSERT INTO organization_advertising_requests VALUES(97,11,'Approved'),(98,10,'Approved'),(99,20,'Approved');INSERT INTO sponsorship_performance_plans VALUES(97,'basic','active'),(98,'performance','active'),(99,'basic','active');`);
 const req={session:{user:{id:10,login_user_id:11,role:'customer'}},originalUrl:'/reports-location?start_date=2026-10-01'};
 const state=await helper.load({q:(s,p)=>db.query(s,p),req});assert.deepEqual(state.rows.map(r=>r.qr_id),[97]);assert.equal(state.csrf.length,64);assert.match(state.returnTo,/start_date/);
 const routes={};require('../sponsorship-performance-plan').registerSponsorshipPerformanceRoutes({app:{get:(path,...f)=>routes['GET '+path]=f.at(-1),post:(path,...f)=>routes['POST '+path]=f.at(-1)},q:async(sql,args)=>{
   if(sql.includes('CREATE TABLE')||sql.includes('AS advertiser_email'))return {rows:[]};
   return db.query(sql,args);
 },requireLogin:()=>{},page:(t,b)=>b});
 await db.exec('ALTER TABLE sponsorship_performance_plans ADD COLUMN upgrade_requested_at TIMESTAMPTZ;ALTER TABLE sponsorship_performance_plans ADD COLUMN updated_at TIMESTAMPTZ;');
 let status,redirect,body;const res={status(n){status=n;return this},send(s){body=s;return this},redirect(n,s){status=n;redirect=s;return this}};
 const post=routes['POST /admin/sponsorship-performance/upgrade'];
 await post({...req,body:{qr_id:99,csrf:state.csrf,return_to:state.returnTo}},res);assert.equal(status,404);
 await post({...req,body:{qr_id:97,csrf:'bad',return_to:state.returnTo}},res);assert.equal(status,403);
 await post({...req,body:{qr_id:97,csrf:state.csrf,return_to:state.returnTo}},res);assert.equal(status,303);assert.equal(redirect,state.returnTo);
 assert.equal((await db.query('SELECT status FROM sponsorship_performance_plans WHERE qr_id=97')).rows[0].status,'upgrade_requested');
 assert.equal((await db.query('SELECT status FROM sponsorship_performance_plans WHERE qr_id=99')).rows[0].status,'active');
 await routes['GET /admin/sponsorship-performance'](req,res);assert.equal(redirect,'/reports');
 }finally{await db.close();}
});
test('startup installers retain original report routes and integrate all four report tables',()=>{
 const source=fs.readFileSync(require.resolve('../server.js'),'utf8');
 const install=require('../install-sponsorship-performance-plans').install;
 const out=install(source);assert.equal(install(out),out);
 const guard=out.slice(out.indexOf('const basicLockedRoutes='),out.indexOf(']);',out.indexOf('const basicLockedRoutes=')));
 for(const route of ['/reports','/reports-qr','/reports-location'])assert.ok(!guard.includes('"'+route+'"'));
 assert.equal((out.match(/render\(performanceUpgrade,/g)||[]).length,4);
 fs.writeFileSync('/tmp/vivid-report-upgrade-server.js',out);
});
