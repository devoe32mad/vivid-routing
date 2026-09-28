"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const{PGlite}=require("@electric-sql/pglite");
const{PATH,configuration,hash,id,seal,unseal,importRange,moneyMicros,normalize,createReader,TikTokAdsError}=require("../tiktok-ads-readonly");
const{SCHEMA,createStore,dashboardEvidence}=require("../tiktok-ads-store");
const{buildPlatforms}=require("../marketing-platform-dashboard");
const{renderCommandCenter}=require("../marketing-command-center");
const{home}=require("../tiktok-ads-routes");
const{install}=require("../install-tiktok-ads");
const{tiktokRecommendations}=require("../marketing-performance-insights");
const key=Buffer.alloc(32,9),env={TIKTOK_ADS_APP_ID:"1234567890",TIKTOK_ADS_APP_SECRET:"secret",TIKTOK_ADS_TOKEN_KEY:key.toString("base64"),TIKTOK_ADS_REDIRECT_URL:"https://vivid.example"+PATH+"/callback"};
const period={from:"2026-09-01",to:"2026-09-30"},account={id:"123",name:"Vivid",currency:"USD",timezone:"America/New_York"};
async function database(){const db=new PGlite();await db.exec("CREATE TABLE users(id BIGINT PRIMARY KEY);INSERT INTO users VALUES(1),(2),(25)");const q=(sql,params)=>params?db.query(sql,params):db.exec(sql).then(r=>r.at(-1));const pool={connect:async()=>({query:q,release(){}})};await db.exec(SCHEMA);return{db,q,pool};}

test("TikTok configuration, identifiers and encrypted tokens fail closed",()=>{
  assert.equal(configuration(env).appId,"1234567890");assert.equal(id("123"),"123");
  for(const value of ["0","-1","x",""])assert.equal(id(value),null);
  for(const change of [{TIKTOK_ADS_APP_ID:"app"},{TIKTOK_ADS_TOKEN_KEY:"bad"},{TIKTOK_ADS_REDIRECT_URL:"http://bad"}])assert.throws(()=>configuration({...env,...change}));
  const sealed=seal({access_token:"private"},key,"1:123");assert.deepEqual(unseal(sealed,key,"1:123"),{access_token:"private"});assert.throws(()=>unseal(sealed,key,"2:123"),TikTokAdsError);
});

test("TikTok imports are bounded and monetary values become exact micros",()=>{
  assert.deepEqual(importRange(period),period);assert.equal(moneyMicros("12.345678"),"12345678");assert.equal(moneyMicros("2"),"2000000");
  assert.throws(()=>importRange({from:"2026-09-01",to:"2026-10-02"}));assert.throws(()=>moneyMicros("-1"));
});

test("TikTok report rows normalize into immutable daily evidence",()=>{
  const rows=normalize([{dimensions:{campaign_id:"456",stat_time_day:"2026-09-02 00:00:00"},metrics:{spend:"12.34",impressions:"1000",clicks:"25",conversion:"3",total_purchase_value:"90.5",video_play_actions:"800",video_watched_2s:"600",video_watched_6s:"300"}}],account,period,new Map([["456",{name:"Awareness",objective:"TRAFFIC"}]]));
  assert.deepEqual(rows[0],{date:"2026-09-02",campaign_id:"456",campaign_name:"Awareness",objective:"TRAFFIC",currency_code:"USD",account_timezone:"America/New_York",impressions:"1000",clicks:"25",cost_micros:"12340000",conversions:"3",conversion_value:"90.5",video_views:"800",video_views_2s:"600",video_views_6s:"300",payload_hash:rows[0].payload_hash});
  assert.throws(()=>normalize([{},{}],account,period));
});

