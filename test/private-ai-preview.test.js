"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), vm = require("node:vm");
const {execFileSync} = require("node:child_process");
const {canPreviewAi,previewRenderer,aiPreviewMiddleware,isAiOnlyPath,withoutAiLinks} = require("../ai-preview-access");
const regular = {user:{id:7,name:"Test Test",email:"customer@example.com",role:"admin"}};
const preview = {user:{id:7,login_user_id:12,email:"TestTest@Test.com",role:"customer"}};
const platform = {user:{id:1,email:"admin@example.com",role:"super_admin"}};
const org = {orgUser:{id:8,email:"manager@example.com",organization_role:"owner"}};

test("only the authenticated Test Test login and platform super admins qualify", () => {
  for(const session of [{},regular,org,{platformUser:platform.user},{user:{name:"Test Test",email:"testtest@test.com"}},{...platform,...org}]) assert.equal(canPreviewAi(session),false);
  for(const session of [preview,platform,{orgUser:{id:8,email:"testtest@test.com"}}]) assert.equal(canPreviewAi(session),true);
  assert.equal(canPreviewAi({user:{...regular.user,customer_id:7,advertiser_customer_id:7}}),false);
});

test("AI read/write routes are closed and concurrent performance requests retain their own preview context", async () => {
  const express = require("express"), app = express();
  const sessions={regular,preview,platform,org};
  app.use((req,res,next)=>{req.session=sessions[req.get("x-test-actor")]||{};next();});
  app.use(aiPreviewMiddleware);
  let writes=0;
  for(const route of ["/admin/ai-readiness","/admin/weekly-ai-report/preferences","/admin/ai-campaign-draft/1","/org-ai-approval-center/action","/ai-priority-feedback"]){
    app.all(route,(req,res)=>{writes++;res.send("AI tool");});
  }
  const render = previewRenderer(()=>'<section>Ask Vivid private recommendation</section>');
  for(const route of ["/admin/ai-insights","/org-performance","/reports","/admin/marketing-command-center","/admin/connectors/google-ads/1"]){
    app.get(route,async(req,res)=>{
      await new Promise(resolve=>setTimeout(resolve,req.get("x-test-actor")==="preview"?5:1));
      res.send('<a href="/reports">Reports</a><a href="/admin/ai-insights">Performance Insights</a><a href="/admin/ai-readiness"><span>AI Readiness</span></a><h1>Impressions 100 · Clicks 10</h1>'+render());
    });
  }
  const server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  try {
    for(const actor of ["regular","org","anonymous"]){
      for(const route of ["/admin/ai-readiness","/admin/weekly-ai-report/preferences","/admin/ai-campaign-draft/1","/org-ai-approval-center/action","/ai-priority-feedback"]){
        for(const method of ["GET","POST"]){
          const response=await fetch(url+route+"?email=testtest@test.com&role=super_admin",{method,headers:{"x-test-actor":actor}});
          assert.equal(response.status,404);
        }
      }
    }
    assert.equal(writes,0);
    for(const actor of ["preview","platform"]){assert.equal((await fetch(url+"/admin/ai-readiness",{headers:{"x-test-actor":actor}})).status,200);}
    await Promise.all(["regular","preview","platform","org"].flatMap(actor=>["/admin/ai-insights","/org-performance","/reports","/admin/marketing-command-center","/admin/connectors/google-ads/1"].map(async route=>{
      const response=await fetch(url+route+"?ask=what+is+working",{headers:{"x-test-actor":actor}}),html=await response.text();
      assert.equal(response.status,200);assert.match(html,/Impressions 100 · Clicks 10/);assert.match(html,/Performance Insights/);assert.match(html,/href="\/reports"/);
      if(actor==="preview"||actor==="platform"){assert.match(html,/Ask Vivid/);assert.match(html,/AI Readiness/);}
      else{assert.doesNotMatch(html,/Ask Vivid|AI Readiness|ai-readiness/);}
    })));
    assert.equal(render(),"");
  } finally { server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
});

test("AI route matching handles Express case/trailing slashes without hiding metrics or connectors",()=>{
  for(const route of ["/ADMIN/AI-READINESS/","/org-ai-readiness/advertiser/2?organization_id=1","/admin/ai-campaign-operator","/org-weekly-ai-report/send-test"])assert.equal(isAiOnlyPath(route),true);
  for(const route of ["/admin/ai-insights","/org-performance","/admin/connectors/google-ads","/reports","/build-my-campaign"])assert.equal(isAiOnlyPath(route),false);
  assert.equal(withoutAiLinks('<a href="/reports">Reports</a> <a class="btn" href="/org-ai-readiness?organization_id=2"><span>Evidence Passport</span></a>'),'<a href="/reports">Reports</a> ');
});

test("platform and Google dashboards keep metric tables, drill-downs and sync status with AI hidden",()=>{
  const {renderCommandCenter}=require("../marketing-command-center"),{renderAccount}=require("../google-ads-readonly-view");
  const range={from:"2026-09-01",to:"2026-09-22"},connection={id:1,account_name:"VividSpots",currency_code:"USD",account_timezone:"UTC",status:"connected"};
  const rows=[{connection_id:1,campaign_id:"99",campaign_name:"Search test",currency_code:"USD",impressions:100,clicks:10,cost_micros:10000000,conversions:1,conversion_value:50}];
  for(const aiVisible of [false,true]){
    const mcc=renderCommandCenter({title:"Metrics",scope:{kind:"advertiser",userId:7},range,campaigns:[{id:1,name:"Offer",scans:22,clicks:3}],googleEnabled:true,googleEvidence:{connections:[connection],rows,daily:[]},aiVisible});
    for(const label of ["Scans","Intent actions","Ad impressions","Ad clicks","Recorded conversions","Your platforms"])assert.ok(mcc.includes(label));
    assert.match(mcc,/platform=google_ads/);
    const google=renderAccount({connection,rows,syncs:[],range,csrf:"csrf",aiVisible});
    assert.match(google,/Search test/);assert.match(google,/Automatic sync every hour|First automatic sync queued/);assert.match(google,/Daily performance/);
    for(const html of [mcc,google]) assert.equal(html.includes("Automatic recommendations"),aiVisible);
    assert.equal(mcc.includes("Evidence Passport"),aiVisible);
  }
});

test("public marketing briefs show a receipt without a generated allocation or Autopilot option",()=>{
  const {renderVividConfirmation,renderVividCampaignBuilder,renderCampaignBuilder}=require("../marketplace-campaign-builder");
  const input={reference:"VIVID-TEST",recommendation:{rationale:"Private AI rationale",channels:[]}};
  const receipt=renderVividConfirmation(input);
  assert.match(receipt,/VIVID-TEST/);assert.match(receipt,/No campaign has launched/);
  assert.doesNotMatch(receipt,/Private AI rationale|Recommended monthly allocation/);
  assert.match(renderVividConfirmation({...input,aiVisible:true}),/Private AI rationale/);
  assert.doesNotMatch(renderVividCampaignBuilder({}),/Autopilot/);
  assert.doesNotMatch(renderCampaignBuilder({organization:{name:"School",slug:"school"}}),/Autopilot/);
});

test("weekly AI delivery excludes other recipients before the limit and before claiming or sending",async()=>{
  const {PGlite}=require("@electric-sql/pglite"),db=new PGlite();
  const callbacks=[],sent=[];
  const file=path.resolve(__dirname,"../weekly-ai-report-routes.js"),mod={exports:{}};
  vm.runInNewContext(fs.readFileSync(file,"utf8"),{require:require("node:module").createRequire(file),module:mod,console,setInterval:fn=>{callbacks.push(fn);return {unref(){}};},setTimeout:()=>({unref(){}})});
  try{
    await db.exec("CREATE TABLE users(id INT PRIMARY KEY,name TEXT,email TEXT,role TEXT)");
    mod.exports.registerWeeklyAiReportRoutes({app:{get(){},post(){}},q:(sql,args)=>db.query(sql,args),sendOrganizationNotification:async message=>{sent.push(message.to);return true;}});
    await callbacks[0](); // Creates the scheduler's actual schema.
    await db.exec(`INSERT INTO users SELECT id,'Regular','regular'||id||'@example.com','customer' FROM generate_series(1,55) id;
      INSERT INTO users VALUES(56,'Test Test','testtest@test.com','customer'),(57,'Platform Admin','platform@example.com','super_admin');
      INSERT INTO ai_weekly_report_preferences(actor_type,actor_id,enabled,delivery_day,delivery_hour,timezone)
        SELECT 'advertiser',id,true,EXTRACT(ISODOW FROM CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),EXTRACT(HOUR FROM CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),'UTC' FROM users;`);
    await callbacks[0]();
    assert.deepEqual(sent,["testtest@test.com","platform@example.com"]);
    const claimed=await db.query("SELECT actor_id FROM ai_weekly_report_preferences WHERE last_sent_at IS NOT NULL ORDER BY actor_id");
    assert.deepEqual(claimed.rows.map(r=>Number(r.actor_id)),[56,57]);
  }finally{await db.close();}
});

test("startup composition installs all renderer guards after session and remains idempotent",()=>{
  const root=path.resolve(__dirname,".."),tmp=fs.mkdtempSync(path.join(os.tmpdir(),"vivid-private-ai-"));
  const installers=["install-public-marketplace-redirect.js","install-ai-insights-performance.js","install-vivid-intelligence.js","install-ai-readiness.js","install-marketplace-campaign-builder.js","install-google-ads-observation.js","install-marketing-command-center.js","install-google-ads-readonly.js","install-private-ai-preview.js"];
  try{
    for(const file of ["server.js",...installers])fs.copyFileSync(path.join(root,file),path.join(tmp,file));
    for(let pass=0;pass<2;pass++){
      for(const file of installers)execFileSync(process.execPath,[path.join(tmp,file)],{stdio:"pipe"});
      execFileSync(process.execPath,["--check",path.join(tmp,"server.js")],{stdio:"pipe"});
    }
    const source=fs.readFileSync(path.join(tmp,"server.js"),"utf8"),{install,RENDERERS}=require("../install-private-ai-preview");
    assert.equal(install(source),source);
    assert.ok(source.indexOf("app.use(aiPreviewMiddleware)")>source.indexOf("session({"));
    assert.ok(source.indexOf("app.use(aiPreviewMiddleware)")<source.indexOf('app.get("/admin/ai-insights"'));
    for(const name of RENDERERS)assert.ok(source.includes(`const ${name} = previewRenderer(${name}Unrestricted);`));
    assert.match(source,/Performance Insights/);assert.match(source,/EXECUTIVE PERFORMANCE TOTALS/);
    assert.doesNotMatch(source,/>AI Insights<\/a>/);
    assert.equal((source.match(/\$\{aiPreviewEnabled\(\)\?`<!--/g)||[]).length,2);
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
