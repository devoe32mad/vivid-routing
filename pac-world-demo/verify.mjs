import fs from 'node:fs';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
const {handle}=await import('./pac-world.js');const origin='http://localhost';
const entry=await handle(new Request(origin+'/pac-world-review/'+process.env.PAC_DEMO_TOKEN+'/enterprise'));const cookie=entry.headers.get('set-cookie').split(';')[0];
async function req(path,body){const r=await handle(new Request(origin+'/demo/pac-world'+path,{method:body?'POST':'GET',headers:{cookie,origin,...(body?{'content-type':'application/x-www-form-urlencoded'}:{})},...(body?{body:new URLSearchParams(body)}:{})}));assert.ok(r.status<400,path+' '+r.status+' '+(r.status>=400?await r.text():''));return r;}
for(const [opp,tracking]of [[18,'yes'],[19,'no']]){
 let r=await req('/advertise/pac-world-demo/location/13/opportunity/'+opp+'/submit',{business_name:'Sample Power Co',contact_name:'Sample Contact',email:'sample@example.invalid',phone:'555-0100',campaign_name:'Repeat issue campaign',destination_url:'https://example.com/offer','issue_2026-12':'yes','issue_2027-03':'yes','issue_2027-06':'yes','issue_2027-09':'yes'});
 let path=r.headers.get('location').replace('/demo/pac-world',''),id=path.split('/').at(-1);
 assert((await (await req(path)).text()).includes('Sample Power Co'));
 await req(path+'/approve',{confirm_estimate:'yes',contract_start_date:'2026-12-01',contract_end_date:'2027-09-30'});
 r=await req('/demo-onboarding/'+id,{tracking,campaign_name:'Repeat issue campaign',destination_url:'https://example.com/offer'});const c=r.headers.get('location').replace('/demo/pac-world',''),cid=c.split('/').at(-1);
 const html=await (await req(c)).text();assert(html.includes('Insertion 4'));assert(html.includes('7720')||html.includes('7,720'));
 await req('/demo-benefit/'+cid+'/0',{completed:'yes',evidence:'Sample tearsheet approved',due_date:'2026-12-01'});
 await req(c+'/renew',{start_date:'2027-01-01',end_date:'2027-12-31',total_contract_value:'7720'});
 if(tracking==='yes'){await req('/admin/edit-campaign/'+cid,{campaign_name:'Updated offer',campaign_url:'https://example.com/new-offer'});assert.equal((await req('/r/'+cid)).headers.get('location'),'https://example.com/new-offer');}
 console.log('PASS repeat insertion onboarding, fulfillment, renewal '+tracking);
}
for(const path of ['/org-export/report.pdf','/export/report.pdf','/org-export/renewals.pdf','/org-export/renewals.csv','/export/events.csv','/org-export/report.xlsx','/export/report.xlsx']){
 const r=await req(path),b=Buffer.from(await r.arrayBuffer());assert(b.length>100);
 if(path.endsWith('.pdf')){assert.equal(b.subarray(0,4).toString(),'%PDF');fs.writeFileSync('/tmp/pac-'+path.split('/').at(-1),b);}
 if(path.endsWith('xlsx')){const book=new ExcelJS.Workbook();await book.xlsx.load(b);assert(book.getWorksheet('Sales Reps'));assert(book.getWorksheet('Fulfillment'));console.log('Workbook',book.worksheets.map(x=>[x.name,x.rowCount]));}
 console.log('PASS export',path,b.length);
}
assert.equal((await handle(new Request(origin+'/demo/pac-world/my-setup'))).status,401);
assert.equal((await handle(new Request(origin+'/demo/pac-world/reports?organization_id=40',{headers:{cookie}}))).status,404);
assert.equal((await handle(new Request(origin+'/demo/rubber-world/reports',{headers:{cookie}}))).status,404);
console.log('PASS privacy and cross-demo boundaries');process.exit();
