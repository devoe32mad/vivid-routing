"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {createTracker,registerWebsitePageTracking,renderReport,mySetupWebsiteTracking,renderPageCards}=require("../website-page-tracking");
const {install}=require("../install-website-page-tracking");
const click="00000000-0000-4000-8000-000000000001";
const paths=["/rubber/what-we-offer/qualityjourney/","/rubber/contact/","/rubber/what-we-offer/","/rubber/about-us/","/rubber/contact/find-contact/"];
const client=fs.readFileSync(require.resolve("../public/vivid-website.js"),"utf8");
function visit(url,storage=new Map(),options={}){
  const requests=[],u=new URL(url);
  const context={URL,URLSearchParams,Date,Number,JSON,document:{currentScript:{src:"https://vivid.example/vivid-website.js",getAttribute:n=>n==="data-vivid-campaign"?"55":JSON.stringify(paths.map(path=>({path,label:path}))) }},
    window:{location:u},sessionStorage:{setItem:(k,v)=>{if(options.blocked)throw Error("blocked");storage.set(k,v)},getItem:k=>{if(options.blocked)throw Error("blocked");return storage.get(k)}},fetch:(url,opts)=>{requests.push({url,opts,body:JSON.parse(opts.body)});return Promise.resolve()}};
  vm.runInNewContext(client,context);if(options.twice)vm.runInNewContext(client,context);
  return requests;
}
test("one installation attributes all five pages across navigation without forwarding query strings",()=>{
  const storage=new Map();
  for(const [i,path] of paths.entries()){
    const requests=visit("https://www.hexpol.com"+path+(i===0?"?vivid_click_id="+click+"&email=secret@example.com#secret":""),storage,{twice:true});
    assert.equal(requests.length,1);assert.equal(requests[0].body.vivid_click_id,click);
    assert.equal(requests[0].body.page_url,"https://www.hexpol.com"+path.replace(/\/$/,""));
    assert.doesNotMatch(requests[0].opts.body,/secret|email/);assert.equal(requests[0].opts.credentials,"omit");assert.equal(requests[0].opts.referrerPolicy,"no-referrer");
  }
  assert.equal(visit("https://www.hexpol.com/rubber/other/",storage).length,0);
});
test("ordinary traffic, expired attribution and blocked storage do not fabricate downstream visits",()=>{
  assert.equal(visit("https://www.hexpol.com/rubber/contact/").length,0);
  const storage=new Map([["vivid:website:55",JSON.stringify({id:click,at:Date.now()-86400001})]]);
  assert.equal(visit("https://www.hexpol.com/rubber/contact/",storage).length,0);
  assert.equal(visit("https://www.hexpol.com/rubber/contact/?vivid_click_id=not-a-uuid",new Map()).length,0);
  assert.equal(visit("https://www.hexpol.com/rubber/contact/",storage,{blocked:true}).length,0);
  assert.equal(visit("https://www.hexpol.com/rubber/contact/?vivid_click_id="+click,storage,{blocked:true}).length,1);
});
function harness(q){
  const routes={};
  registerWebsitePageTracking({app:{get:(p,...f)=>routes[p]=f,post:(p,...f)=>routes[p]=f},q,page:(_,b)=>b,
    express:{text:()=> (req,res,next)=>next()},requireLogin:(req,res,next)=>req.session?.user?next():res.status(401).end()});
  return async({session={user:{id:7,role:"customer"}},id="55",query={},route="/admin/campaign/:campaignId/website-pages",body,origin}={})=>{
    const req={session,params:{campaignId:id},query,body,get:()=>origin};
    const res={code:200,status(c){this.code=c;return this},set(){return this},end(){return this},send(b){this.body=b;return this}};
    let i=0;const next=()=>routes[route][i++]?.(req,res,next);await next();return res;
  };
}
test("PostgreSQL: attribution, deduplication, ownership and report separation from conversions",async()=>{
  const {PGlite}=require("@electric-sql/pglite"),db=new PGlite();
  try{
    await db.exec(`CREATE TABLE campaigns(id INT PRIMARY KEY,user_id INT,name TEXT,advertiser TEXT,campaign_url TEXT);
      CREATE TABLE qr_codes(id INT PRIMARY KEY);
      CREATE TABLE campaign_destinations(id INT PRIMARY KEY,campaign_id INT,destination_url TEXT);
      CREATE TABLE events(id SERIAL PRIMARY KEY,qr_id INT,campaign_id INT,campaign_destination_id INT,type TEXT,vivid_click_id TEXT,value NUMERIC,created_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
      INSERT INTO campaigns VALUES (55,7,'Customer-Tracking','Hexpol','https://www.hexpol.com/rubber/'),(56,8,'Private campaign','Other','https://private.example');
      INSERT INTO qr_codes VALUES (61);
      INSERT INTO campaign_destinations VALUES (1,55,'https://alternate.example/landing');
      INSERT INTO events(qr_id,campaign_id,type,vivid_click_id,value) VALUES (61,55,'scan','${click}',0);
      INSERT INTO events(qr_id,campaign_id,campaign_destination_id,type,vivid_click_id,value) VALUES (61,55,1,'destination_click','${click}',0);`);
    const q=(s,a)=>db.query(s,a),tracker=createTracker(q),run=harness(q);
    const data={campaign_id:55,vivid_click_id:click,page_url:"https://www.hexpol.com/rubber/contact/?email=secret#form",page_name:"Contact Us"};
    const original=(await q("SELECT * FROM events")).rows;
    for(const input of [null,{...data,campaign_id:56},{...data,vivid_click_id:"00000000-0000-4000-8000-000000000099"},{...data,page_url:"https://evil.example/contact"}])assert.equal(await tracker.record(input,input?.page_url?.startsWith("https://evil")?"https://evil.example":"https://www.hexpol.com"),false);
    assert.equal(await tracker.record(data,"https://evil.example"),false);
    assert.equal(await tracker.record(data,"null"),false);
    assert.equal(await tracker.record(data,"https://www.hexpol.com"),true);
    assert.equal(await tracker.record({...data,page_url:"https://www.hexpol.com/rubber/contact/"},"https://www.hexpol.com"),true);
    assert.equal((await q("SELECT * FROM campaign_website_visits")).rows.length,1);
    const stored=(await q("SELECT * FROM campaign_website_visits")).rows[0];
    assert.equal(stored.page_url,"https://www.hexpol.com/rubber/contact");assert.equal(stored.qr_id,61);
    for(const path of paths.filter(p=>p!=="/rubber/contact/"))await tracker.record({...data,page_url:"https://www.hexpol.com"+path,page_name:path},"https://www.hexpol.com");
    assert.equal((await q("SELECT * FROM campaign_website_visits")).rows.length,5);
    assert.equal(await tracker.record({...data,page_url:"https://alternate.example/contact"},"https://alternate.example"),true);
    assert.deepEqual((await q("SELECT * FROM events")).rows,original); // No conversion, revenue, scan, or intent mutations.
    assert.equal((await run({session:{}})).code,401);
    assert.equal((await run({id:"56"})).code,404);
    assert.equal((await run({id:"56",session:{user:{id:1,role:"super_admin"}}})).code,200);
    const report=await run();assert.equal(report.code,200);assert.match(report.body,/Contact Us/);assert.match(report.body,/QR visits reaching page/);assert.doesNotMatch(report.body,/secret|Private campaign/);
    const campaigns=(await q("SELECT * FROM campaigns ORDER BY id")).rows;
    const setup=await mySetupWebsiteTracking({q,user:{id:7,role:"customer"},campaigns});
    assert.match(setup,/id="website-page-tracking"/);assert.match(setup,/Contact Us/);assert.match(setup,/rubber\/about-us/);
    assert.match(setup,/data-page-visits="1"/);assert.doesNotMatch(setup,/Private campaign|secret/);
    const otherSetup=await mySetupWebsiteTracking({q,user:{id:8,role:"customer"},campaigns});
    assert.match(otherSetup,/Awaiting tracked page visits/);assert.doesNotMatch(otherSetup,/Contact Us|hexpol.com/);
    assert.match(await mySetupWebsiteTracking({q,user:{id:1,role:"super_admin"},campaigns}),/Private campaign/);
    assert.equal((await run({route:"/website/page-visit",body:"not json"})).code,400);
    assert.equal((await run({route:"/website/page-visit",body:JSON.stringify({...data,vivid_click_id:"invalid"}),origin:"https://www.hexpol.com"})).code,204);
    await db.exec("UPDATE events SET created_at=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '25 hours' WHERE type='scan'");
    assert.equal(await tracker.record(data,"https://www.hexpol.com"),false);
  }finally{await db.close()}
});
test("report escapes page labels and installer preserves existing conversion routes and is idempotent",()=>{
  const html=renderReport({id:55,name:"<script>",advertiser:"Hexpol"},[{page_name:'<img src=x onerror="alert(1)">',page_url:"https://example.com/",visits:1,last_visit:new Date()}],30);
  assert.doesNotMatch(html,/<script>|<img/);
  const source=fs.readFileSync(require.resolve("../server.js"),"utf8"),updated=install(source);
  assert.equal(install(updated),updated);assert.match(updated,/app.get\("\/conversion"/);assert.match(updated,/Website page visits/);new vm.Script(updated);
  const setup=updated.slice(updated.indexOf('app.get("/my-setup"'),updated.indexOf('\napp.',updated.indexOf('app.get("/my-setup"')+10));
  assert.match(setup,/await require\("\.\/website-page-tracking"\).mySetupWebsiteTracking/);
  assert.match(setup,/href="#website-page-tracking"/);assert.match(setup,/\$\{websiteTrackingSection\}\s*<h2>Schedules/);
  const legacy=updated.replace(/\/\/ MY_SETUP_WEBSITE_TRACKING[\s\S]*?(?=    res.send\(page\("My Setup")/,"")
    .replace('${websiteTrackingSection}\n\n',"").replace('  <a class="btn secondary" href="#website-page-tracking">Website Page Tracking</a>\n',"");
  assert.match(install(legacy),/MY_SETUP_WEBSITE_TRACKING/); // Existing installations can gain the section too.
});
test("My Setup remains available when website statistics cannot be loaded",async()=>{
  const html=await mySetupWebsiteTracking({q:async()=>{throw {code:"TEST_DB_UNAVAILABLE"}},user:{id:7,role:"customer"},campaigns:[{id:55,user_id:7}]});
  assert.match(html,/temporarily unavailable/);assert.doesNotMatch(html,/Awaiting tracked page visits/);
});
test("configured cards show all five planned pages without inventing visits and accept real counts",()=>{
  const campaign={id:55,advertiser:"Hexpol"};
  const pending=renderPageCards(campaign,[]);
  assert.equal((pending.match(/data-page-visits="pending"/g)||[]).length,5);
  for(const name of ["Quality Journey","Contact Us","What We Offer","About Us","Find Contact"])assert.ok(pending.includes(name));
  assert.doesNotMatch(pending,/data-page-visits="0"|Data received/);
  const received=renderPageCards(campaign,[{page_url:"https://www.hexpol.com/rubber/contact",page_name:"Contact Us",visits:3,last_visit:new Date()}]);
  assert.equal((received.match(/data-page-visits="3"/g)||[]).length,1);
  assert.equal((received.match(/data-page-visits="pending"/g)||[]).length,4);
  assert.doesNotMatch(renderPageCards({id:56,advertiser:"Hexpol"},[]),/Quality Journey/);
  assert.doesNotMatch(renderPageCards({id:55,advertiser:"Other"},[]),/Quality Journey/);
  const escaped=renderPageCards({id:1,advertiser:'<img src=x>'},[{page_url:'javascript:alert(1)',page_name:'<script>x</script>',visits:1,last_visit:new Date()}]);
  assert.doesNotMatch(escaped,/<script>|<img|href="javascript:/);
});
