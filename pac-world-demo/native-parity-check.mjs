import assert from 'node:assert/strict';
const {handle}=await import('./pac-world.js');const host='http://localhost';
const entry=await handle(new Request(host+'/pac-world-review/'+process.env.PAC_DEMO_TOKEN+'/enterprise'));const cookie=entry.headers.get('set-cookie').split(';')[0];
async function req(path,body){const r=await handle(new Request(host+'/demo/pac-world'+path,{method:body?'POST':'GET',headers:{cookie,...(body?{'content-type':'application/x-www-form-urlencoded'}:{})},...(body?{body:new URLSearchParams(body)}:{})}));const html=await r.text();assert(r.status<400,path+' '+r.status+' '+html.slice(0,160));return html;}
const overview=await req('/enterprise');assert(overview.includes('View Full Performance Insights'));assert(!overview.includes('Ask Vivid: What needs attention?'));
const setup=await req('/my-setup');for(const label of ['Launch Checklist','QR Codes','Campaigns','Schedules','Active Campaign Assignments'])assert(setup.includes(label),label);assert(!setup.includes('Setup in one step'));
const marketplace=await req('/advertise/pac-world-demo');assert(marketplace.includes('program_id=1'));assert(marketplace.includes('program_id=2'));assert(!marketplace.includes('Current and proposed placements'));
const detail=await req('/advertise/pac-world-demo/location/13/opportunity/18');assert(detail.includes('class="form-layout"'));assert(detail.includes('name="issue_2027-03"'));
const review=await req('/advertise/pac-world-demo/location/13/opportunity/18/review',{business_name:'Sample Power',contact_name:'Sample Contact',email:'sample@example.invalid',phone:'555-0100',approval_acknowledgement:'yes','issue_2026-12':'yes','issue_2027-03':'yes'});assert(review.includes('name="issue_2027-03"'));assert(review.includes('3980'));
const reps=await req('/org-sales-reps');assert(reps.includes('Sales rep summary'));assert(reps.includes('Revenue Pipeline'));assert(reps.includes('stage=renewals'));
await req('/org-responsibility/save',{id:'18',rep_id:'2',next_action:'Sample follow-up',follow_up_status:'Waiting'});assert((await req('/org-responsibility?kind=opportunity&id=18')).includes('Sample follow-up'));
console.log('PASS native marketplace hierarchy, native advertiser sections, native issue request/review with optional destination, native rep report and assignment');process.exit();