test("TikTok reader exchanges authorization, validates accounts and pages reports",async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{calls.push({url:String(url),options});const path=new URL(url).pathname;if(path.endsWith("/oauth2/access_token/"))return{ok:true,status:200,json:async()=>({code:0,data:{access_token:"token",advertiser_ids:["123"]}})};if(path.endsWith("/advertiser/info/"))return{ok:true,status:200,json:async()=>({code:0,data:{list:[{advertiser_id:"123",name:"Vivid",currency:"USD",timezone:"America/New_York"}]}})};if(path.endsWith("/campaign/get/"))return{ok:true,status:200,json:async()=>({code:0,data:{list:[{campaign_id:"456",campaign_name:"Campaign",objective_type:"TRAFFIC"}],page_info:{total_page:1}}})};return{ok:true,status:200,json:async()=>({code:0,data:{list:[{dimensions:{campaign_id:"456",stat_time_day:"2026-09-02"},metrics:{spend:"1",impressions:"2",clicks:"1",conversion:"0",video_play_actions:"2",video_watched_2s:"1",video_watched_6s:"0"}}],page_info:{total_page:1}}})};};
  const reader=createReader({config:configuration(env),fetcher}),token=await reader.exchange("code"),found=await reader.account(token.access_token,"123"),rows=await reader.report(token.access_token,found,period);
  assert.deepEqual(token.advertiser_ids,["123"]);assert.equal(found.name,"Vivid");assert.equal(rows.length,1);assert.equal(rows[0].campaign_name,"Campaign");assert.ok(calls.some(call=>call.url.includes("report%2Fintegrated")||call.url.includes("report/integrated")));assert.ok(calls.some(call=>call.url.includes("campaign%2Fget")||call.url.includes("campaign/get")));assert.equal(calls[1].options.headers["Access-Token"],"token");
});

test("TikTok storage keeps customer assignment, sync history and normalized video evidence",async()=>{
  assert.match(SCHEMA,/dashboard_user_id BIGINT/);assert.match(SCHEMA,/token_ciphertext TEXT NOT NULL/);assert.match(SCHEMA,/tiktok_ads_private_syncs/);assert.match(SCHEMA,/video_views_6s BIGINT NOT NULL/);
  const calls=[],q=async(sql,params)=>{calls.push({sql,params});return{rows:sql.includes("FROM tiktok_ads_private_connections")?[{id:4,account_id:"123"}]:[{connection_id:4,campaign_id:"456",video_views:"8"}]};};
  const evidence=await dashboardEvidence(q,17,period);assert.equal(evidence.connections[0].account_id,"123");assert.equal(evidence.rows[0].campaign_id,"456");assert.ok(calls.every(call=>call.params[0]===17));assert.match(calls[1].sql,/c\.dashboard_user_id=\$1/);
});

test("TikTok snapshots are atomic, owner isolated and assignable to a white-label customer",async()=>{
  const{db,q,pool}=await database();try{
    const config=configuration(env),state=hash("state"),otherState=hash("other");await q("INSERT INTO tiktok_ads_private_states VALUES($1,1,NOW()+INTERVAL '10 minutes'),($2,2,NOW()+INTERVAL '10 minutes')",[state,otherState]);
    let data=normalize([{dimensions:{campaign_id:"456",stat_time_day:"2026-09-02"},metrics:{spend:"1",impressions:"100",clicks:"10",conversion:"1",video_play_actions:"80",video_watched_2s:"60",video_watched_6s:"30"}}],account,period),fail=false;
    const reader={account:async()=>account,report:async()=>{if(fail){const error=Error("provider secret");error.code="temporary";throw error;}return data;}},store=createStore({q,pool,config,reader});
    const[id]=await store.authorize(1,{hash:state,dashboardUserId:25},{access_token:"private",advertiser_ids:["123"]},[account]);await store.authorize(2,{hash:otherState},{access_token:"other",advertiser_ids:["456"]},[{...account,id:"456",name:"Other"}]);
    assert.equal(await store.sync(1,id,period),1);assert.equal((await dashboardEvidence(q,25,period)).rows[0].clicks,"10");assert.equal((await dashboardEvidence(q,2,period)).rows.length,0);await assert.rejects(store.sync(2,id,period),{code:"not_found"});
    fail=true;await assert.rejects(store.sync(1,id,period),{code:"temporary"});assert.equal((await dashboardEvidence(q,25,period)).rows.length,1);
    fail=false;data=[];await store.sync(1,id,period);assert.equal((await dashboardEvidence(q,25,period)).rows.length,0);await store.disconnect(1,id);assert.equal((await store.list(1)).length,0);assert.equal((await store.list(2)).length,1);
  }finally{await db.close();}
});

