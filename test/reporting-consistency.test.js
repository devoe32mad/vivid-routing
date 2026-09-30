'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const {isAiTraffic,isUnpaidTraffic}=require('../traffic-classification');
const {buildPlatforms}=require('../marketing-platform-dashboard');
const {aiInsights,organicInsights}=require('../performance-center-evidence');
const {performanceCampaignScope}=require('../performance-campaign-scope');
const range={from:'2026-09-01',to:'2026-09-30'};
test('both pages use the same AI and unpaid totals, including lookalike and paid exclusions',()=>{
 const rows=[['chatgpt.com','ai-assistant',43],['hexpol.example.chatgpt.site','referral',6],['chatgpt','paid',1],['facebook','organic_social',14],['google','organic',19],['example.com','referral',28]].map(([source,medium,sessions])=>({source,medium,sessions,connection_id:1}));
 const evidence={connections:[{id:1,property_name:'Website'}],rows};
 const platforms=buildPlatforms({scope:{kind:'advertiser'},range,campaigns:[],analyticsEvidence:evidence});
 assert.equal(platforms.find(p=>p.id==='ai_traffic').metrics.find(m=>m[0]==='AI-referred visits')[1],'43');
 assert.equal(platforms.find(p=>p.id==='organic').metrics.find(m=>m[0]==='Website visits')[1],'67');
 assert.match(aiInsights(evidence,range)[0].title,/43/);assert.match(organicInsights(evidence,null,range)[0].title,/67/);
 for(const source of ['notperplexity.ai','claude.ai.evil.example','chatgpt.site','x.chatgpt.site'])assert.equal(isAiTraffic({source,medium:'referral'}),false);
 assert.equal(isAiTraffic({source:'chatgpt.com',medium:'paid-social'}),false);
 assert.equal(isUnpaidTraffic({source:'chatgpt.com',medium:'referral'}),false);
});
test('PostgreSQL campaign scope retains placement ownership, excludes tests and foreign campaigns, and avoids duplicate events',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try{
 await db.exec(`CREATE TABLE campaigns(id int primary key,name text,user_id int,is_test boolean,is_archived boolean,organization_id int,advertiser_id int);
 CREATE TABLE events(id int,campaign_id int,type text,value numeric,created_at timestamp);
 CREATE TABLE qr_campaigns(campaign_id int,qr_id int);CREATE TABLE qr_codes(id int,space_id int);CREATE TABLE spaces(id int,user_id int);
 INSERT INTO campaigns VALUES(1,'Direct',7,false,false,1,1),(2,'Marketplace',8,false,false,2,2),(3,'Test',7,true,false,1,1),(4,'Foreign',8,false,false,2,2),(5,'Archived',7,false,true,1,1);
 INSERT INTO spaces VALUES(1,7),(2,8);INSERT INTO qr_codes VALUES(1,1),(2,1),(3,2);INSERT INTO qr_campaigns VALUES(2,1),(2,2),(4,3);
 INSERT INTO events VALUES(1,1,'scan',0,'2026-09-01'),(2,2,'conversion',50,'2026-09-30 23:59:59'),(3,3,'conversion',900,'2026-09-10'),(4,4,'conversion',800,'2026-09-10'),(5,5,'conversion',25,'2026-09-10'),(6,2,'conversion',100,'2026-10-01');`);
 const source=fs.readFileSync(require.resolve('../marketing-command-center-routes'),'utf8');
 const code=source.slice(source.indexOf('  async function loadCampaigns('),source.indexOf('  async function squareStatus('));
 const load=vm.runInNewContext('('+code.trim()+')',{performanceCampaignScope,q:(sql,params)=>db.query(sql,params)});
 const rows=await load({kind:'advertiser',userId:7},range);
 assert.deepEqual(rows.map(r=>r.id).sort(),[1,2,5]);assert.equal(rows.reduce((sum,r)=>sum+Number(r.conversion_value),0),75);assert.equal(rows.find(r=>r.id===2).conversions,1);
 const pc=await db.query(`SELECT c.id FROM campaigns c WHERE ${performanceCampaignScope()} ORDER BY c.id`,[7]);assert.deepEqual(pc.rows.map(r=>r.id),[1,2,5]);
 const card=buildPlatforms({scope:{kind:'advertiser'},range,campaigns:rows}).find(p=>p.id==='vivid');assert.equal(card.campaignCount,2);assert.equal(card.rows.length,3);
 const enterprise=await load({kind:'enterprise',orgId:1,advertiserId:1},range);assert.deepEqual(enterprise.map(r=>r.id).sort(),[1,5]);
 }finally{await db.close();}
});
test('all production installers compose and performance queries share the scoped campaign set',()=>{
 const os=require('os'),path=require('path'),{execFileSync}=require('child_process');
 const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'vivid-evidence-install-'));
 try{
  for(const file of fs.readdirSync(root).filter(f=>/\.(js|json)$/.test(f)))fs.copyFileSync(path.join(root,file),path.join(temp,file));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'));
  for(const command of require('../package.json').scripts.start.split(' && ').slice(0,-1))execFileSync(process.execPath,[command.slice(5)],{cwd:temp,stdio:'pipe'});
  const installed=fs.readFileSync(path.join(temp,'server.js'),'utf8');new vm.Script(installed);
  assert.equal(require('../install-performance-evidence-consistency').install(installed),installed);
  assert.match(installed,/eventWhere.push\(performanceCampaignScope\('\$'\+eventParams.length\)\)/);
  assert.match(installed,/\$\{performanceCampaignScope\(\)\}/);
  assert.match(installed,/Number\(location.id\), performanceCampaignIds/);
  assert.match(installed,/e.campaign_id = ANY\(\$2::int\[\]\)/);
  assert.match(installed,/placementEventWhere.push\(`e.campaign_id = ANY/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
