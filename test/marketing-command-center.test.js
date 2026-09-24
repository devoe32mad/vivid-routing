"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {dateRange,summarize,renderCommandCenter,recommendations}=require("../marketing-command-center");
const {registerMarketingCommandCenterRoutes}=require("../marketing-command-center-routes");
function harness({q,scope={organizationId:2},env={}}={}){
  const routes={};
  const login=(req,res,next)=>req.session?.user?next():res.status(401).send("Login required");
  const permission=key=>{assert.equal(key,"manage_advertisers");return (req,res,next)=>req.session?.orgUser?next():res.status(403).send("Permission required");};
  registerMarketingCommandCenterRoutes({app:{get:(path,...fns)=>routes[path]=fns},q,page:(_,b)=>b,orgPage:(_,b)=>b,organizationNav:()=>"",requireLogin:login,requireOrganizationPermission:permission,getOrganizationScope:async()=>scope,env});
  return async(path,req)=>{const res={code:200,status(code){this.code=code;return this;},send(body){this.body=body;return this;}};const stack=routes[path];let i=0;const next=()=>stack[i++]?.(req,res,next);await next();return res;};
}
const userPath="/admin/marketing-command-center",orgPath="/org-marketing-command-center/advertiser/:advertiserId";
test("dates reject invalid calendar dates, arrays, reversed and oversized periods",()=>{
  for(const query of [{from:"2026-02-30"},{from:["2026-01-01"]},{from:"2026-09-03",to:"2026-09-01"},{from:"2020-01-01",to:"2026-01-01"}])assert.throws(()=>dateRange(query));
  assert.deepEqual(dateRange({},new Date("2026-09-22T12:00:00Z")),{from:"2026-08-24",to:"2026-09-22"});
});
test("Square evidence remains a subset, and suggestions do not authorize budget changes",()=>{
  const rows=[{id:3,name:"Offer",conversions:2,conversion_value:100,square_conversions:1,square_value:40}];
  assert.equal(summarize(rows).conversion_value,100);
  assert.match(recommendations(rows,{kind:"advertiser"})[0].reason,/does not establish incremental lift/);
});
test("anonymous and unprivileged enterprise requests perform no database reads",async()=>{
  const run=harness({q:()=>{throw Error("Unexpected DB");}});
  assert.equal((await run(userPath,{session:{}})).code,401);
  assert.equal((await run(orgPath,{session:{}})).code,403);
});
test("invalid drill-down queries and enterprise private-account requests fail before database reads",async()=>{
  const run=harness({q:()=>{throw Error("Unexpected DB");}});
  for(const query of [{platform:"unknown"},{platform:["vivid"]},{platform:"google_ads",campaign:"1:99<script>"}])assert.equal((await run(userPath,{session:{user:{id:7}},query})).code,400);
  assert.equal((await run(orgPath,{session:{orgUser:{id:4}},params:{advertiserId:8},query:{platform:"google_ads"}})).code,403);
});
test("advertiser identity comes from session even for admin and ignores supplied owner",async()=>{
  const calls=[],run=harness({q:async(sql,params)=>{calls.push({sql,params});return {rows:[]};}});
  const res=await run(userPath,{session:{user:{id:7,role:"super_admin"}},query:{user_id:999,from:"2026-09-01",to:"2026-09-22"}});
  assert.equal(res.code,200);assert.equal(calls.length,1);assert.match(calls[0].sql,/WHERE c.user_id=\$1/);assert.deepEqual(calls[0].params,[7,"2026-09-01","2026-09-22"]);
});
test("foreign advertiser is rejected before any metric or merchant reads",async()=>{
  const calls=[],run=harness({q:async(sql,params)=>{calls.push({sql,params});return {rows:[]};}});
  const res=await run(orgPath,{session:{orgUser:{id:4}},params:{advertiserId:99},query:{organization_id:999}});
  assert.equal(res.code,404);assert.equal(calls.length,1);assert.deepEqual(calls[0].params,[99,2]);
});
test("enterprise metric query has both boundaries and never reads Square account data",async()=>{
  const calls=[],run=harness({env:{SQUARE_PRODUCTION_ENABLED:"true",GOOGLE_ADS_OBSERVATION_ENABLED:"true"},q:async(sql,params)=>{calls.push({sql,params});return {rows:calls.length===1?[{id:8,name:"Advertiser",organization_name:"Enterprise"}]:[]};}});
  const res=await run(orgPath,{session:{orgUser:{id:4}},params:{advertiserId:8},query:{from:"2026-09-01",to:"2026-09-22"}});
  assert.equal(res.code,200);assert.equal(calls.length,2);assert.match(calls[1].sql,/c.organization_id=\$1 AND c.advertiser_id=\$2/);assert.deepEqual(calls[1].params,[2,8,"2026-09-01","2026-09-22"]);
  assert.doesNotMatch(res.body,/integrations\/square\/production\/customers/);
  assert.doesNotMatch(calls.map(c=>c.sql).join(" "),/google_ads_private/);
});
test("unbuilt connectors remain planned, Meta is connectable, and customer content is escaped",()=>{
  const html=renderCommandCenter({title:"<script>secret</script>",scope:{kind:"advertiser",userId:7},range:{from:"2026-09-01",to:"2026-09-22"},campaigns:[{id:3,name:'<img src=x onerror=alert(1)>',clicks:2}],squareStatus:"Not enabled"});
  assert.doesNotMatch(html,/<script>|<img/);assert.match(html,/LinkedIn Ads/);assert.match(html,/Awaiting application setup/);assert.match(html,/Planned/);assert.match(html,/not added again/);assert.match(html,/data-platform="meta"/);
});
test("real PostgreSQL aggregation excludes other owners, organizations, test campaigns and out-of-period events",async()=>{
  const {PGlite}=require("@electric-sql/pglite"),db=new PGlite();
  try{
    await db.exec(`CREATE TABLE organizations(id INT PRIMARY KEY,name TEXT);
      CREATE TABLE advertisers(id INT PRIMARY KEY,organization_id INT,name TEXT,is_active BOOLEAN);
      CREATE TABLE campaigns(id INT PRIMARY KEY,name TEXT,user_id INT,organization_id INT,advertiser_id INT,is_test BOOLEAN);
      CREATE TABLE events(id INT PRIMARY KEY,campaign_id INT,type TEXT,value NUMERIC,created_at TIMESTAMP,square_payment_key TEXT);
      INSERT INTO organizations VALUES(2,'School'); INSERT INTO advertisers VALUES(8,2,'Shop',true);
      INSERT INTO campaigns VALUES(1,'Own',7,2,8,false),(2,'Other owner',9,2,9,false),(3,'Other enterprise',7,3,8,false),(4,'Test',7,2,8,true);
      INSERT INTO events VALUES(1,1,'conversion',40,'2026-09-01','payment'),(2,1,'conversion',60,'2026-09-22 23:59:59',NULL),
        (3,1,'conversion',999,'2026-09-23',NULL),(4,2,'conversion',200,'2026-09-15',NULL),
        (5,3,'conversion',300,'2026-09-15',NULL),(6,4,'conversion',1000,'2026-09-15',NULL);`);
    const results=[],run=harness({q:async(sql,params)=>{const result=await db.query(sql,params);if(sql.includes('GROUP BY'))results.push(result.rows);return result;}});
    const query={from:"2026-09-01",to:"2026-09-22"};
    const own=await run(userPath,{session:{user:{id:7}},query});
    assert.equal(own.code,200);assert.deepEqual(results[0].map(r=>r.id),[1,3]);assert.equal(summarize(results[0]).conversion_value,400);
    const org=await run(orgPath,{session:{orgUser:{id:4}},params:{advertiserId:8},query});
    assert.equal(org.code,200);assert.deepEqual(results[1].map(r=>r.id),[1]);assert.equal(summarize(results[1]).conversion_value,100);assert.equal(summarize(results[1]).square_value,40);
    // Older deployments may not yet have Square's optional projection column.
    await db.exec('ALTER TABLE events DROP COLUMN square_payment_key');
    assert.equal((await run(userPath,{session:{user:{id:7}},query})).code,200);
  }finally{await db.close();}
});
test("startup installers compose against the real server without starting it",()=>{
  const fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
  const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vivid-command-center-'));
  try{
    const installers=['install-public-marketplace-redirect.js','install-ai-insights-performance.js','install-vivid-intelligence.js','install-ai-readiness.js','install-marketplace-campaign-builder.js','install-google-ads-observation.js','install-marketing-command-center.js','install-google-ads-readonly.js'];
    for(const file of ['server.js',...installers])fs.copyFileSync(path.join(root,file),path.join(tmp,file));
    for(const file of installers)execFileSync(process.execPath,[path.join(tmp,file)],{stdio:'pipe'});
    const source=fs.readFileSync(path.join(tmp,'server.js'),'utf8'),{install}=require('../install-marketing-command-center');
    assert.equal(install(source),source);assert.equal(require('../install-google-ads-readonly').install(source),source);assert.match(source,/registerGoogleAdsReadOnlyRoutes\(\{app,q,pool,page,requireLogin\}\)/);assert.match(source,/registerMarketingCommandCenterRoutes\(\{/);
    execFileSync(process.execPath,['--check',path.join(tmp,'server.js')],{stdio:'pipe'});
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
