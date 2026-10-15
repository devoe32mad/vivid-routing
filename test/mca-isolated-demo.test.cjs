const {PGlite}=require('@electric-sql/pglite');
const {EventEmitter}=require('events');
const db=new PGlite();
class Pool extends EventEmitter{
 async query(sql,p=[]){if(typeof sql==='object'){p=sql.values||[];sql=sql.text}const result=p.length?await db.query(sql,p):(await db.exec(sql)).at(-1)||{rows:[]};return {...result,rowCount:result.affectedRows??result.rows?.length??0}}
 async connect(){return {query:this.query.bind(this),release(){}}} async end(){}
}
const pg=require('pg');pg.Pool=Pool;
process.env.MCA_DEMO_ISOLATED='1';process.env.MCA_LOCAL_QA='1';process.env.MCA_REVIEW_TOKEN='local-qa-token';process.env.PORT='3099';process.env.BASE_URL='http://localhost:3099';
require('../mca-demo-entry').start().catch(e=>{console.error(e);process.exit(1)});
const express=require('express');const originalListen=express.application.listen;
express.application.listen=function(...args){const srv=originalListen.apply(this,args);srv.on('listening',async()=>{
 try{
  const entry=await fetch('http://localhost:3099/review/local-qa-token',{redirect:'manual'});const cookie=entry.headers.get('set-cookie')?.split(';')[0];console.log('AUTH',entry.status,!!cookie);
  const paths=['/org-organization/1?organization_id=1','/org-marketplace?organization_id=1','/advertise/mca-isolated-demo','/org-sales-reps?organization_id=1','/org-contracts?organization_id=1','/org-renewals?organization_id=1','/org-advertising-requests?organization_id=1','/org-export?organization_id=1','/my-setup','/reports','/org-export/report.pdf?organization_id=1','/org-export/report.xlsx?organization_id=1','/export/report.pdf','/export/report.xlsx','/org-sponsor-journey?contract_id=1','/org-contract/1?organization_id=1','/org-advertising-request/1?organization_id=1','/advertise/mca-isolated-demo?program_id=1','/admin/edit-campaign/1','/org-organization/39?organization_id=39'];
  for(const p of paths){const r=await fetch('http://localhost:3099'+p,{headers:{cookie},redirect:'manual'});const b=Buffer.from(await r.arrayBuffer());console.log('QA',r.status,r.headers.get('content-type'),p,b.length,b.length<500?b.toString().slice(0,250):'');require('node:assert/strict').equal(r.status,p.includes('/org-organization/39')?403:200,p);if(p.includes('program_id=1'))require('node:assert/strict').ok(!b.toString().includes('Program details are being prepared.'));if(p.includes('.pdf'))require('node:assert/strict').equal(b.subarray(0,5).toString(),'%PDF-');}
  let workflow=await (await fetch('http://localhost:3099/org-sponsor-journey?contract_id=1',{headers:{cookie}})).text();
  const csrf=workflow.match(/name="csrf" value="([^"]+)"/)[1];
  for(let stage=0;stage<7;stage++){const data=new FormData();data.set('contract_id','1');data.set('stage',String(stage));data.set('csrf',csrf);if(stage===4)data.set('artwork',new Blob(['%PDF-1.4 sample artwork'],{type:'application/pdf'}),'sample-artwork.pdf');const r=await fetch('http://localhost:3099/org-sponsor-journey/advance',{method:'POST',headers:{cookie},body:data,redirect:'manual'});require('node:assert/strict').equal(r.status,302);console.log('JOURNEY',stage,r.status);}
  console.log('FINAL STAGE',(await db.query('SELECT stage,artwork_name FROM mca_demo_workflows')).rows);
 }catch(e){console.error('QA ERROR',e);process.exitCode=1}finally{srv.close();process.exit(process.exitCode||0)}
 });return srv;};
