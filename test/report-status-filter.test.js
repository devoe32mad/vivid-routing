'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {PGlite}=require('@electric-sql/pglite');
let source=fs.readFileSync(require.resolve('../server.js'),'utf8');
source=require('../install-sponsorship-performance-plans').install(source);
source=require('../install-website-page-tracking').install(source);
test('report filters select active, archived, or all owned records and preserve navigation',async()=>{
 const db=new PGlite();
 await db.exec(`CREATE TABLE spaces(id INT,name TEXT,location TEXT,user_id INT,is_archived BOOLEAN);
 CREATE TABLE qr_codes(id INT,name TEXT,space_id INT,is_archived BOOLEAN);
 CREATE TABLE campaigns(id INT PRIMARY KEY,name TEXT,advertiser TEXT,user_id INT,is_archived BOOLEAN,avg_customer_value NUMERIC,start_date DATE,end_date DATE,created_at TIMESTAMP);
 CREATE TABLE qr_campaigns(qr_id INT,campaign_id INT,is_active BOOLEAN);
 CREATE TABLE events(id INT,qr_id INT,campaign_id INT,type TEXT,value NUMERIC,created_at TIMESTAMP);
 INSERT INTO spaces VALUES (1,'Live location','City',7,false),(2,'Old location','City',7,true),(3,'Private location','City',8,false);
 INSERT INTO qr_codes VALUES (1,'Live QR',1,false),(2,'Old QR',2,true),(3,'Private QR',3,false);
 INSERT INTO campaigns VALUES (1,'Live campaign','Customer',7,false,0,null,null,now()),(2,'Old campaign','Customer',7,true,0,null,null,now()),(3,'Private campaign','Other',8,false,0,null,null,now());
 INSERT INTO qr_campaigns VALUES (1,1,true),(2,2,true),(3,3,true);`);
 try{
 for(const route of ['/reports','/reports-campaign','/reports-qr','/reports-location']){
  const start=source.indexOf(`app.get("${route}", requireLogin`),end=source.indexOf('\napp.',start+1);
  for(const status of [undefined,'active','archived','all',"bad' OR true"]){
   let handler,html,webQuery,exportStatus;
   const context={app:{get:(_p,_m,h)=>{handler=h}},requireLogin:()=>{},console,URLSearchParams,
    q:(sql,params)=>db.query(sql,params),money:n=>String(n||0),pct:n=>String(n||0),page:(_t,s)=>s,
    allocatedSpotCostForQr:async()=>0,allocatedSpotCostForCampaign:async()=>0,
    buildExportReportRows:async(_r,_s,_e,_l,_q,_c,st)=>{exportStatus=st;return (await db.query("SELECT name AS \"campaignName\", CASE WHEN is_archived THEN 'Archived' ELSE 'Active' END AS status FROM campaigns WHERE user_id=7 AND ($1='all' OR is_archived=($1='archived'))",[st])).rows},
    require:n=>n==='./report-performance-upgrade'?{load:async()=>({rows:[]}),render:()=>'',intro:()=>'',maskRow:(_s,_k,_i,_n,row)=>row}:{load:async({query})=>{webQuery=query;return{}},renderSection:()=>'',count:()=>0}};
   vm.runInNewContext(source.slice(start,end),context);
   await handler({query:{status,start_date:'2026-09-01',end_date:'2026-10-08'},session:{user:{id:7,role:'customer'}}},{send:s=>{html=s}});
   const selected=['active','archived','all'].includes(status)?status:'active';
   assert.doesNotMatch(html,/REPORT ERROR|Private/);assert.match(html,new RegExp(`value="${selected}" selected`));
   assert.equal(html.includes('Live '+(route==='/reports-qr'?'QR':route==='/reports-location'?'location':'campaign')),selected!=='archived');
   assert.equal(html.includes('Old '+(route==='/reports-qr'?'QR':route==='/reports-location'?'location':'campaign')),selected!=='active');
   assert.equal(webQuery.status,selected);if(route==='/reports')assert.equal(exportStatus,selected);
   if(route!=='/reports-campaign')assert.match(html,new RegExp('status='+selected+'&amp;start_date=2026-09-01&amp;end_date=2026-10-08'));
  }
 }
 assert.equal(require('../install-report-status-filter').install(source),source);
 }finally{await db.close()}
});
test('website pages and export filters follow the selected entity archive state',async()=>{
 const db=new PGlite(),reporting=require('../website-page-reporting');
 await db.exec(`CREATE TABLE campaigns(id INT PRIMARY KEY,user_id INT,name TEXT,advertiser TEXT,is_archived BOOLEAN);
 CREATE TABLE spaces(id INT PRIMARY KEY,is_archived BOOLEAN);
 CREATE TABLE qr_codes(id INT PRIMARY KEY,space_id INT,is_archived BOOLEAN);
 CREATE TABLE qr_campaigns(qr_id INT,campaign_id INT);
 CREATE TABLE events(id INT PRIMARY KEY);
 INSERT INTO campaigns VALUES (1,7,'Example','Customer',false),(2,8,'Private','Other',true);
 INSERT INTO spaces VALUES (1,false),(2,true);
 INSERT INTO qr_codes VALUES (1,1,false),(2,2,true);
 INSERT INTO qr_campaigns VALUES (1,1),(2,1),(2,2);
 INSERT INTO events VALUES (1),(2),(3);`);
 const q=(sql,p)=>sql.includes('FROM sponsorship_performance_plans')?Promise.resolve({rows:[]}):db.query(sql,p);
 try{
 await require('../website-page-tracking').createTracker(q).ensureSchema();
 await db.exec(`INSERT INTO campaign_website_visits(scan_event_id,campaign_id,qr_id,vivid_click_id,page_url,page_name,created_at) VALUES
 (1,1,1,'a','https://example.com/live','Live','2026-10-01'),(2,1,2,'b','https://example.com/old','Old','2026-10-01'),(3,2,2,'c','https://private.example','Private','2026-10-01');`);
 for(const status_scope of ['qr','location','campaign'])for(const status of ['active','archived','all']){
  const r=await reporting.load({q,user:{id:7,role:'customer'},query:{start_date:'2026-09-01',end_date:'2026-10-08',status,status_scope}});
  assert.equal(r.total,status_scope==='campaign'?(status==='archived'?0:2):(status==='all'?2:1));
  assert.doesNotMatch(JSON.stringify(r),/Private/);
  assert.match(reporting.renderSection(r),new RegExp('status='+status+'&amp;status_scope='+status_scope));
  if(status_scope!=='campaign'&&status!=='all')assert.equal(r.rows[0].qr_id,status==='active'?1:2);
 }
 assert.equal(require('../report-performance-upgrade').reportReturn('/reports?status=archived'),'/reports?status=archived');
 }finally{await db.close()}
});
