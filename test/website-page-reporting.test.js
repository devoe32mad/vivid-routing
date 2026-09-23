"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const {createRequire}=require("node:module"),{PassThrough}=require("node:stream"),{once}=require("node:events");
const reporting=require("../website-page-reporting"),{createTracker}=require("../website-page-tracking"),{install}=require("../install-website-page-tracking");
const user={id:7,role:"customer"},query={start_date:"2026-09-23",end_date:"2026-09-23"};
async function fixture(){
  const {PGlite}=require("@electric-sql/pglite"),db=new PGlite();
  await db.exec(`SET TIME ZONE 'America/Los_Angeles';
    CREATE TABLE campaigns(id INT PRIMARY KEY,user_id INT,name TEXT,advertiser TEXT,is_archived BOOLEAN);
    CREATE TABLE qr_codes(id INT PRIMARY KEY,space_id INT);
    CREATE TABLE qr_campaigns(qr_id INT,campaign_id INT);
    CREATE TABLE events(id INT PRIMARY KEY,qr_id INT,campaign_id INT,type TEXT,value NUMERIC);
    INSERT INTO campaigns VALUES (55,7,'Customer-Tracking','Hexpol',false),(56,8,'Private','Private advertiser',false),(57,7,'Old campaign','Hexpol',true);
    INSERT INTO qr_codes VALUES (61,41),(62,42),(63,41);
    INSERT INTO qr_campaigns VALUES (61,55),(61,55),(62,55),(63,56),(61,57);
    INSERT INTO events VALUES (1,61,55,'scan',0),(2,62,55,'scan',0),(3,63,56,'scan',0),(4,61,57,'scan',0),(5,61,55,'conversion',100);`);
  const q=(sql,params)=>db.query(sql,params);
  await createTracker(q).ensureSchema();
  await db.exec(`INSERT INTO campaign_website_visits(scan_event_id,campaign_id,qr_id,vivid_click_id,page_url,page_name,created_at) VALUES
    (1,55,61,'a','https://www.hexpol.com/rubber/contact','Contact Us','2026-09-23T00:00:00Z'),
    (1,55,61,'a','https://www.hexpol.com/rubber/about-us','About Us','2026-09-23T23:59:59.999Z'),
    (2,55,62,'b','https://www.hexpol.com/rubber/contact','Contact Us','2026-09-23T12:00:00Z'),
    (2,55,62,'before','https://www.hexpol.com/rubber/contact','Contact Us','2026-09-22T23:59:59.999Z'),
    (2,55,62,'after','https://www.hexpol.com/rubber/contact','Contact Us','2026-09-24T00:00:00Z'),
    (3,56,63,'private','https://private.example/page','Private page','2026-09-23T10:00:00Z'),
    (4,57,61,'archived','https://old.example/page','Archived page','2026-09-23T10:00:00Z');`);
  return {db,q};
}
test("reports aggregate page arrivals without join duplication and preserve UTC boundaries, filters, and tenancy",async()=>{
  const {db,q}=await fixture();
  try{
    const before=(await q("SELECT * FROM events ORDER BY id")).rows;
    const report=await reporting.load({q,user,query});
    assert.equal(report.total,4);assert.equal(reporting.count(report,"campaign_id",55),3);
    assert.equal(reporting.count(report,"qr_id",61),3);assert.equal(reporting.count(report,"location_id",42),1);
    assert.equal(report.pages.find(p=>p.page_name==="Contact Us").visits,2);
    assert.equal(report.pages.filter(p=>p.campaign_id===55).length,5);
    assert.equal(report.pages.find(p=>p.page_name==="Find Contact").visits,null);
    assert.doesNotMatch(JSON.stringify(report),/Private/);
    assert.equal((await reporting.load({q,user,query:{...query,qr_id:61,status:"active"}})).total,2);
    assert.equal((await reporting.load({q,user,query:{...query,location_id:42}})).total,1);
    assert.equal((await reporting.load({q,user,query:{...query,status:"archived"}})).total,1);
    assert.equal((await reporting.load({q,user,query:{...query,campaign_id:55,status:"archived"}})).campaigns.length,0);
    assert.equal((await reporting.load({q,user,query:{...query,campaign_id:56}})).pages.length,0);
    assert.equal((await reporting.load({q,user,query:{...query,qr_id:63}})).pages.length,0);
    assert.equal((await reporting.load({q,user:{id:1,role:"super_admin"},query})).total,5);
    const empty=await reporting.load({q,user,query:{start_date:"2026-09-20",end_date:"2026-09-20",campaign_id:55}});
    assert.equal(empty.total,0);assert.equal(empty.pages.length,5);assert.ok(empty.pages.every(p=>p.visits===null));
    const all=await reporting.load({q,user,query:{},allTime:true});assert.equal(all.total,6);
    assert.match(reporting.renderSection(all),/all_time=1/);
    assert.deepEqual((await q("SELECT * FROM events ORDER BY id")).rows,before);
    for(const invalid of [{start_date:"2026-02-30"},{...query,end_date:"2026-09-22"},{qr_id:"1 OR 1=1"},{status:"unknown"}])await assert.rejects(()=>reporting.load({q,user,query:invalid}),{status:400});
  }finally{await db.close();}
});
test("CSV matches HTML data, escapes formulas and quotes, and marks missing records",async()=>{
  const {db,q}=await fixture();try{
    const r=await reporting.load({q,user,query});
    const csv=reporting.csv(r),html=reporting.renderSection(r);
    assert.match(csv,/"Contact Us","https:\/\/www.hexpol.com\/rubber\/contact","2"/);
    assert.match(csv,/"Find Contact"[^\r]+"","","No records in period"/);
    assert.match(html,/<th>Page Visits<\/th>/);assert.match(html,/Export Page Visits CSV/);
    r.pages[0].page_name='=HYPERLINK("https://evil")';r.pages[0].campaign_name='<script>alert(1)</script>';
    assert.match(reporting.csv(r),/"'=HYPERLINK\(""https:\/\/evil""\)"/);
    assert.doesNotMatch(reporting.renderSection(r),/<script>/);
  }finally{await db.close();}
});
function response(){
  const res=new PassThrough();res.code=200;res.headers={};res.chunks=[];res.on("data",chunk=>res.chunks.push(Buffer.from(chunk)));
  res.status=c=>(res.code=c,res);res.set=res.setHeader=(k,v)=>(res.headers[k]=v,res);res.type=v=>res.set("Content-Type",v);res.send=b=>(res.end(String(b)),res);
  return res;
}
test("authenticated CSV and PDF routes use the same selected records; PDF includes readable multi-page tables",async()=>{
  const {db,q}=await fixture();try{
    const routes={};reporting.register({app:{get:(p,...handlers)=>routes[p]=handlers},q,requireLogin:(req,res,next)=>req.session?.user?next():res.status(401).send("Sign in")});
    async function run(route,session={user},parameters=query){const res=response(),done=once(res,"end");let i=0;const req={session,query:parameters},next=()=>routes[route][i++]?.(req,res,next);await next();await done;return res;}
    assert.equal((await run("/export/website-pages.csv",{})).code,401);
    const csv=await run("/export/website-pages.csv");assert.match(Buffer.concat(csv.chunks).toString(),/Contact Us/);assert.doesNotMatch(Buffer.concat(csv.chunks).toString(),/Private/);
    const denied=await run("/export/website-pages.csv",{user},{...query,campaign_id:56});assert.doesNotMatch(Buffer.concat(denied.chunks).toString(),/Private/);
    assert.equal((await run("/export/website-pages.csv",{user},{start_date:"bad"})).code,400);
    const pdf=await run("/export/website-pages.pdf");assert.equal(pdf.headers["Content-Type"],"application/pdf");assert.equal(Buffer.concat(pdf.chunks).subarray(0,4).toString(),"%PDF");
    if(process.env.VIVID_PDF_QA_DIR){
      fs.mkdirSync(process.env.VIVID_PDF_QA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.VIVID_PDF_QA_DIR,"page-visits.pdf"),Buffer.concat(pdf.chunks));
      const report=await reporting.load({q,user,query});report.pages=Array.from({length:35},(_,i)=>({...report.pages[i%report.pages.length],campaign_name:"Campaign with a longer name to check wrapping",page_name:`${i+1}. ${report.pages[i%report.pages.length].page_name}`}));
      const PDFDocument=require("pdfkit"),doc=new PDFDocument({margin:48,size:"LETTER"}),out=fs.createWriteStream(path.join(process.env.VIVID_PDF_QA_DIR,"page-visits-multipage.pdf")),done=once(out,"finish");doc.pipe(out);reporting.appendPdf(doc,report,{newPage:false});doc.end();await done;
    }
  }finally{await db.close();}
});
test("installed main report and executive PDF execute with page data and retain legacy event exports",async()=>{
  const original=fs.readFileSync(require.resolve("../server.js"),"utf8"),source=install(original);new vm.Script(source);assert.equal(install(source),source);
  const slice=(text,anchor)=>{const start=text.indexOf(anchor);assert.ok(start>=0);return text.slice(start,text.indexOf("\napp.",start+anchor.length));};
  assert.equal(slice(source,'app.get("/export/events.csv"'),slice(original,'app.get("/export/events.csv"'));
  for(const route of ["/reports","/reports-qr","/reports-campaign","/reports-location","/admin/reports"]){const part=slice(source,`app.get("${route}"`);assert.match(part,/<th>Page Visits<\/th>/);assert.match(part,/renderSection\(websitePages\)/);}
  const {db,q}=await fixture();try{
    const routes={},context={app:{get:(p,...handlers)=>routes[p]=handlers.at(-1)},require:createRequire(require.resolve("../server.js")),q,requireLogin:()=>{},page:(_,body)=>body,console,
      buildExportReportRows:async()=>[{campaignId:55,campaignName:"Customer-Tracking",advertiser:"Hexpol",status:"Active",scans:2,offerClicks:0,mapClicks:0,wazeClicks:0,intent:0,conversions:1,revenue:100,allocatedCost:10,cac:10,roi:900,visitors:2,clicks:0,visitorsConverted:1,revenueGenerated:100,customerActions:[]}],money:v=>String(v||0),pct:v=>String(v||0),PDFDocument:require("pdfkit")};
    vm.runInNewContext(slice(source,'app.get("/reports"'),context);
    const res=response(),done=once(res,"end");await routes["/reports"]({session:{user},query},res);await done;
    const html=Buffer.concat(res.chunks).toString();assert.match(html,/<td>3<\/td>/);assert.match(html,/Contact Us/);assert.doesNotMatch(html,/Private/);
    vm.runInNewContext(slice(source,'app.get(\n  "/export/report.pdf",'),context);
    const pdf=response(),finished=once(pdf,"end");await routes["/export/report.pdf"]({session:{user},query},pdf);await finished;
    assert.equal(Buffer.concat(pdf.chunks).subarray(0,4).toString(),"%PDF");
    if(process.env.VIVID_PDF_QA_DIR)fs.writeFileSync(path.join(process.env.VIVID_PDF_QA_DIR,"executive-report.pdf"),Buffer.concat(pdf.chunks));
  }finally{await db.close();}
});
