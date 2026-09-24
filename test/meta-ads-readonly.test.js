"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {PGlite}=require("@electric-sql/pglite");
const {PATH,SCOPE,configuration,accountId,hash,seal,unseal,importRange,normalize,createReader}=require("../meta-ads-readonly");
const {SCHEMA,createStore,dashboardEvidence}=require("../meta-ads-store");
const {buildPlatforms}=require("../marketing-platform-dashboard");
const {install}=require("../install-meta-ads");
const env={META_ADS_OBSERVATION_ENABLED:"true",META_ADS_APP_ID:"123456789",META_ADS_APP_SECRET:"secret",META_ADS_TOKEN_KEY:Buffer.alloc(32,4).toString("base64"),META_ADS_REDIRECT_URL:"https://vivid.example"+PATH+"/callback"};
const config=configuration(env),period={from:"2026-09-01",to:"2026-09-24"},account={id:"act_123",name:"Meta account",currency:"USD",timezone_name:"America/New_York"};
const raw=(id="9",date="2026-09-20")=>({campaign_id:id,campaign_name:"Campaign <script>",objective:"OUTCOME_SALES",date_start:date,date_stop:date,impressions:"100",clicks:"12",inline_link_clicks:"8",spend:"12.345678",actions:[{action_type:"lead",value:"2"},{action_type:"offsite_conversion.fb_pixel_purchase",value:"1"},{action_type:"omni_purchase",value:"99"}],action_values:[{action_type:"offsite_conversion.fb_pixel_purchase",value:"45.50"}]});
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
async function database(){const db=new PGlite();await db.exec("CREATE TABLE users(id BIGINT PRIMARY KEY);INSERT INTO users VALUES(1),(2)");const q=(sql,params)=>params?db.query(sql,params):db.exec(sql).then(r=>r.at(-1));const pool={connect:async()=>({query:q,release(){}})};await db.exec(SCHEMA);return{db,q,pool};}
async function connect(store,q,user=1,id="123"){const state=hash(`${user}:${id}`);await q("INSERT INTO meta_ads_private_states VALUES($1,$2,NOW()+INTERVAL '10 minutes')",[state,user]);return store.authorize(user,{hash:state,accountId:id},{access_token:"private",expires_at:Date.now()+86400000},{...account,id:"act_"+id});}

test("Meta configuration, identifiers and import dates fail closed",()=>{
  assert.equal(config.version,"v26.0");assert.equal(accountId("act_123"),"123");assert.equal(accountId("123"),"123");
  for(const value of [123,"0","1 OR 1=1","act_01"]){assert.equal(accountId(value),null);}
  for(const change of [{META_ADS_TOKEN_KEY:"bad"},{META_ADS_REDIRECT_URL:"http://bad"},{META_ADS_REDIRECT_URL:env.META_ADS_REDIRECT_URL+"?x=1"},{META_ADS_API_VERSION:"../v26"}])assert.throws(()=>configuration({...env,...change}));
  for(const value of [{from:"2026-02-30",to:"2026-03-01"},{from:"2026-01-01",to:"2026-02-02"},{from:"x",to:period.to}])assert.throws(()=>importRange(value));
});

test("Meta credentials are encrypted and bound to owner and account",()=>{
  const value=seal({access_token:"private"},config.key,"1:123");assert.doesNotMatch(value,/private/);assert.equal(unseal(value,config.key,"1:123").access_token,"private");assert.throws(()=>unseal(value,config.key,"2:123"));assert.throws(()=>unseal(value,config.key,"1:456"));
});

test("normalization keeps exact spend and does not double count purchase aliases",()=>{
  const row=normalize([raw()],account,period)[0];assert.equal(row.cost_micros,"12345678");assert.equal(row.purchases,"1");assert.equal(row.leads,"2");assert.equal(row.purchase_value,"45.50");assert.equal(row.payload_hash.length,64);
  for(const rows of [[raw(),raw()],[raw("9","2026-08-20")],[{...raw(),spend:"NaN"}],[{...raw(),actions:[{action_type:"lead",value:"1"},{action_type:"lead",value:"2"}]}]])assert.throws(()=>normalize(rows,account,period));
});

