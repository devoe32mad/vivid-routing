"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {PGlite}=require("@electric-sql/pglite");
const {configuration,hash,normalizeRows}=require("../google-ads-readonly");
const {SCHEMA,createStore,dashboardEvidence}=require("../google-ads-readonly-store");
const {recentRange,createAutoSync}=require("../google-ads-auto-sync");
const {googleRecommendations}=require("../marketing-performance-insights");
const config=configuration({GOOGLE_ADS_OBSERVATION_ENABLED:"true",GOOGLE_ADS_CLIENT_ID:"test",GOOGLE_ADS_CLIENT_SECRET:"secret",GOOGLE_ADS_TOKEN_KEY:Buffer.alloc(32,1).toString("base64"),GOOGLE_ADS_REDIRECT_URI:"https://example.com/admin/connectors/google-ads/callback"});
const account={id:"1234567890",descriptiveName:"Test",currencyCode:"USD",timeZone:"America/New_York",manager:false,testAccount:false};
const range={from:"2026-08-23",to:"2026-09-22"};
test("automatic sync persists scheduling, retries, recovery and reconnect state in PostgreSQL",async()=>{
  const db=new PGlite();
  try {
    await db.exec("CREATE TABLE users(id BIGINT PRIMARY KEY); INSERT INTO users VALUES(1)");
    const q=(sql,params)=>params?db.query(sql,params):db.exec(sql).then(r=>r.at(-1));
    const pool={connect:async()=>({query:q,release(){}})};
    let failure,reads=0;
    const reader={campaigns:async()=>[],account:async()=>account,report:async()=>{reads++;if(failure)throw Object.assign(Error("secret provider text"),{code:failure});return normalizeRows([{segments:{date:"2026-09-20"},campaign:{id:"99",name:"Test",status:"ENABLED",advertisingChannelType:"SEARCH"},metrics:{impressions:"100",clicks:"5",costMicros:"1000000",conversions:0,conversionsValue:0}}],account,range);}};
    const store=createStore({q,pool,config,reader});await store.ready();await q(SCHEMA);
    const connect=async()=>{
      const state=hash("test");await q("INSERT INTO google_ads_private_states VALUES($1,1,NOW()+INTERVAL '1 minute')",[state]);
      return store.authorize(1,{hash:state,customerId:account.id,managerId:""},{access_token:"secret-access",refresh_token:"secret-refresh",expires_at:Date.now()+3600000},account);
    };
    const id=await connect();assert.equal((await store.due()).length,1);
    assert.equal(await store.sync(1,id,range,{dueOnly:true}),1);
    let row=(await store.list(1))[0];assert.ok(row.last_auto_synced_at);assert.ok(new Date(row.next_sync_at)-new Date(row.last_attempt_at)>=3599000);
    assert.equal((await store.due()).length,0);
    assert.equal(await store.sync(1,id,range,{dueOnly:true}),null);assert.equal(reads,1);
    const schedule=row.next_sync_at;await store.sync(1,id,range);
    assert.deepEqual((await store.list(1))[0].next_sync_at,schedule); // Manual refresh does not delay automatic refresh.
    const makeDue=()=>q("UPDATE google_ads_private_connections SET next_sync_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[id]);
    await makeDue();failure="temporary";
    await assert.rejects(store.sync(1,id,range,{dueOnly:true}),{code:"temporary"});
    row=(await store.list(1))[0];assert.equal(row.status,"connected");assert.equal(row.last_error,"temporary");
    assert.ok(new Date(row.next_sync_at)-new Date(row.last_attempt_at)>=299000);assert.equal((await store.due()).length,0);
    assert.equal((await dashboardEvidence(q,1,range)).daily.length,1);
    assert.doesNotMatch(JSON.stringify(row),/secret/);
    await makeDue();failure=null;await store.sync(1,id,range,{dueOnly:true});
    assert.equal((await q("SELECT sync_failures FROM google_ads_private_connections")).rows[0].sync_failures,0);
    await makeDue();failure="authorization";await assert.rejects(store.sync(1,id,range,{dueOnly:true}),{code:"authorization"});
    assert.equal((await store.list(1))[0].status,"attention_required");assert.equal((await store.due()).length,0);
    assert.equal(await connect(),id);assert.equal((await store.due()).length,1);
    await store.disconnect(1,id);assert.equal((await store.due()).length,0);
    await assert.rejects(store.sync(1,id,range,{dueOnly:true}),{code:"not_found"});
  } finally {await db.close();}
});
test("worker prevents overlapping ticks, continues past locked accounts, and honors disable switch",async()=>{
  const calls=[],logs=[];let release;
  const gate=new Promise(resolve=>release=resolve);
  const store={ready:async()=>gate,due:async()=>[{id:1,owner_user_id:7,account_timezone:"UTC"},{id:2,owner_user_id:8,account_timezone:"UTC"}],sync:async(...args)=>{calls.push(args);if(args[1]===1)throw Object.assign(Error("secret"),{code:"55P03"});return 0;}};
  const logger={info:s=>logs.push(s),warn:s=>logs.push(s)};
  const worker=createAutoSync({store,logger});const first=worker.tick();await worker.tick();release();await first;
  assert.equal(calls.length,2);assert.deepEqual(calls[1][3],{dueOnly:true});assert.equal(logs.length,1);assert.match(logs[0],/succeeded/);assert.doesNotMatch(logs[0],/secret/);
  await createAutoSync({store:{ready:()=>assert.fail("disabled worker performed IO")},enabled:false}).tick();
});
test("automatic date window uses account midnight and survives DST",()=>{
  assert.deepEqual(recentRange("America/New_York",new Date("2026-03-09T03:30:00Z")),{from:"2026-02-06",to:"2026-03-08"});
  assert.deepEqual(recentRange("Asia/Tokyo",new Date("2026-09-22T18:00:00Z")),{from:"2026-08-24",to:"2026-09-23"});
});
const now=new Date("2026-09-22T18:00:00Z");
const connection={id:1,account_name:"Test",currency_code:"USD",account_timezone:"America/New_York",status:"connected",last_synced_at:now.toISOString(),last_from:"2026-08-23",last_to:"2026-09-22"};
const dailyRow=(date,overrides={})=>({connection_id:1,date,campaign_id:"1",campaign_name:"Search",channel:"SEARCH",currency_code:"USD",impressions:1000,clicks:30,cost_micros:30000000,conversions:0,...overrides});
test("recommendations withhold conclusions for stale, partial, empty and insufficient evidence",()=>{
  const run=(c,daily=[],selected=range)=>googleRecommendations({connections:[c],daily},selected,now);
  assert.equal(run({...connection,last_error:"temporary"})[0].signal,"Data freshness");
  assert.equal(run({...connection,last_synced_at:"bad"})[0].signal,"Data freshness");
  assert.equal(run({...connection,last_synced_at:"2026-09-21T18:00:00Z"})[0].signal,"Data freshness");
  assert.equal(run({...connection,status:"attention_required"})[0].signal,"Connection");
  assert.equal(run({...connection,last_from:"2026-09-20"})[0].signal,"Coverage");
  assert.equal(run(connection)[0].signal,"Awaiting data");
  assert.equal(run(connection,[dailyRow("2026-09-22")])[0].signal,"Awaiting data");
  assert.equal(run(connection,[dailyRow("2026-09-21",{clicks:5})])[0].signal,"Limited evidence");
  assert.equal(run(connection,[dailyRow("2026-09-21")],{from:"2026-09-20",to:"2026-09-22"})[0].signal,"Limited evidence");
});
test("recommendations compare completed equal windows and compatible campaign peers only",()=>{
  const daily=[dailyRow("2026-09-10"),dailyRow("2026-09-20",{cost_micros:60000000}),dailyRow("2026-09-22",{cost_micros:900000000})];
  let items=googleRecommendations({connections:[connection],daily},range,now);
  assert.ok(items.some(r=>r.signal==="Traffic trend"&&r.reason.includes("100%")));
  assert.ok(items.some(r=>r.signal==="Measurement"));
  assert.ok(items.every(r=>r.href.startsWith("/admin/connectors/google-ads/1?")));
  daily.push(dailyRow("2026-09-20",{campaign_id:"2",channel:"DISPLAY",cost_micros:1000000}));
  daily.push(dailyRow("2026-09-20",{campaign_id:"3",currency_code:"CAD",cost_micros:1000000}));
  items=googleRecommendations({connections:[connection],daily},range,now);
  assert.ok(!items.some(r=>r.signal==="Traffic signal"||r.signal==="Needs review"));
  daily.push(dailyRow("2026-09-20",{campaign_id:"4",cost_micros:1000000}));
  items=googleRecommendations({connections:[connection],daily},range,now);
  assert.ok(items.some(r=>r.signal==="Traffic signal"));assert.ok(items.some(r=>r.signal==="Needs review"));
});
