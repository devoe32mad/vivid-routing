"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {campaignEvidence,adaptationScenario,adaptationRecommendations,renderAdaptation}=require("../campaign-adaptation");
const {renderPerformanceCenter}=require("../performance-center");
const {renderCommandCenter}=require("../marketing-command-center");
const range={from:"2026-09-01",to:"2026-09-28"},now=new Date("2026-09-30T12:00:00Z");
const c=id=>({id,status:"connected",account_name:`Account ${id}`,currency_code:"USD",account_timezone:"UTC",last_synced_at:now.toISOString(),last_from:range.from,last_to:"2026-09-30"});
const row=(id,name,conversions,value,connection=1)=>({connection_id:connection,campaign_id:id,campaign_name:name,objective:"CONVERSIONS",currency_code:"USD",impressions:10000,clicks:100,conversions,conversion_value:value,cost_micros:1000000000});
const sources=()=>[{id:"google_ads",name:"Google Ads",evidence:{connections:[c(1)],rows:[row("a","Strong <offer>",20,4000),row("b","Weak",5,1000)]},href:()=>"/google"},{id:"linkedin",name:"LinkedIn Ads",evidence:{connections:[c(2)],rows:[row("c","Target",5,1000,2)]},href:()=>"/linkedin"}];
test("names source and target for both same-platform and cross-platform tests",()=>{
 const items=adaptationRecommendations(sources(),range,now);
 const same=items.find(x=>x.adaptation.target.id==="b"),cross=items.find(x=>x.adaptation.target.id==="c");
 assert.ok(same);assert.ok(cross);assert.equal(same.adaptation.source.id,"a");
 assert.equal(cross.adaptation.scenario.crossPlatform,true);assert.equal(cross.confidence,"Low");
 assert.match(cross.href,/platform=linkedin&campaign=2%3Ac/);
 assert.ok(same.adaptation.scenario.revenue>cross.adaptation.scenario.revenue);
 assert.equal(cross.adaptation.scenario.budget,100);
 assert.ok(Math.abs(cross.adaptation.scenario.revenue-106.52173913043478)<1e-8);
 assert.equal(cross.adaptation.scenario.baselineRevenue,100);
});
test("destination costs and lower observed value determine conservative projection",()=>{
 const data=campaignEvidence(sources(),range,now),source=data[0],target={...data[2],cpc:20,valuePerConversion:100};
 const p=adaptationScenario(source,target,40);assert.equal(p.cpc,23);assert.equal(p.valuePerConversion,100);assert.ok(p.revenueDifference<0);assert.ok(p.roi<0);
});
test("negative scenario remains visible with a do-not-replace explanation",()=>{
 const ss=sources();ss[0].evidence.rows[0]=row("a","Strong",10,2000);
 const rec=adaptationRecommendations(ss,range,now).find(x=>x.adaptation.target.id==="c");
 assert.ok(rec);assert.equal(rec.adaptation.favorable,false);assert.match(renderAdaptation(rec.adaptation),/does not support replacing/);
});
test("freshness, date coverage, currencies and objectives constrain comparisons",()=>{
 let ss=sources();ss[0].evidence.connections[0].last_synced_at="2026-09-29T12:00:00Z";assert.equal(adaptationRecommendations(ss,range,now).length,0);
 ss=sources();ss[0].evidence.connections[0].last_from="2026-09-10";assert.equal(adaptationRecommendations(ss,range,now).length,0);
 ss=sources();ss[1].evidence.rows[0].currency_code="EUR";assert.ok(!adaptationRecommendations(ss,range,now).some(x=>x.adaptation.target.id==="c"));
 ss=sources();ss[1].evidence.rows[0].objective="LEAD_GENERATION";assert.ok(!adaptationRecommendations(ss,range,now).some(x=>x.adaptation.target.id==="c"));
 ss=sources();ss[0].evidence.rows[0].conversions=2;assert.equal(adaptationRecommendations(ss,range,now).length,0);
});
test("missing revenue supports outcome-only scenarios without fabricated sales",()=>{
 const ss=sources();for(const s of ss)for(const r of s.evidence.rows)r.conversion_value=0;
 const item=adaptationRecommendations(ss,range,now)[0];assert.ok(item);assert.equal(item.adaptation.scenario.revenue,null);assert.match(renderAdaptation(item.adaptation),/Revenue and ROAS are unavailable/);
 for(const s of ss)for(const r of s.evidence.rows)r.objective="UNKNOWN";
 assert.equal(adaptationRecommendations(ss,range,now).length,0);
});
test("today is excluded using daily rows and incomplete aggregate-only periods are withheld",()=>{
 const ss=sources(),r={...range,to:"2026-09-30"};assert.equal(campaignEvidence(ss,r,now).length,0);
 for(const s of ss)s.evidence.daily=s.evidence.rows.flatMap(row=>[{...row,date:"2026-09-28"},{...row,date:"2026-09-30",cost_micros:999999999999}]);
 const evidence=campaignEvidence(ss,r,now);assert.equal(evidence.length,3);assert.equal(evidence[0].spend,1000);assert.equal(evidence[0].to,"2026-09-29");
});
test("renders detailed plans safely in primary and supporting recommendations",()=>{
 const recs=adaptationRecommendations(sources(),range,now,{gross_margin_pct:40});
 const html=renderPerformanceCenter({segmentInsights:{paid:recs.slice(0,3)}});
 assert.match(html,/Strong &lt;offer&gt;/);assert.doesNotMatch(html,/<offer>/);assert.match(html,/Exactly what to test/);assert.match(html,/Secondary profit and ROI/);
 assert.ok((html.match(/campaign-adaptation/g)||[]).length>=2);
});
test("platform drilldown includes cross-platform comparisons for either campaign",()=>{
 const ss=sources();for(const s of ss)s.evidence.connections[0].last_synced_at=new Date().toISOString();
 const html=renderCommandCenter({title:"Marketing",scope:{kind:"advertiser"},range,campaigns:[],googleEvidence:ss[0].evidence,linkedinEvidence:ss[1].evidence,platform:"linkedin",aiVisible:true});
 assert.match(html,/Cross-platform campaign adaptation/);assert.match(html,/Strong &lt;offer&gt;/);assert.match(html,/Exactly what to test/);
});