test("reader uses fixed Graph endpoints, bearer auth and cursor pagination",async()=>{
  const calls=[],reader=createReader({config,fetcher:async(url,options)=>{calls.push({url:new URL(url),options});return response(calls.length===1?{data:[raw()],paging:{next:"provider URL is ignored",cursors:{after:"cursor"}}}:{data:[raw("10")]});}});
  const rows=await reader.report("access",account,period);assert.equal(rows.length,2);assert.equal(calls.length,2);
  for(const call of calls){assert.equal(call.url.origin,"https://graph.facebook.com");assert.equal(call.url.pathname,`/${config.version}/${account.id}/insights`);assert.equal(call.options.headers.Authorization,"Bearer access");assert.equal(call.options.redirect,"error");assert.match(call.url.searchParams.get("fields"),/impressions/);}
  assert.equal(calls[1].url.searchParams.get("after"),"cursor");assert.equal(reader.mutate,undefined);
});

test("private evidence is owner isolated and snapshot imports replace atomically",async()=>{
  const {db,q,pool}=await database();try{let data=normalize([raw()],account,period),fail=false;const reader={account:async()=>account,report:async()=>{if(fail){const e=Error("provider secret");e.code="temporary";throw e;}return data;}};const store=createStore({q,pool,config,reader});const id=await connect(store,q),other=await connect(store,q,2,"456");
    assert.equal(await store.sync(1,id,period),1);assert.equal((await dashboardEvidence(q,1,period)).rows[0].purchases,"1");assert.equal((await dashboardEvidence(q,2,period)).rows.length,0);await assert.rejects(store.sync(2,id,period),{code:"not_found"});
    data=[];await store.sync(1,id,period);assert.equal((await dashboardEvidence(q,1,period)).rows.length,0);data=normalize([raw()],account,period);await store.sync(1,id,period);fail=true;await assert.rejects(store.sync(1,id,period),{code:"temporary"});assert.equal((await dashboardEvidence(q,1,period)).rows.length,1);
    await store.disconnect(1,id);assert.equal((await store.list(1)).length,0);assert.equal((await store.list(2)).length,1);assert.ok(other);
  }finally{await db.close();}
});

test("Meta renders as a consistent platform drill-down and remains separate from Google",()=>{
  const evidence={connections:[{id:4,account_id:"123",account_name:"Account <img>",currency_code:"USD",account_timezone:"America/New_York",status:"connected",last_synced_at:new Date()}],rows:[{connection_id:4,campaign_id:"9",campaign_name:"Campaign <script>",objective:"SALES",currency_code:"USD",account_timezone:"America/New_York",impressions:"100",clicks:"12",link_clicks:"8",cost_micros:"12345678",purchases:"1",leads:"2",purchase_value:"45.5"}],daily:[]};
  const platforms=buildPlatforms({scope:{kind:"advertiser",userId:1},range:period,campaigns:[],squareStatus:"Not connected",googleEvidence:null,googleEnabled:false,metaEvidence:evidence,metaEnabled:true});const meta=platforms.find(p=>p.id==="meta");assert.equal(meta.campaignCount,1);assert.equal(meta.rows[0].cells[7],"1");assert.equal(meta.rows[0].cells[8],"2");assert.equal(meta.rows[0].dailyKind,"meta");
});

test("installer composes before or after Google installer and is idempotent",()=>{const source='const { registerMarketingCommandCenterRoutes } = require("./marketing-command-center-routes");\nregisterMarketingCommandCenterRoutes({app});';const once=install(source),twice=install(once);assert.equal(once,twice);assert.match(once,/registerMetaAdsRoutes/);});
