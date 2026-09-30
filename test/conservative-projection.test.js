"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {conservativeProjection,renderProjection}=require("../conservative-projection");
const {campaignRecommendations}=require("../marketing-performance-insights");
const {renderPerformanceCenter}=require("../performance-center");
const range={from:"2026-09-01",to:"2026-09-28"},now=new Date("2026-09-30T15:00:00Z");
const connection={id:1,status:"connected",currency_code:"USD",account_timezone:"UTC",last_synced_at:now.toISOString(),last_from:range.from,last_to:range.to};
const row={connection_id:1,currency_code:"USD",channel:"SEARCH",impressions:5000,clicks:100,cost_micros:1000000000,conversions:10};
const rows=[{...row,campaign_id:"a",campaign_name:"Source",conversion_value:1000},{...row,campaign_id:"b",campaign_name:"Winner <script>",conversion_value:4000}];
const recommend=(rs=rows,c=connection,r=range)=>campaignRecommendations([{id:"google_ads",name:"Google Ads",evidence:{connections:[c],rows:rs},href:()=>"/evidence"}],r,now,{gross_margin_pct:40}).find(x=>x.projection);
test("projection reduces conversion rate and increases CPC without inflating the budget",()=>{
 const p=conservativeProjection({spend:1000,clicks:100,conversions:10,revenue:4000,budget:100,marginPct:40});
 assert.ok(Math.abs(p.projectedRevenue-243.47826086956522)<1e-8);
 assert.ok(Math.abs(p.roas-2.4347826086956523)<1e-8);
 assert.ok(p.roi<0);assert.equal(p.budget,100);
 for(const marginPct of [null,undefined,"",NaN,101,-1])assert.equal(conservativeProjection({spend:1,clicks:1,conversions:1,revenue:1,budget:1,marginPct}).roi,null);
 assert.equal(conservativeProjection({spend:0,clicks:1,conversions:1,revenue:1,budget:1}),null);
});
test("eligible recommendation is revenue first, scoped and escaped",()=>{
 const rec=recommend();assert.ok(rec);assert.equal(rec.projection.budget,100);assert.equal(rec.confidence,"Low");
 const html=renderProjection(rec.projection);assert.match(html,/projected platform-attributed revenue/);assert.match(html,/Winner &lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.ok(html.indexOf("projected ROAS")<html.indexOf("Estimated profit"));
 assert.match(renderPerformanceCenter({segmentInsights:{paid:[rec]}}),/Conservative revenue projection/);
 assert.match(renderProjection({...rec.projection,roi:null}),/Add your margin/);
});
test("withholds projections for weak, stale, incomplete or incompatible evidence",()=>{
 assert.equal(recommend(rows,{...connection,last_synced_at:"2026-09-29T00:00:00Z"}),undefined);
 assert.equal(recommend(rows,{...connection,last_from:null}),undefined);
 assert.equal(recommend(rows,connection,{...range,to:"2026-09-30"}),undefined);
 assert.equal(recommend(rows.map(r=>({...r,conversions:2}))),undefined);
 assert.equal(recommend([rows[0],{...rows[1],currency_code:"EUR"}]),undefined);
 assert.equal(recommend([rows[0],{...rows[1],channel:"DISPLAY"}]),undefined);
 assert.equal(recommend([rows[0],{...rows[1],connection_id:2}]),undefined);
 assert.equal(recommend([rows[0],{...rows[1],conversion_value:1500}]),undefined);
 assert.equal(recommend(rows.map(r=>({...r,conversion_value:0}))),undefined);
});

test("command center displays the projection with the saved margin",()=>{
 const {renderCommandCenter}=require("../marketing-command-center");
 const fresh={...connection,last_synced_at:new Date().toISOString()};
 const html=renderCommandCenter({title:"Marketing",scope:{kind:"advertiser"},range,campaigns:[],economics:{gross_margin_pct:40},googleEvidence:{connections:[fresh],rows},aiVisible:true});
 assert.match(html,/Conservative revenue projection/);assert.match(html,/243.48 USD projected platform-attributed revenue/);assert.match(html,/Estimated profit and ROI/);
});
