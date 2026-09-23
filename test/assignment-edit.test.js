"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validDate,effectiveStart,renderAssignmentEdit,registerAssignmentEditRoutes}=require("../assignment-edit");
const {install}=require("../install-assignment-edit");
const owner={id:7,email:"owner@example.com",role:"customer"},other={id:8,role:"customer"},admin={id:1,role:"super_admin"};
function harness(q){
  const routes={};
  const requireLogin=(req,res,next)=>req.session?.user?next():res.redirect("/login");
  registerAssignmentEditRoutes({app:{get:(p,...f)=>routes["GET"]=f,post:(p,...f)=>routes["POST"]=f},q,page:(_,body)=>body,requireLogin});
  return async(method,{user=owner,session={user},id="10",body={},query={}}={})=>{
    const req={session,params:{assignmentId:id},body,query};
    const res={code:200,status(code){this.code=code;return this;},set(){return this;},send(body){this.body=body;return this;},redirect(code,url){this.code=typeof code==="number"?code:302;this.location=url||code;return this;}};
    let i=0;const next=()=>routes[method][i++]?.(req,res,next);await next();return {req,res};
  };
}
test("calendar validation rejects invalid, missing, injected, or multiple dates",()=>{
  for(const date of [undefined,"",["2026-09-23"],"2026-02-29","2026-09-31","2026-9-23","2026-09-23T00:00:00Z","0000-01-01","2026-09-23';DROP TABLE campaigns;--"])assert.equal(validDate(date),false);
  for(const date of ["2026-09-23","2028-02-29"])assert.equal(validDate(date),true);
});
test("date view separates assignment and effective starts and escapes customer content",()=>{
  const assignment={id:10,campaign_id:2,qr_id:3,campaign_name:'<script>x</script>',qr_name:'QR & stand',location_name:'Hall',start_date:"2026-09-23",end_date:null,campaign_start:"2026-09-28",qr_start:"2026-09-01",today:"2026-09-23",version:"55"};
  assert.equal(effectiveStart(assignment),"2026-09-28");
  const html=renderAssignmentEdit({assignment,csrf:"token"});
  assert.match(html,/value="2026-09-23"/);assert.match(html,/strong>2026-09-28/);assert.match(html,/A later related date applies/);assert.match(html,/href="\/admin\/edit-campaign\/2"/);
  assert.doesNotMatch(html,/<script>|name="campaign_id"|name="qr_id"|name="end_date"/);
});
test("login, invalid identifiers, and CSRF stop before database access",async()=>{
  const run=harness(()=>{throw Error("Unexpected database access");});
  assert.equal((await run("GET",{session:{}})).res.location,"/login");
  for(const id of ["-1","0","1.2","foo","9007199254740992"])assert.equal((await run("GET",{id})).res.code,400);
  for(const token of [undefined,"bad","a".repeat(64),"é".repeat(64)])assert.equal((await run("POST",{session:{user:owner,assignmentEditCsrf:"b".repeat(64)},body:{csrf:token,start_date:"2026-09-23"}})).res.code,403);
});
test("PostgreSQL update preserves the assignment, QR, campaign and schedules, and enforces ownership/conflicts",async t=>{
  const {PGlite}=require("@electric-sql/pglite"),db=new PGlite();
  try{
    await db.exec(`CREATE TABLE spaces(id INT PRIMARY KEY,name TEXT);
      CREATE TABLE qr_codes(id INT PRIMARY KEY,name TEXT,space_id INT,live_date DATE);
      CREATE TABLE campaigns(id INT PRIMARY KEY,user_id INT,name TEXT,advertiser TEXT,start_date DATE,live_date DATE,end_date DATE,is_archived BOOLEAN);
      CREATE TABLE qr_campaigns(id INT PRIMARY KEY,qr_id INT,campaign_id INT,started_at TIMESTAMP,assigned_at TIMESTAMP,ended_at TIMESTAMP,is_active BOOLEAN,contract_days INT);
      CREATE TABLE campaign_schedules(id INT PRIMARY KEY,qr_id INT,campaign_id INT,days_of_week TEXT,start_time TEXT,end_time TEXT,priority INT);
      INSERT INTO spaces VALUES(1,'Trade show booth');
      INSERT INTO qr_codes VALUES(3,'HEXPOL stand',1,'2026-09-01');
      INSERT INTO campaigns VALUES(2,7,'HEXPOL test','HEXPOL','2026-09-01','2026-09-01','2026-10-01',false),(4,8,'Other account','Other','2026-09-01',NULL,NULL,false);
      INSERT INTO qr_campaigns VALUES(10,3,2,'2026-09-28 12:30:45.123456','2026-09-15 10:00','2026-10-01 15:45',true,9),
        (11,3,4,'2026-09-28',NULL,NULL,true,7),(12,3,2,'2026-09-28',NULL,NULL,false,7);
      INSERT INTO campaign_schedules VALUES(20,3,2,'1,2,3','08:00','19:00',50);`);
    const run=harness((sql,args)=>db.query(sql,args));
    const before=(await db.query("SELECT id,qr_id,campaign_id,assigned_at::text,ended_at::text,is_active,contract_days FROM qr_campaigns WHERE id=10")).rows;
    const campaigns=(await db.query("SELECT * FROM campaigns ORDER BY id")).rows;
    const qrs=(await db.query("SELECT * FROM qr_codes")).rows,schedules=(await db.query("SELECT * FROM campaign_schedules")).rows;
    let current,session;
    await t.test("own assignment opens with exact current calendar date; foreign and archived do not",async()=>{
      current=await run("GET");session=current.req.session;
      assert.equal(current.res.code,200);assert.match(current.res.body,/value="2026-09-28"/);
      assert.equal((await run("GET",{user:other})).res.code,404);
      assert.equal((await run("GET",{id:"12"})).res.code,404);
      assert.equal((await run("GET",{user:admin,id:"11"})).res.code,200);
    });
    const version=()=>db.query("SELECT xmin::text AS version FROM qr_campaigns WHERE id=10").then(r=>r.rows[0].version);
    const post=async(start,overrides={})=>run("POST",{session,body:{csrf:session.assignmentEditCsrf,version:await version(),start_date:start,...overrides}});
    await t.test("invalid or reversed dates do not update; request parameters cannot change owner",async()=>{
      assert.equal((await post("2026-02-30")).res.code,400);
      assert.equal((await post("2026-10-02")).res.code,400);
      const forbidden=await run("POST",{session:{user:other,assignmentEditCsrf:session.assignmentEditCsrf},body:{csrf:session.assignmentEditCsrf,version:await version(),start_date:"2026-09-23",user_id:7,role:"super_admin"}});
      assert.equal(forbidden.res.code,404);
      assert.equal((await db.query("SELECT started_at::date::text AS d FROM qr_campaigns WHERE id=10")).rows[0].d,"2026-09-28");
    });
    await t.test("same-date save preserves time precision; changing only start preserves all other records",async()=>{
      assert.equal((await post("2026-09-28")).res.code,303);
      assert.equal((await db.query("SELECT started_at::text AS d FROM qr_campaigns WHERE id=10")).rows[0].d,"2026-09-28 12:30:45.123456");
      const response=await post("2026-09-23",{qr_id:999,campaign_id:999,ended_at:"2040-01-01",is_active:false,contract_days:100});
      assert.equal(response.res.code,303);assert.equal(response.res.location,"/admin/edit-assignment/10?saved=1");
      assert.equal((await db.query("SELECT started_at::date::text AS d FROM qr_campaigns WHERE id=10")).rows[0].d,"2026-09-23");
      assert.deepEqual((await db.query("SELECT id,qr_id,campaign_id,assigned_at::text,ended_at::text,is_active,contract_days FROM qr_campaigns WHERE id=10")).rows,before);
      assert.deepEqual((await db.query("SELECT * FROM campaigns ORDER BY id")).rows,campaigns);
      assert.deepEqual((await db.query("SELECT * FROM qr_codes")).rows,qrs);
      assert.deepEqual((await db.query("SELECT * FROM campaign_schedules")).rows,schedules);
      assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM qr_campaigns")).rows[0].n,3);
    });
    await t.test("stale forms and a concurrent archive cannot overwrite the current assignment",async()=>{
      const oldVersion=await version();await db.exec("UPDATE qr_campaigns SET contract_days=10 WHERE id=10");
      assert.equal((await post("2026-09-22",{version:oldVersion})).res.code,409);
      const racing=harness(async(sql,args)=>{if(sql.startsWith("UPDATE qr_campaigns qc"))await db.exec("UPDATE qr_campaigns SET is_active=false WHERE id=10");return db.query(sql,args);});
      const result=await racing("POST",{session,body:{csrf:session.assignmentEditCsrf,version:await version(),start_date:"2026-09-22"}});
      assert.equal(result.res.code,409);
      assert.equal((await db.query("SELECT started_at::date::text AS d FROM qr_campaigns WHERE id=10")).rows[0].d,"2026-09-23");
    });
  }finally{await db.close();}
});
test("startup composes with private AI and scheduling installers and retains exactly one edit link",()=>{
  const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{execFileSync}=require("node:child_process");
  const root=path.resolve(__dirname,".."),tmp=fs.mkdtempSync(path.join(os.tmpdir(),"vivid-assignment-edit-"));
  const installers=["install-public-marketplace-redirect.js","install-ai-insights-performance.js","install-vivid-intelligence.js","install-ai-readiness.js","install-marketplace-campaign-builder.js","install-google-ads-observation.js","install-marketing-command-center.js","install-google-ads-readonly.js","install-campaign-calendar.js","install-assignment-edit.js","install-private-ai-preview.js"];
  try{
    for(const file of ["server.js",...installers])fs.copyFileSync(path.join(root,file),path.join(tmp,file));
    for(const file of installers)execFileSync(process.execPath,[path.join(tmp,file)],{stdio:"pipe"});
    const source=fs.readFileSync(path.join(tmp,"server.js"),"utf8");assert.equal(install(source),source);
    assert.equal(source.split('href="/admin/edit-assignment/${a.id}"').length,2);
    assert.match(source,/app.use\(aiPreviewMiddleware\)/);assert.match(source,/selected.source_rank ASC/);
    execFileSync(process.execPath,["--check",path.join(tmp,"server.js")],{stdio:"pipe"});
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
