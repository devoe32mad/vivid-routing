"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const {PGlite} = require("@electric-sql/pglite");
const {PATH,SCOPE,configuration,customerId,hash,seal,unseal,importRange,normalizeRows,createGoogleReader} = require("../google-ads-readonly");
const {SCHEMA,createStore,dashboardEvidence} = require("../google-ads-readonly-store");
const {registerGoogleAdsReadOnlyRoutes} = require("../google-ads-readonly-routes");
const {renderEvidence} = require("../google-ads-readonly-view");
const {registerMarketingCommandCenterRoutes} = require("../marketing-command-center-routes");
const env = {GOOGLE_ADS_OBSERVATION_ENABLED:"true",GOOGLE_ADS_CLIENT_ID:"test.apps.googleusercontent.com",
  GOOGLE_ADS_CLIENT_SECRET:"test-secret",GOOGLE_ADS_TOKEN_KEY:Buffer.alloc(32,7).toString("base64"),
  GOOGLE_ADS_REDIRECT_URI:"https://vivid.example"+PATH+"/callback"};
const config = configuration(env), range = {from:"2026-09-01",to:"2026-09-22"};
const account = {id:"1234567890",descriptiveName:"Account <script>",currencyCode:"CAD",timeZone:"America/Toronto",manager:false,testAccount:false};
const raw = (id="99",date="2026-09-20",value=12.5) => ({segments:{date},campaign:{id,name:"Search <img>",status:"ENABLED",advertisingChannelType:"SEARCH"},
  metrics:{impressions:"100",clicks:"8",costMicros:"1234567",conversions:0.5,conversionsValue:value}});
