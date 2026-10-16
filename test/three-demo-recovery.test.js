'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const navigation=require('../demo-portal-navigation');
navigation.configure(({organizationId,queryString})=>'<nav style="position:sticky"><a href="/org-locations?'+queryString+'">Locations '+organizationId+'</a></nav>');
function render(req,html){let result;const res={send(body){result=body;}};navigation.attach({method:'GET',query:{},session:{},...req},res);res.send(html);return result;}
test('verified demos retain scoped organization navigation without changing normal pages or duplicating native navigation',()=>{
 const html='<html><body><main>Locations</main></body></html>';
 assert.equal(render({path:'/org-locations'},html),html);
 for(const [flag,id]of [['hfhsReviewVerified',39],['ccpsReviewVerified',13],['rubberWorldReviewVerified',40]]){
  const req={path:'/org-locations',[flag]:true,query:{from:'2026-09-14',to:'2026-10-13'},session:{rubberWorldReview:{org:40}}};
  const body=render(req,html);assert.match(body,new RegExp('organization_id='+id));assert.match(body,/from=2026-09-14/);assert.match(body,/data-demo-portal-navigation/);
  const native=html.replace('<main>','<nav style="position:sticky">Existing</nav><main>');assert.equal(render(req,native),native);
 }
 assert.equal(render({path:'/advertise/ccps',ccpsReviewVerified:true},html),html);
 assert.equal(render({path:'/org-locations',ccpsReviewVerified:true},'%PDF-1.3'),'%PDF-1.3');
});
test('advertiser reports keep report navigation and escaped date filters',()=>{
 const body=render({path:'/reports-campaign',hfhsReviewVerified:true,query:{start_date:'2026-10-01',end_date:'2026-10-13'}},'<body><h1>Reports</h1></body>');
 assert.match(body,/aria-label="Advertiser navigation"/);assert.match(body,/aria-current="page" href="\/reports-campaign/);assert.match(body,/start_date=2026-10-01&amp;end_date=2026-10-13/);assert.doesNotMatch(body,/organization_id=13/);
});
test('CCPS campaign report executes its real grouped SQL against the scoped PostgreSQL read model',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),scope=require('../ccps-demo-data-scope'),db=new PGlite();
 try{
  await db.exec(`CREATE TABLE contracts(id int,organization_id int,advertising_request_id int);
  CREATE TABLE organization_advertising_requests(id int,organization_id int,created_qr_id int,business_name text,contact_name text,email text);
  CREATE TABLE campaigns(id int PRIMARY KEY,user_id int,advertiser_id int,advertiser text,name text,avg_customer_value numeric,is_archived boolean,start_date date,end_date date,created_at timestamp);
  CREATE TABLE qr_campaigns(qr_id int,campaign_id int,is_active boolean);
  CREATE TABLE events(id int,qr_id int,campaign_id int,type text,value numeric,created_at timestamp);
  INSERT INTO contracts VALUES(41,13,51),(42,13,52);
  INSERT INTO organization_advertising_requests(id,organization_id,created_qr_id) VALUES(51,13,97),(52,13,98);
  INSERT INTO campaigns VALUES(68,10,1,'Original','Original',100,false,'2026-09-14','2026-10-13','2026-09-14'),(69,10,2,'Original','Original',100,false,'2026-09-14','2026-10-13','2026-09-14'),(99,20,3,'Other','Other',100,false,'2026-09-14','2026-10-13','2026-09-14');
  INSERT INTO qr_campaigns VALUES(97,68,true),(98,69,true);
  INSERT INTO events VALUES(1,97,68,'scan',0,'2026-10-01'),(2,98,69,'conversion',100,'2026-10-01');`);
  const source=fs.readFileSync(require.resolve('../server.js'),'utf8'),start=source.indexOf('app.get("/reports-campaign"'),section=source.slice(start,source.indexOf('\napp.',start+1));
  const sql=section.match(/const rows = await q\(`([\s\S]*?)`, params\)/)[1];
  const query=Function('startDate','endDate','userWhere','return `'+sql+'`;')('2026-09-14','2026-10-13','AND c.user_id = $1');
  const result=await scope.run(true,()=>db.query(scope.sqlFor(query),[10]));
  assert.deepEqual(result.rows.map(r=>r.campaign_id),[69,68]);assert.equal(Number(result.rows[0].conversion_value),100);assert.equal(Number(result.rows[1].scans),1);
  assert.equal(scope.sqlFor(query),query);
 }finally{await db.close();}
});
test('demo PDF font embeds sponsor names, ligatures, punctuation and report symbols',async()=>{
 const PDFDocument=require('pdfkit'),doc=new PDFDocument(),chunks=[];
 const done=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',resolve);doc.on('error',reject);});
 doc.font(require('../install-hfhs-report-scope').reportFont());
 doc.text('Henry Ford Health • CCPS • Rubber World — Office affiliation ﬁ ﬂ ﬃ ﬄ · ≥ ≤ → ← $1,234.56 — Café');doc.end();await done;
 assert.ok(Buffer.concat(chunks).subarray(0,4).equals(Buffer.from('%PDF')));assert.ok(Buffer.concat(chunks).length>5000);
});
