"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {canViewPerformanceCenter,canPreviewAi,aiPreviewMiddleware}=require('../ai-preview-access');
const actors={jon:{id:28,email:'jon@speaktopublic.com',role:'customer'},melissa:{id:9,email:'melissa.cohill@hexpol.com',role:'customer'},test:{id:17,email:'testtest@test.com'},platform:{id:1,role:'super_admin'},other:{id:33,email:'other@example.com',role:'admin'}};
test('only authenticated named viewers, testtest and platform admins can view; no new AI action access',()=>{
 for(const name of ['jon','melissa','test','platform'])assert.equal(canViewPerformanceCenter({user:actors[name]}),true);
 for(const actor of [undefined,actors.other,{email:actors.jon.email},{id:1,name:'Jon',email:'someone@example.com'}])assert.equal(canViewPerformanceCenter({user:actor}),false);
 for(const name of ['jon','melissa'])assert.equal(canPreviewAi({user:actors[name]}),false);
 assert.equal(canViewPerformanceCenter({user:actors.platform,orgUser:actors.other}),false);
 assert.equal(canViewPerformanceCenter({user:{...actors.jon,email:' JON@SPEAKTOPUBLIC.COM '}}),true);
});
test('HTTP access blocks direct paths and spoofing, hides links, and leaves ordinary reporting available',async()=>{
 const app=require('express')();let handled=0;
 app.use((req,res,next)=>{req.session={user:actors[req.get('x-actor')]};next();});app.use(aiPreviewMiddleware);
 for(const path of ['/admin/ai-insights','/admin/ai-campaign-operator','/admin/ai-approval-center','/reports'])app.all(path,(req,res)=>{handled++;res.send('<a href="/admin/ai-insights?from=2026-09-01">Performance</a><a href="/admin/ai-campaign-operator">Prepare</a><a href="/reports">Reports</a>');});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}`;
 try {
 for(const name of Object.keys(actors).concat('anonymous')){
  const headers={'x-actor':name};const permitted=!['other','anonymous'].includes(name);
  for(const path of ['/admin/ai-insights','/ADMIN/AI-INSIGHTS/'])assert.equal((await fetch(url+path+'?email=jon@speaktopublic.com&role=super_admin',{headers})).status,permitted?200:404);
  const html=await (await fetch(url+'/reports',{headers})).text();assert.equal(html.includes('>Performance</a>'),permitted);assert.match(html,/>Reports</);
 }
 for(const name of ['jon','melissa']){
  const headers={'x-actor':name};const html=await(await fetch(url+'/admin/ai-insights',{headers})).text();assert.doesNotMatch(html,/>Prepare</);
  const before=handled;
  for(const path of ['/admin/ai-insights','/admin/ai-campaign-operator','/admin/ai-approval-center'])assert.equal((await fetch(url+path,{method:'POST',headers})).status,404);
  assert.equal(handled,before);
 }
 }finally{await new Promise(r=>server.close(r));}
});
