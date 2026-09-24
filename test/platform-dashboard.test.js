"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {buildPlatforms,dashboardHref}=require("../marketing-platform-dashboard");
const {renderCommandCenter}=require("../marketing-command-center");
const scope={kind:"advertiser",userId:7},range={from:"2026-09-01",to:"2026-09-22"};
const campaigns=[{id:1,name:"Offer A",scans:10,clicks:4,conversions:2,conversion_value:100,square_conversions:1,square_value:40},{id:2,name:"Offer B",scans:20,clicks:6,conversions:3,conversion_value:200,square_conversions:2,square_value:80}];
const connection=id=>({id,account_name:"Account "+id,currency_code:id===1?"USD":"CAD",status:"connected",account_timezone:"UTC",last_synced_at:new Date().toISOString(),last_from:range.from,last_to:range.to});
const googleEvidence={connections:[connection(1),connection(2)],rows:[
  {connection_id:1,campaign_id:"99",campaign_name:"Old name",campaign_status:"ENABLED",channel:"SEARCH",currency_code:"USD",impressions:100,clicks:10,cost_micros:10000000,conversions:1,conversion_value:50},
  {connection_id:1,campaign_id:"99",campaign_name:"New name",campaign_status:"PAUSED",channel:"SEARCH",currency_code:"USD",impressions:300,clicks:20,cost_micros:20000000,conversions:2,conversion_value:100},
  {connection_id:2,campaign_id:"99",campaign_name:"Different account",campaign_status:"ENABLED",channel:"SEARCH",currency_code:"CAD",impressions:600,clicks:20,cost_micros:40000000,conversions:3,conversion_value:150}
],daily:[{connection_id:1,campaign_id:"99",date:"2026-09-20",impressions:100,clicks:10,currency_code:"USD",cost_micros:10000000,conversions:1,conversion_value:50},{connection_id:2,campaign_id:"99",date:"2026-09-20",impressions:600,clicks:20,currency_code:"CAD",cost_micros:40000000,conversions:3,conversion_value:150}]};
const data={title:"Your marketing",scope,range,campaigns,googleEvidence,googleEnabled:true,squareStatus:{connected:true,label:"Automatic sync every 5 minutes"}};
const metric=(p,label)=>p.metrics.find(m=>m[0]===label)?.[1];
test("platform totals aggregate campaigns and preserve attribution/currency boundaries",()=>{
  const [vivid,square,google]=buildPlatforms(data);
  assert.equal(metric(vivid,"Scans"),"30");assert.equal(metric(vivid,"Intent actions"),"10");assert.equal(metric(vivid,"Recorded conversions"),"5");
  assert.equal(metric(square,"Matched purchases"),"3");assert.equal(metric(square,"Matched net value"),"120 USD");
  assert.equal(metric(google,"Impressions"),"1,000");assert.equal(metric(google,"Clicks"),"50");assert.equal(metric(google,"Click-through rate"),"5%");
  assert.equal(metric(google,"Spend"),"30 USD · 40 CAD");assert.equal(metric(google,"Reported conversions"),"6");
  assert.equal(google.campaignCount,2);assert.deepEqual(google.rows.map(r=>r.key),["1:99","2:99"]);
  assert.equal(google.rows[0].daily.length,1);assert.equal(google.rows[1].daily.length,1);
});
test("overview retains combined summary before uniform platform cards and removes inline campaign tables",()=>{
  const html=renderCommandCenter(data);
  assert.ok(html.indexOf("Across your platforms")<html.indexOf("Your platforms"));
  for(const label of ["Scans","Intent actions","Ad impressions","Ad clicks","Ad spend","Recorded conversions","Verified matched purchases","Google-reported conversions","Meta-reported purchases"])assert.ok(html.includes(label));
  assert.equal((html.match(/data-platform=/g)||[]).length,4);
  assert.match(html,/Recorded conversion value · USD<\/small><strong class="mcc-number">\$300.00/);
  assert.doesNotMatch(html,/<table>/);assert.match(html,/not added again/);
});
test("drill-down preserves range and separates same campaign IDs across accounts",()=>{
  const list=renderCommandCenter({...data,platform:"google_ads"});
  assert.match(list,/All campaigns/);assert.match(list,/campaign=1%3A99/);assert.match(list,/campaign=2%3A99/);
  const detail=renderCommandCenter({...data,platform:"google_ads",campaign:"2:99"});
  assert.match(detail,/Different account/);assert.match(detail,/Daily performance/);assert.match(detail,/Account sync &amp; import history/);
  assert.doesNotMatch(detail,/Old name|New name/);
  assert.equal(new URL(dashboardHref(scope,range,"google_ads","2:99"),"https://example.com").searchParams.get("to"),range.to);
  const missing=renderCommandCenter({...data,platform:"google_ads",campaign:"999:99"});assert.match(missing,/Campaign not found/);
});
test("empty reporting uses unknown values, enterprise omits private accounts, and names are escaped",()=>{
  const empty=buildPlatforms({...data,googleEvidence:{connections:[connection(1)],rows:[]}}).find(p=>p.id==="google_ads");
  assert.equal(metric(empty,"Clicks"),"—");assert.equal(empty.campaignCount,0);
  assert.equal(buildPlatforms({...data,scope:{kind:"enterprise",orgId:2,advertiserId:8}}).some(p=>p.id==="google_ads"),false);
  const html=renderCommandCenter({...data,platform:"vivid",campaigns:[{id:1,name:'<img onerror="bad">',scans:1}]});
  assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});
