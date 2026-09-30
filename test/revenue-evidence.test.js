'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {returnEstimate,loadRevenueEvidence}=require('../revenue-evidence');
const {renderPerformanceCenter}=require('../performance-center');
const {googleMetrics}=require('../marketing-platform-dashboard');
test('ROAS and profit ROI use distinct formulas consistently, including zero margin',()=>{
 assert.deepEqual(returnEstimate({value:1600,spend:500,marginPct:40}),{roas:3.2,roi:28});
 assert.equal(returnEstimate({value:1600,spend:500,marginPct:0}).roi,-100);
 for(const marginPct of [null,undefined,'',-1,101])assert.equal(returnEstimate({value:1600,spend:500,marginPct}).roi,null);
 assert.deepEqual(returnEstimate({value:1600,spend:0,marginPct:40}),{roas:null,roi:null});
 const metrics=googleMetrics([{currency_code:'USD',cost_micros:500e6,conversion_value:1600}],40);
 assert.equal(metrics.find(m=>m[0]==='Estimated ROI')[1],'28% USD');
});
test('recorded value stays visible but assigned or unverified value never becomes profit ROI',()=>{
 const data={advertisingInvestment:500,conversionRevenue:1600,revenueEvidence:{verifiedSales:1000,verifiedCount:2,otherValue:600,unverifiedCount:1},segmentInsights:{economics:{gross_margin_pct:40}}};
 const html=renderPerformanceCenter(data);assert.match(html,/Recorded conversion value/);assert.match(html,/3.20×/);assert.match(html,/\$1,000.00 verified matched Square sales/);assert.match(html,/\$600.00 other conversion value/);assert.doesNotMatch(html,/Estimated profit ROI:/);
 assert.match(renderPerformanceCenter({...data,revenueEvidence:{verifiedSales:1600,verifiedCount:2,otherValue:0,unverifiedCount:0}}),/Estimated profit ROI: 28.0%/);
 assert.doesNotMatch(renderPerformanceCenter({...data,revenueEvidence:null}),/Estimated profit ROI:/);
});
test('PostgreSQL separates Square net sales from other values without counting test, foreign or out-of-range events',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 try{
 await db.exec(`CREATE TABLE campaigns(id int,user_id int,is_test boolean);CREATE TABLE events(id int,campaign_id int,type text,value numeric,created_at timestamp,square_payment_key text);CREATE TABLE qr_campaigns(campaign_id int,qr_id int);CREATE TABLE qr_codes(id int,space_id int);CREATE TABLE spaces(id int,user_id int);
 INSERT INTO campaigns VALUES(1,7,false),(2,7,true),(3,8,false);
 INSERT INTO events VALUES(1,1,'conversion',100,'2026-09-01','verified-key'),(2,1,'conversion',35,'2026-09-30 23:59:59',null),(3,2,'conversion',900,'2026-09-01',null),(4,3,'conversion',800,'2026-09-01',null),(5,1,'conversion',700,'2026-10-01',null),(6,1,'scan',600,'2026-09-01',null);`);
 const result=await loadRevenueEvidence({q:(sql,params)=>db.query(sql,params),userId:7,range:{from:'2026-09-01',to:'2026-09-30'}});
 assert.deepEqual(result,{verifiedSales:100,verifiedCount:1,unverifiedCount:1,otherValue:35});
 await db.exec('ALTER TABLE events DROP COLUMN square_payment_key');
 const legacy=await loadRevenueEvidence({q:(sql,params)=>db.query(sql,params),userId:7,range:{from:'2026-09-01',to:'2026-09-30'}});
 assert.equal(legacy.verifiedSales,0);assert.equal(legacy.otherValue,135);
 }finally{await db.close();}
});
