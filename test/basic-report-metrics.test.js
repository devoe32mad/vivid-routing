'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const helper=require('../report-performance-upgrade');
const state={rows:[{qr_id:97,campaign_id:68,location_id:36,status:'active',qr_name:'Gym',location_name:'School'}],csrf:'token',returnTo:'/reports'};
test('Basic masks paid metrics in real report row templates while preserving scans and upgrade controls',()=>{
 let s=fs.readFileSync(require.resolve('../server.js'),'utf8');
 s=require('../install-sponsorship-performance-plans').install(s);
 s=require('../install-website-page-tracking').install(s);
 assert.equal(require('../install-basic-report-metrics').install(s),s);
 for(const [path,table,scan] of [['/reports','reportTable',3],['/reports-qr','reportTable',2],['/reports-location','table',2],['/reports-campaign','table',5]]){
  const start=s.indexOf(`app.get("${path}", requireLogin`),end=s.indexOf('\napp.',start+1),route=s.slice(start,end);
  const a=route.indexOf(table+' += '),b=route.indexOf('`);',a);
  assert.ok(a>0&&b>a,path);
  const context={performanceUpgrade:state,require:n=>n==='./report-performance-upgrade'?helper:{count:()=>777},r:{campaignId:68,campaign_id:68,campaignName:'Test',campaign_name:'Test',scans:123,offerClicks:777,mapClicks:777,wazeClicks:777,intent:777,conversions:777,revenue:777,allocatedCost:777,cac:777,roi:777},qr:{qr_id:97,qr_name:'Gym'},loc:{id:36,name:'School',location:'Naples'},scans:123,offers:777,maps:777,waze:777,intent:777,totalIntent:777,conversions:777,revenue:777,allocatedCost:777,cac:777,roi:777,customerValue:777,websitePages:{},campaignCountResult:{rows:[{campaign_count:1}]},money:n=>'$'+n,pct:n=>n+'%'};
  context[table]='';vm.runInNewContext(route.slice(a,b+3),context);
  const html=context[table],cells=html.match(/<td\b[^>]*>[\s\S]*?<\/td>/g);
  assert.match(cells[scan],/>123</,path);assert.match(html,/\$35\/month/,path);
  assert.doesNotMatch(html,/777/,path);
  assert.ok(cells.slice(scan+1).every(c=>c.includes('>—</td>')),path);
  const paid={...context,performanceUpgrade:{rows:[]},[table]:''};vm.runInNewContext(route.slice(a,b+3),paid);assert.match(paid[table],/777/,path);
 }
 fs.writeFileSync('/tmp/basic-report-metrics-server.js',s);
});
test('website detail data and totals exclude Basic campaigns, including mixed-plan aggregates',()=>{
 const report={filters:{},campaigns:[{id:68},{id:69}],rows:[{campaign_id:68,visits:777},{campaign_id:69,visits:4}],pages:[{campaign_id:68,visits:777},{campaign_id:69,visits:4}],total:781};
 const filtered=helper.filterWebsiteReport(report,state);
 assert.deepEqual(filtered.rows,[{campaign_id:69,visits:4}]);assert.equal(filtered.total,4);assert.equal(filtered.basicMetricsHidden,true);
 assert.doesNotMatch(JSON.stringify(filtered),/777/);
 assert.equal(helper.filterWebsiteReport(report,{rows:[]}),report);
 assert.equal(helper.restricted(state,'location_id',36),true);
 assert.equal(helper.restricted(state,'qr_id',98),false);
 assert.match(helper.maskRow({...state,rows:[{...state.rows[0],status:'upgrade_requested'}]},'qr_id',97,0,'<td>12</td><td>777</td>'),/>—</);
});