const token = () => ({access_token:"private-access",refresh_token:"private-refresh",expires_at:Date.now()+3600000});
const response = (data,status=200) => ({ok:status>=200&&status<300,status,json:async()=>data});
async function database() {
  const db = new PGlite();
  await db.exec("CREATE TABLE users(id BIGINT PRIMARY KEY); INSERT INTO users VALUES(1),(2)");
  const q = (sql,params) => params ? db.query(sql,params) : db.exec(sql).then(results=>results.at(-1));
  const pool = {connect:async()=>({query:q,release(){}})};
  await db.exec(SCHEMA);
  return {db,q,pool};
}
async function connect(store,q,userId=1,id=account.id) {
  const stateHash = hash("state-"+userId+id);
  await q("INSERT INTO google_ads_private_states VALUES($1,$2,NOW()+INTERVAL '10 minutes')",[stateHash,userId]);
  return store.authorize(userId,{hash:stateHash,customerId:id,managerId:""},token(),{...account,id});
}
function harness({q,pool,fetcher,configurationEnv=env,logger=console}) {
  const routes = {};
  registerGoogleAdsReadOnlyRoutes({app:{get:(path,...handlers)=>routes["GET "+path]=handlers,post:(path,...handlers)=>routes["POST "+path]=handlers},q,pool,
    page:(_,body)=>body,requireLogin:(req,res,next)=>req.session.user?next():res.status(401).send("login"),env:configurationEnv,fetcher,logger,startBackground:false});
  return async(method,path,req={})=>{
    req = {query:{},body:{},params:{},...req};
    req.session ||= {};
    req.session.save ||= cb=>cb();
    const res = {code:200,headers:{},status(value){this.code=value;return this;},set(k,v){this.headers[k]=v;},send(body){this.body=body;return this;},redirect(url){this.code=302;this.location=url;return this;}};
    const stack = routes[method+" "+PATH+path]; assert.ok(stack);
    async function dispatch(i) {if(!stack[i])return;let later;await stack[i](req,res,()=>later=dispatch(i+1));await later;}
    await dispatch(0); return res;
  };
}
test("configuration fails closed, strict IDs and dates reject query injection",()=>{
  assert.equal(config.version,"v25"); // No developer token is required by current Google policy.
  for(const change of [{GOOGLE_ADS_TOKEN_KEY:"x"},{GOOGLE_ADS_REDIRECT_URI:"http://bad"},{GOOGLE_ADS_REDIRECT_URI:env.GOOGLE_ADS_REDIRECT_URI+"?next=x"},{GOOGLE_ADS_API_VERSION:"../mutate"}])assert.throws(()=>configuration({...env,...change}));
  assert.equal(customerId("123-456-7890"),account.id);
  for(const value of ["x1234567890",["1234567890"],"1234-567890",1234567890])assert.equal(customerId(value),"");
  for(const bad of [{from:"2026-02-30",to:"2026-03-01"},{from:"2026-01-01",to:"2026-03-01"},{from:"2026-09-01' OR 1=1",to:range.to}])assert.throws(()=>importRange(bad));
});
test("encrypted credentials cannot be moved to another owner or account",()=>{
  const ciphertext = seal(token(),config.key,"1:1234567890");
  assert.doesNotMatch(ciphertext,/private/);
  assert.equal(unseal(ciphertext,config.key,"1:1234567890").access_token,"private-access");
  assert.throws(()=>unseal(ciphertext,config.key,"2:1234567890"));
  assert.throws(()=>unseal(ciphertext,config.key,"1:9999999999"));
  const parts=ciphertext.split(".");parts[1]=Buffer.alloc(16).toString("base64");
  assert.throws(()=>unseal(parts.join("."),config.key,"1:1234567890"));
});
test("normalization preserves micros, fractional attribution and negative adjustments; rejects malformed rows",()=>{
  const r=raw(); r.metrics.costMicros="9007199254740993";r.metrics.conversions=-0.25;r.metrics.conversionsValue=-10;
  const n=normalizeRows([r],account,range)[0];
  assert.equal(n.cost_micros,"9007199254740993");assert.equal(n.conversions,-0.25);assert.equal(n.conversion_value,-10);assert.equal(n.currency_code,"CAD");assert.equal(n.payload_hash.length,64);
  for(const rows of [[r,r],[raw("99","2026-08-01")],[{...raw(),metrics:{costMicros:"NaN"}}],[{...raw(),metrics:{costMicros:"9223372036854775808"}}],[{...raw(),metrics:{conversions:"garbage"}}]])assert.throws(()=>normalizeRows(rows,account,range));
});
test("transport follows report pagination and exposes only fixed read operations",async()=>{
  const calls=[];
  const reader=createGoogleReader({config,fetcher:async(url,options)=>{
    calls.push({url,options}); const body=JSON.parse(options.body);
    if(body.query.includes("FROM customer"))return response({results:[{customer:account}]});
    return response(body.pageToken?{results:[raw("100")]}:{results:[raw()],nextPageToken:"page-2"});
  }});
  const verified=await reader.account("access",account.id,"9999999999");
  assert.equal((await reader.report("access",account.id,"9999999999",verified,range)).length,2);
  assert.equal(calls.length,3);
  for(const c of calls){assert.equal(c.url,`https://googleads.googleapis.com/v25/customers/${account.id}/googleAds:search`);assert.equal(c.options.method,"POST");assert.equal(c.options.headers["login-customer-id"],"9999999999");assert.equal(c.options.headers["developer-token"],undefined);assert.doesNotMatch(c.options.body,/mutate|budget|bidding/i);assert.equal(c.options.redirect,"error");}
  assert.equal(JSON.parse(calls[1].options.body).query,JSON.parse(calls[2].options.body).query);
  assert.equal(reader.mutate,undefined);assert.equal(reader.search,undefined);
});
test("provider failures are sanitized; paging loops and manager accounts fail closed",async()=>{
  for(const [status,body,code] of [[429,{secret:"do not reveal"},"temporary"],[400,{error:"invalid_grant",secret:"private-refresh"},"authorization"],[403,{secret:"sensitive-account"},"google_access"]]){
    const reader=createGoogleReader({config,fetcher:async()=>response(body,status)});
    await assert.rejects(reader.refresh("refresh"),e=>e.code===code&&!e.message.includes("private"));
  }
  const looping=createGoogleReader({config,fetcher:async()=>response({results:[raw()],nextPageToken:"same"})});
  await assert.rejects(looping.report("access",account.id,"",account,range),{code:"invalid_report"});
  const manager=createGoogleReader({config,fetcher:async()=>response({results:[{customer:{...account,manager:true}}]})});
  await assert.rejects(manager.account("access",account.id,""),{code:"account"});
});
test("login, enterprise-only sessions, CSRF and disabled configuration block before network or SQL",async()=>{
  const unexpected=()=>{throw Error("Unexpected I/O");},run=harness({q:unexpected,pool:{},fetcher:unexpected});
  assert.equal((await run("GET","",{})).code,401);
  assert.equal((await run("GET","",{session:{orgUser:{id:1}}})).code,401);
  assert.equal((await run("POST","/connect",{session:{user:{id:1}}})).code,403);
  const disabled=harness({q:unexpected,pool:{},fetcher:unexpected,configurationEnv:{}});
  const home=await disabled("GET","",{session:{user:{id:1}}});assert.equal(home.code,200);assert.match(home.body,/not enabled yet/);
  assert.equal((await disabled("POST","/connect",{session:{user:{id:1}}})).code,503);
});
test("OAuth binds user and browser, consumes state once, checks account and never renders tokens",async()=>{
  const {db,q,pool}=await database();
  try {
    const calls=[],run=harness({q,pool,fetcher:async(url,options)=>{
      calls.push({url,options});return url.endsWith("/token")?response({...token(),expires_in:3600,scope:SCOPE}):response({results:[{customer:account}]});
    }});
    const session={user:{id:1}};
    await run("GET","",{session});
    const launched=await run("POST","/connect",{session,body:{csrf:session.googleAdsCsrf,customer_id:account.id,owner_user_id:2}});
    assert.equal(launched.code,302);
    const url=new URL(launched.location),state=url.searchParams.get("state");assert.equal(url.origin,"https://accounts.google.com");assert.equal(url.searchParams.get("scope"),SCOPE);assert.equal(url.searchParams.get("access_type"),"offline");
    const pending={...session.googleAdsPending};
    assert.equal((await run("GET","/callback",{session:{user:{id:2},googleAdsPending:pending},query:{state,code:"code"}})).code,403);
    assert.equal((await run("GET","/callback",{session,query:{state:"bad",code:"code"}})).code,403);assert.equal(calls.length,0);
    assert.equal((await run("GET","/callback",{session,query:{state,code:"code"}})).code,302);
    const saved=(await q("SELECT * FROM google_ads_private_connections")).rows[0];assert.equal(Number(saved.owner_user_id),1);assert.doesNotMatch(saved.token_ciphertext,/private/);
    const home=await run("GET","",{session});assert.doesNotMatch(home.body,/private-access|private-refresh|<script>/);assert.match(home.body,/Account &lt;script&gt;/);
    assert.equal((await run("GET","/callback",{session:{user:{id:1},googleAdsPending:pending},query:{state,code:"code"}})).code,403);assert.equal(calls.length,2);
    assert.equal((await run("GET","/:connectionId",{session:{user:{id:2}},params:{connectionId:String(saved.id)}})).code,404);
    assert.equal((await run("POST","/:connectionId/disconnect",{session:{user:{id:2},googleAdsCsrf:"csrf"},params:{connectionId:String(saved.id)},body:{csrf:"csrf",confirm:"remove"}})).code,404);
  } finally {await db.close();}
});
test("real PostgreSQL imports replace snapshots, preserve failed reports and isolate owners",async()=>{
  const {db,q,pool}=await database();
  try {
    let data=normalizeRows([raw(),raw("100")],account,range),fail=false,refreshes=0;
    const reader={account:async()=>account,refresh:async()=>{refreshes++;return token();},report:async()=>{if(fail){const e=Error("private response");e.code="temporary";throw e;}return data;}};
    const store=createStore({q,pool,config,reader});await store.ready();
    const id=await connect(store,q),other=await connect(store,q,2);
    await assert.rejects(store.sync(2,id,range),{code:"not_found"});
    assert.equal(await store.sync(1,id,range),2);assert.equal(await store.sync(1,id,range),2);
    assert.equal((await q("SELECT * FROM google_ads_private_daily")).rows.length,2);
    data=normalizeRows([raw("99","2026-09-20",-2)],account,range);await store.sync(1,id,range);
    let evidence=await dashboardEvidence(q,1,range);assert.equal(evidence.rows.length,1);assert.equal(evidence.rows[0].conversion_value,"-2");assert.equal(evidence.rows[0].currency_code,"CAD");
    assert.equal((await dashboardEvidence(q,2,range)).rows.length,0);
    const last=(await store.list(1))[0].last_synced_at;
    fail=true;await assert.rejects(store.sync(1,id,range),{code:"temporary"});
    assert.equal((await dashboardEvidence(q,1,range)).rows[0].conversion_value,"-2");assert.deepEqual((await store.list(1))[0].last_synced_at,last);
    assert.equal((await q("SELECT error_code FROM google_ads_private_syncs WHERE status='failed'")).rows[0].error_code,"temporary");
    // Expired access tokens are renewed server-side; refresh credentials stay encrypted.
    await q("UPDATE google_ads_private_connections SET token_ciphertext=$1 WHERE id=$2",[seal({...token(),expires_at:0},config.key,"1:"+account.id),id]);
    fail=false;data=[];await store.sync(1,id,range);assert.equal(refreshes,1);assert.equal((await dashboardEvidence(q,1,range)).rows.length,0);
    const renamed=raw("99","2026-09-21");renamed.campaign.name="Latest name";renamed.campaign.status="PAUSED";
    data=normalizeRows([raw(),renamed],account,range);await store.sync(1,id,range);
    const grouped=(await dashboardEvidence(q,1,range)).rows;
    assert.equal(grouped.length,1);assert.equal(grouped[0].campaign_name,"Latest name");assert.equal(grouped[0].campaign_status,"PAUSED");assert.equal(grouped[0].clicks,"16");
    await store.disconnect(1,id);assert.equal((await store.list(1)).length,0);assert.equal((await store.list(2)).length,1);
    assert.equal((await q("SELECT COUNT(*)::int count FROM google_ads_private_syncs WHERE connection_id=$1",[id])).rows[0].count,0);
    assert.ok(other);
  } finally {await db.close();}
});
test("SQL failure during snapshot replacement rolls back evidence and success status together",async()=>{
  const {db,q,pool}=await database();
  try {
    const reader={account:async()=>account,report:async()=>normalizeRows([raw()],account,range)};
    const initial=createStore({q,pool,config,reader}),id=await connect(initial,q);await initial.sync(1,id,range);
    const failingPool={connect:async()=>({query:(sql,params)=>sql.includes("INSERT INTO google_ads_private_daily")?Promise.reject(Error("database failure")):q(sql,params),release(){}})};
    const broken=createStore({q,pool:failingPool,config,reader});await assert.rejects(broken.sync(1,id,range));
    assert.equal((await q("SELECT * FROM google_ads_private_daily")).rows.length,1);
    assert.equal((await q("SELECT * FROM google_ads_private_syncs")).rows.length,1);
  } finally {await db.close();}
});
test("disconnect invalidates pending consent and prevents a late callback reconnect",async()=>{
  const {db,q,pool}=await database();
  try {
    const store=createStore({q,pool,config,reader:{}}),id=await connect(store,q);
    await q("INSERT INTO google_ads_private_states VALUES('pending',1,NOW()+INTERVAL '10 minutes')");
    await store.disconnect(1,id);
    await assert.rejects(store.authorize(1,{hash:"pending",customerId:account.id,managerId:""},token(),account),{code:"state"});
    assert.equal((await store.list(1)).length,0);
  } finally {await db.close();}
});
test("denied, expired and failed OAuth attempts cannot store a connection",async()=>{
  const {db,q,pool}=await database();
  try {
    const run=harness({q,pool,fetcher:async()=>response({error:"invalid_grant",secret:"private"},400)});
    const session={user:{id:1}};await run("GET","",{session});
    const start=()=>run("POST","/connect",{session,body:{csrf:session.googleAdsCsrf,customer_id:account.id}});
    await start();let state=session.googleAdsPending.state;
    assert.equal((await run("GET","/callback",{session,query:{state,error:"access_denied"}})).location,PATH+"?notice=denied");
    assert.equal((await q("SELECT * FROM google_ads_private_states")).rows.length,0);
    await start();state=session.googleAdsPending.state;session.googleAdsPending.until=0;
    assert.equal((await run("GET","/callback",{session,query:{state,code:"code"}})).code,403);
    await start();state=session.googleAdsPending.state;
    const failed=await run("GET","/callback",{session,query:{state,code:"code"}});assert.equal(failed.code,502);assert.doesNotMatch(failed.body,/private/);
    assert.equal((await q("SELECT * FROM google_ads_private_states")).rows.length,0);
    assert.equal((await q("SELECT * FROM google_ads_private_connections")).rows.length,0);
  } finally {await db.close();}
});
test("dashboard integrates only the logged-in advertiser's Google evidence; enterprise never queries it",async()=>{
  const routes={},calls=[];
  registerMarketingCommandCenterRoutes({app:{get:(path,...handlers)=>routes[path]=handlers},q:async(sql,params)=>{
    calls.push({sql,params});
    if(sql.includes("FROM advertisers"))return {rows:[{id:8,name:"School sponsor",organization_name:"School"}]};
    if(sql.includes("FROM google_ads_private_connections"))return {rows:[{id:1,account_name:"Private Google account",status:"connected",customer_id:account.id,account_timezone:account.timeZone}]};
    if(sql.includes("FROM google_ads_private_daily"))return {rows:[{connection_id:1,campaign_id:"99",campaign_name:"Private campaign",currency_code:"CAD",account_timezone:account.timeZone,cost_micros:"1000000",conversions:"2",conversion_value:"90"}]};
    return {rows:[]};
  },page:(_,b)=>b,orgPage:(_,b)=>b,organizationNav:()=>"",requireLogin:(req,res,next)=>next(),requireOrganizationPermission:()=>((req,res,next)=>next()),getOrganizationScope:async()=>({organizationId:23}),env});
  const res={status(){return this;},send(body){this.body=body;}};
  await routes["/admin/marketing-command-center"].at(-1)({session:{user:{id:7}},query:{...range,user_id:999}},res);
  assert.match(res.body,/Google Ads/);assert.match(res.body,/1 CAD/);
  assert.match(res.body,/Recorded conversion value · USD<\/small><strong class="mcc-number">\$0.00/);
  const privateCalls=calls.filter(c=>c.sql.includes("google_ads_private"));assert.equal(privateCalls.length,3);for(const c of privateCalls)assert.equal(c.params[0],7);
  calls.length=0;
  await routes["/org-marketing-command-center/advertiser/:advertiserId"].at(-1)({session:{orgUser:{id:3}},params:{advertiserId:"8"},query:range},res);
  assert.doesNotMatch(res.body,/Private Google|Private campaign/);assert.ok(calls.every(c=>!c.sql.includes("google_ads_private")));
});
test("evidence UI escapes names, keeps currency and attribution distinctions, and labels partial imports",()=>{
  const html=renderEvidence({connections:[{id:1,account_name:"<img>",customer_id:account.id,account_timezone:account.timeZone}],rows:[{connection_id:1,campaign_id:"99",campaign_name:"<script>",currency_code:"CAD",account_timezone:account.timeZone,cost_micros:"1000000",conversion_value:"12"}]},range);
  assert.doesNotMatch(html,/<img>|<script>/);assert.match(html,/1 CAD/);assert.match(html,/not verified sales/);assert.match(html,/missing dates are not evidence of zero/);assert.match(html,/America\/Toronto/);
});


