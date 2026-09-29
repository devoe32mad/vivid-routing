"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {configuration,seal,unseal,createReader,SCOPE}=require("../google-analytics-readonly");
const {createStore}=require("../google-analytics-store");
const {analyticsMetrics,analyticsSourceLabel,buildPlatforms}=require("../marketing-platform-dashboard");
const {install}=require("../install-google-analytics");
const env=()=>({GOOGLE_ADS_CLIENT_ID:"client",GOOGLE_ADS_CLIENT_SECRET:"secret",GOOGLE_ANALYTICS_TOKEN_KEY:crypto.randomBytes(32).toString("base64"),GOOGLE_ANALYTICS_REDIRECT_URI:"https://vivid-routing-production.up.railway.app/admin/connectors/google-analytics/callback"});
test("GA4 configuration is read-only and callback-bound",()=>{const c=configuration(env());assert.equal(c.redirect,"https://vivid-routing-production.up.railway.app/admin/connectors/google-analytics/callback");assert.equal(SCOPE,"https://www.googleapis.com/auth/analytics.readonly");assert.throws(()=>configuration({...env(),GOOGLE_ANALYTICS_REDIRECT_URI:"https://evil.test/callback"}));});
test("GA4 tokens are encrypted and property-context bound",()=>{const key=crypto.randomBytes(32),value={access_token:"a",refresh_token:"r",expires_at:1},cipher=seal(value,key,"7:123");assert.ok(!cipher.includes("refresh_token"));assert.deepEqual(unseal(cipher,key,"7:123"),value);assert.throws(()=>unseal(cipher,key,"7:456"));});
test("GA4 reader discovers properties and normalizes fixed reporting metrics",async()=>{const calls=[];const responses=[{access_token:"a",refresh_token:"r",expires_in:3600,scope:SCOPE},{accountSummaries:[{displayName:"Vivid",propertySummaries:[{property:"properties/123",displayName:"Web"}]}]},{dimensionHeaders:[{name:"date"},{name:"sessionSource"},{name:"sessionMedium"}],metricHeaders:[{name:"sessions"},{name:"totalUsers"},{name:"engagedSessions"},{name:"eventCount"},{name:"keyEvents"},{name:"totalRevenue"}],rows:[{dimensionValues:[{value:"20260925"},{value:"google"},{value:"cpc"}],metricValues:[{value:"10"},{value:"8"},{value:"6"},{value:"20"},{value:"2"},{value:"99.5"}]}]}];const fetcher=async(url,options={})=>{calls.push([String(url),options]);return {ok:true,json:async()=>responses.shift()};};const reader=createReader({config:configuration(env()),fetcher}),token=await reader.exchange("code"),properties=await reader.properties(token.access_token),rows=await reader.report(token.access_token,"123",{from:"2026-09-01",to:"2026-09-25"});assert.deepEqual(properties,[{property_id:"123",property_name:"Web",account_name:"Vivid"}]);assert.equal(rows[0].sessions,10);assert.equal(rows[0].key_events,2);assert.match(calls[2][0],/properties\/123:runReport$/);assert.equal(JSON.parse(calls[2][1].body).metrics.some(m=>m.name==="keyEvents"),true);});
test("GA4 dashboard uses the customer journey and remains separate from verified revenue",()=>{assert.deepEqual(analyticsMetrics([{sessions:10,users:8,engaged_sessions:6,key_events:2,revenue:99.5}]).map(x=>x[0]),["Visited · website sessions","Visitors","Engaged · meaningful visits","Engagement rate","Acted · key actions","Purchased · GA4-reported revenue"]);assert.equal(analyticsSourceLabel("(direct)","(none)"),"Direct visits");assert.equal(analyticsSourceLabel("google","cpc"),"Google Ads");assert.equal(analyticsSourceLabel("chatgpt.com","ai-assistant"),"Chatgpt Com referrals");const platforms=buildPlatforms({scope:{kind:"advertiser",privateAdsAllowed:true},range:{from:"2026-09-01",to:"2026-09-25"},campaigns:[],squareStatus:"Not connected",analyticsEnabled:true,analyticsEvidence:{connections:[],rows:[]}});const ga=platforms.find(p=>p.id==="ga4");assert.equal(ga.name,"Website Traffic & Engagement");assert.equal(ga.status,"Ready to connect");assert.match(ga.note,/not verified Vivid or POS revenue/);});
test("GA4 installer composes once with the Google Ads connector",()=>{const source='const { registerGoogleAdsReadOnlyRoutes } = require("./google-ads-readonly-routes");\nregisterGoogleAdsReadOnlyRoutes({app,q,pool,page,requireLogin});';const once=install(source),twice=install(once);assert.equal(once,twice);assert.equal((once.match(/registerGoogleAnalyticsRoutes\(\{/g)||[]).length,1);});
test("GA4 import failure rolls back its savepoint before recording retry state",async()=>{
  const key=crypto.randomBytes(32),queries=[];let aborted=false;
  const row={id:1,owner_user_id:7,property_id:"123",status:"connected",next_sync_at:new Date(0).toISOString(),token_ciphertext:seal({access_token:"a",refresh_token:"r",expires_at:Date.now()+3600000},key,"7:123")};
  const client={
    async query(sql){
      queries.push(sql);
      if(sql==="ROLLBACK TO SAVEPOINT google_analytics_import")aborted=false;
      else if(aborted){const error=new Error("transaction aborted");error.code="25P02";throw error;}
      if(sql.startsWith("SELECT * FROM google_analytics_private_connections"))return {rows:[row]};
      if(sql.startsWith("INSERT INTO google_analytics_private_daily")){aborted=true;const error=new Error("bad imported row");error.code="22P02";throw error;}
      return {rows:[]};
    },
    release(){}
  };
  const store=createStore({pool:{connect:async()=>client},q:async()=>({rows:[]}),config:{key},reader:{report:async()=>[{date:"2026-09-25",source:"google",medium:"cpc",sessions:1,users:1,engaged_sessions:1,event_count:1,key_events:0,revenue:0,payload_hash:"hash"}]}});
  await assert.rejects(()=>store.sync(7,1,{from:"2026-09-01",to:"2026-09-25"}),error=>error.code==="import_failed"&&error.diagnostic.stage==="evidence_insert"&&error.diagnostic.sourceCode==="22P02");
  assert.ok(queries.includes("ROLLBACK TO SAVEPOINT google_analytics_import"));
  assert.ok(queries.some(sql=>sql.includes("sync_failures=LEAST(sync_failures+1,10)")));
  assert.equal(queries.at(-1),"COMMIT");
});
