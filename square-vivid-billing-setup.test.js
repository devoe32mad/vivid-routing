"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {installBillingSetup,BILLING_SCOPES,PATH}=require("./square-vivid-billing-setup");
const {installVividSubscriptions}=require("./square-vivid-subscriptions");

function harness(options={}) {
  const routes=new Map(),calls=[];
  const app={get:(p,h)=>routes.set("GET "+p,h),post:(p,h)=>routes.set("POST "+p,h)};
  installBillingSetup({app,env:{},ready:async()=>calls.push("ready"),
    q:async()=>{calls.push("query");return {rows:[{customer_id:7,merchant_id:"merchant",email:"<script>"}]};},
    getConnection:async()=>({token:{access_token:"never-output",vivid_scopes:options.scopes||""}}),
    api:async(path)=>{calls.push(path);return {objects:[{id:"variation",subscription_plan_variation_data:{name:"Vivid Performance",phases:[{cadence:"MONTHLY",pricing:{price_money:{amount:3500,currency:"USD"}}}]}}],cursor:options.cursor};}});
  installVividSubscriptions({app,env:{SQUARE_VIVID_BILLING_CUSTOMER_ID:"7",SQUARE_VIVID_PERFORMANCE_PLAN_VARIATION_ID:"variation"},q:()=>assert.fail("Checkout database access"),getConnection:()=>assert.fail("Checkout connection"),api:()=>assert.fail("Checkout API"),origin:"https://example.com"});
  const run=async(key,req)=>{
    const res={code:200,set(){return this;},status(code){this.code=code;return this;},type(){return this;},send(body){this.body=body;return this;}};
    await routes.get(key)(req,res);return res;
  };
  return {run,calls};
}
test("billing setup denies anonymous and advertiser access before reading accounts",async()=>{
  const h=harness();
  for(const [session,code] of [[{},401],[{user:{role:"customer"}},403]]){
    assert.equal((await h.run("GET "+PATH,{session})).code,code);
  }
  assert.deepEqual(h.calls,[]);
});
test("admin setup escapes account data and requests billing consent without exposing tokens",async()=>{
  const h=harness(),session={user:{role:"admin"}};
  const r=await h.run("GET "+PATH,{session,query:{customer_id:"7"}});
  assert.equal(r.code,200);
  assert.match(r.body,/&lt;script&gt;/);
  assert.doesNotMatch(r.body,/never-output|<script>/);
  assert.match(r.body,/name="billing" value="true"/);
  assert.match(r.body,/name="csrf" value="[a-f0-9]{64}"/);
  assert.equal(h.calls.length,2);
});
test("authorized catalog read shows exact plan ID and recurring price",async()=>{
  const h=harness({scopes:BILLING_SCOPES});
  const r=await h.run("GET "+PATH,{session:{user:{role:"super_admin"}},query:{customer_id:"7"}});
  assert.match(r.body,/variation/);
  assert.match(r.body,/MONTHLY · ongoing · 35.00 USD/);
  assert.ok(h.calls.includes("/v2/catalog/list?types=SUBSCRIPTION_PLAN_VARIATION"));
});
test("repeated catalog cursor fails instead of looping indefinitely",async()=>{
  const h=harness({scopes:BILLING_SCOPES,cursor:"repeat"});
  const r=await h.run("GET "+PATH,{session:{user:{role:"admin"}},query:{customer_id:"7"}});
  assert.equal(r.code,502);
  assert.equal(h.calls.length,4);
});
test("subscription checkout enforces CSRF and cannot collect before activation is implemented",async()=>{
  const h=harness();
  const run=(session,body)=>h.run("POST /admin/sponsorship-performance/subscribe",{session,body});
  assert.equal((await run({},{})).code,401);
  for(const csrf of [undefined,"wrong",["valid"]]){
    assert.equal((await run({user:{id:1},sponsorshipPerformanceCsrf:"valid"},{qr_id:1,csrf})).code,403);
  }
  assert.equal((await run({user:{id:1},sponsorshipPerformanceCsrf:"valid"},{qr_id:1,csrf:"valid"})).code,503);
});
