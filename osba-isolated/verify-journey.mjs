import assert from 'node:assert/strict';
import {createJourney} from './journey.js';
import {writeFileSync} from 'node:fs';
const j=createJourney({opportunities:[{id:4,title:'Luncheon',price:7500,pricing_unit:'per event',status:'Available',description:'Table for eight.'}],banner:()=>'',footer:()=>''});
const origin='https://demo.test';let cookie='';
async function call(path,body){return j.handle(new Request(origin+'/demo/osba'+path,{method:body?'POST':'GET',headers:{origin:"null",cookie,"sec-fetch-site":"same-origin"},...(body?{body:new URLSearchParams(body)}:{})}),path);}
let r=await call('/sample-journey/start',{opportunity_id:4,business_name:'Carryover Company',contact_name:'Sample Buyer',email:'demo@example.com',destination_url:'https://example.com',campaign_name:'Sample luncheon'});assert.equal(r.status,303);cookie=r.headers['Set-Cookie'].split(';')[0];
for(let stage=0;stage<7;stage++){
 r=await call('/sample-journey');assert(r.html.includes(`name="stage" value="${stage}"`));
 const token=r.html.match(/name="csrf" value="([^"]+)"/)[1];
 if(stage===0){const saved=cookie;cookie='';assert(!(await call('/sample-journey')).html.includes('Carryover Company'));cookie=saved;}
 if(stage===5){for(const file of ['agreement','report']){const pdf=await call(`/sample-journey/${file}.pdf`);assert(pdf.pdf.subarray(0,4).toString()==='%PDF');writeFileSync('/tmp/osba-'+file+'.pdf',pdf.pdf);}}
 const bad=await call('/sample-journey',{stage,csrf:'bad'});assert.equal(bad.status,409);
 r=await call('/sample-journey',{stage,csrf:token,asset:'art.pdf',schedule:'Future cycle',qr:'yes',ack:'yes',check0:'yes',check1:'yes',check2:'yes',renewal_schedule:'Next cycle'});assert.equal(r.status,303);
}
r=await call('/sample-journey');assert(r.html.includes('Renewal 1'));assert(r.html.includes('Carryover Company'));
console.log('PASS: seven steps, carryover, renewal, session separation, CSRF rejection and both PDFs.');