test("provider diagnostics distinguish credentials, account setup and project access without leaking data",async()=>{
  const failure = (field,value) => ({error:{message:"private-provider-message",details:[{
    errors:[{errorCode:{[field]:value},message:"private-access",trigger:{stringValue:"private-refresh"}}],
    requestId:"private-request-id"}]}});
  const cases = [
    [400,{error:"invalid_client",error_description:"private-secret"},"oauth_client","invalid_client","exchange"],
    [401,{error:"invalid_client"},"oauth_client","invalid_client","refresh"],
    [403,failure("authorizationError","INCOMPLETE_SIGNUP"),"customer_signup","INCOMPLETE_SIGNUP","account"],
    [403,failure("authorizationError","USER_PERMISSION_DENIED"),"account_permission","USER_PERMISSION_DENIED","account"],
    [403,failure("authorizationError","CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION"),"project_access","CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION","account"],
    [403,{error:{details:[{reason:"SERVICE_DISABLED",metadata:{secret:"private-secret"}}]}},"api_disabled","SERVICE_DISABLED","account"],
    [403,{error:{details:[{reason:"ACCESS_TOKEN_SCOPE_INSUFFICIENT"}]}},"oauth_scope","ACCESS_TOKEN_SCOPE_INSUFFICIENT","report"],
    [400,failure("requestError","private-secret"),"google_access","UNKNOWN","account"],
    [400,null,"google_access","UNKNOWN","account"],
    [503,{error:"invalid_client"},"temporary","invalid_client","exchange"]
  ];
  for(const [status,body,code,providerCode,operation] of cases) {
    const reader=createGoogleReader({config,fetcher:async()=>response(body,status)});
    const call=operation==="account"?reader.account("private-access",account.id,""):
      operation==="report"?reader.report("private-access",account.id,"",account,range):reader[operation]("private-code");
    await assert.rejects(call,error=>{
      assert.equal(error.code,code);
      assert.deepEqual(error.diagnostic,{stage:{exchange:"oauth_exchange",refresh:"oauth_refresh",account:"account_check",report:"report_read"}[operation],httpStatus:status,providerCode});
      assert.doesNotMatch(JSON.stringify(error),/private-/);
      return true;
    });
  }
});
test("failed OAuth callback shows actionable error, logs only codes and consumes state without saving a connection",async()=>{
  const {db,q,pool}=await database();
  try {
    const logs=[],run=harness({q,pool,logger:{warn:message=>logs.push(message)},fetcher:async()=>response({error:"invalid_client",error_description:"private-secret"},400)});
    const session={user:{id:1}};
    await run("GET","",{session});
    const launched=await run("POST","/connect",{session,body:{csrf:session.googleAdsCsrf,customer_id:account.id}});
    const state=new URL(launched.location).searchParams.get("state");
    const result=await run("GET","/callback",{session,query:{state,code:"private-code"}});
    assert.equal(result.code,502);assert.match(result.body,/matching client secret in Railway/);
    assert.deepEqual(logs,['google_ads_readonly_failure {"stage":"oauth_exchange","httpStatus":400,"providerCode":"invalid_client"}']);
    assert.doesNotMatch(result.body+logs.join(),/private-|1234567890/);
    assert.equal((await q("SELECT * FROM google_ads_private_connections")).rows.length,0);
    assert.equal((await q("SELECT * FROM google_ads_private_states")).rows.length,0);
    assert.equal(session.googleAdsPending,undefined);
  } finally {await db.close();}
});
