import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vividNative,handle} from './osba.js';
const paths=['/org-organization/osba-demo','/org-locations','/org-marketplace','/org-advertisers','/org-advertising-requests','/org-contracts','/org-renewals','/org-revenue-pipeline','/org-performance','/org-export','/my-setup','/reports','/reports-qr','/reports-location','/reports-campaign','/admin/reports'];
try{
 for(const path of paths){
  const result=await vividNative.dispatch(path,{from:'2026-09-15',to:'2026-10-14'});
  assert.equal(result?.status,200,path);assert.match(result.html,/position\s*:\s*sticky/,path+' navigation');
  if(path==='/org-organization/osba-demo')assert.doesNotMatch(result.html,/data-osba-navigation/, 'preserve existing overview navigation');
 }
 for(const path of ['/org-export/report.pdf','/org-export/report.xlsx','/export/report.pdf','/export/report.xlsx']){
  const result=await vividNative.dispatch(path,{});assert.equal(result?.status,200,path);assert.ok(result.bytes.length>5000,path);
  assert.equal(result.bytes.subarray(0,path.endsWith('.pdf')?4:2).toString(),path.endsWith('.pdf')?'%PDF':'PK');
 }
 const origin='https://osba-private-demo-production.up.railway.app';
 const entry=readFileSync(process.argv[2],'utf8').trim();
 const response=await handle(new Request(origin+entry));assert.equal(response.status,302);
 const cookie=response.headers.get('set-cookie').split(';')[0];
 assert.equal((await handle(new Request(origin+'/demo/osba/org-locations'))).status,401);
 const html=await (await handle(new Request(origin+'/demo/osba/org-locations?from=2026-09-15&to=2026-10-14',{headers:{cookie}}))).text();
 assert.match(html,/href="\/demo\/osba\/org-export\?/);assert.match(html,/from=2026-09-15/);assert.doesNotMatch(html,/href="\/org-/);
 assert.equal((await handle(new Request(origin+'/demo/osba/org-locations?organization_id=39',{headers:{cookie}}))).status,404);
 const page=await (await handle(new Request(origin+'/demo/osba/advertise/osba-demo',{headers:{cookie}}))).text();assert.match(page,/Publications/);assert.match(page,/Digital advertising/);assert.match(page,/Events/);assert.match(page,/Webinars/);
 console.log('PASS: 16 pages retain navigation, all 4 PDF/Excel exports generate, date filters and scoped URLs survive, foreign organizations and missing invitations are blocked.');
 process.exit(0);
}catch(error){console.error(error);process.exit(1);}