test("TikTok renders actionable reporting without treating outcomes as verified revenue",()=>{
  const evidence={connections:[{id:4,account_name:"Vivid TikTok",status:"connected",last_synced_at:new Date(),dashboard_user_id:25}],rows:[{connection_id:4,campaign_id:"456",campaign_name:"Video campaign",objective:"TRAFFIC",currency_code:"USD",impressions:"1000",clicks:"25",cost_micros:"12340000",conversions:"3",conversion_value:"90.5",video_views:"800",video_views_2s:"600",video_views_6s:"300"}]};
  const scope={kind:"advertiser",userId:25,privateAdsAllowed:false},platforms=buildPlatforms({scope,range:period,campaigns:[],squareStatus:"Not connected",tiktokEvidence:evidence,tiktokEnabled:true});
  const tiktok=platforms.find(p=>p.id==="tiktok");assert.equal(tiktok.campaignCount,1);assert.equal(tiktok.metrics[2][1],"800");assert.equal(tiktok.manageHref,"");assert.match(tiktok.note,/not verified Vivid sales/);
  const html=renderCommandCenter({title:"Marketing Center",scope,range:period,campaigns:[],squareStatus:"Not connected",tiktokEvidence:evidence,tiktokEnabled:true});assert.match(html,/TikTok Ads/);assert.match(html,/1 campaigns with reporting · 1 accounts/);assert.doesNotMatch(html,/More platforms[\s\S]*TikTok Ads/);
});

test("TikTok connection page supports persistent authorization and white-label assignment",()=>{
  const html=home({configured:true,connections:[{id:4,account_id:"123",account_name:"Vivid TikTok",currency_code:"USD",status:"connected",dashboard_user_id:25}],csrf:"token",auto:true,customers:[{id:25,name:"Client"}]});
  assert.match(html,/Authorize TikTok once/);assert.match(html,/cannot change campaigns/);assert.match(html,/Automatic hourly sync/);assert.match(html,/Client \(account 25\)/);assert.match(html,/Assign and open Marketing Center/);
});

test("TikTok installer is idempotent",()=>{
  const source='const { registerLinkedInAdsRoutes } = require("./linkedin-ads-routes");\nconst { registerMarketingCommandCenterRoutes } = require("./marketing-command-center-routes");\nregisterMarketingCommandCenterRoutes({app});';
  const once=install(source);assert.equal(install(once),once);assert.match(once,/registerTikTokAdsRoutes/);assert.match(once,/registerTikTokAdsRoutes\(\{app,q,pool,page,requireLogin\}\)/);
});

test("TikTok recommendations require fresh evidence and keep reported outcomes unverified",()=>{
  const now=new Date("2026-09-28T13:00:00Z"),connection={id:4,account_name:"Vivid TikTok",account_timezone:"America/New_York",currency_code:"USD",status:"connected",last_synced_at:"2026-09-28T12:30:00Z",last_error:""};
  const row={connection_id:4,campaign_id:"456",campaign_name:"Video campaign",impressions:"5000",clicks:"50",cost_micros:"100000000",conversions:"2",conversion_value:"90",video_views:"4000",video_views_6s:"1000"};
  let items=tiktokRecommendations({connections:[connection],rows:[row]},period,now);assert.match(items[0].title,/Verify the reported outcomes/);assert.match(items[0].reason,/Reconcile them with GA4, Vivid and sales evidence/);assert.doesNotMatch(items[0].reason,/ROI|profitable/);
  items=tiktokRecommendations({connections:[{...connection,last_synced_at:"2026-09-28T09:00:00Z"}],rows:[row]},period,now);assert.equal(items.length,1);assert.equal(items[0].signal,"Data freshness");
  items=tiktokRecommendations({connections:[connection],rows:[{...row,impressions:"500",clicks:"10"}]},period,now);assert.equal(items[0].signal,"Limited evidence");
});

test("TikTok recommendations compare creative retention only with sufficient peer evidence",()=>{
  const connection={id:4,account_name:"Vivid TikTok",account_timezone:"UTC",currency_code:"USD",status:"connected",last_synced_at:"2026-09-28T12:30:00Z",last_error:""},base={connection_id:4,impressions:"5000",clicks:"50",cost_micros:"100000000",conversions:"0",conversion_value:"0",video_views:"4000"};
  const items=tiktokRecommendations({connections:[connection],rows:[{...base,campaign_id:"1",campaign_name:"Strong hook",video_views_6s:"1600"},{...base,campaign_id:"2",campaign_name:"Weak hook",video_views_6s:"400"}]},period,new Date("2026-09-28T13:00:00Z"));
  assert.equal(items.at(-1).signal,"Creative signal");assert.match(items.at(-1).reason,/controlled creative test/);assert.match(items.at(-1).reason,/does not establish sales performance/);
});
