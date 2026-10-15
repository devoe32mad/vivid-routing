import {PGlite} from '@electric-sql/pglite';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {Writable} from 'node:stream';
import {marketplaceDetail,packageComparison,polish,fulfillmentPanel} from './presentation.js';
const photos=["https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_2/v1757434786/canterburyfortmyersorg/alnkveboeiwr1cynkdfj/BannerProgram-2.png", "https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_2/v1757434762/canterburyfortmyersorg/j4xb6aopyspmllvfordz/BannerProgram-1.png", "https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_2/v1757434800/canterburyfortmyersorg/xvm2k5od4gr7wrtf4qui/BannerProgram-3.png"];
const eventPhotos={44:'https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_3/v1790688434/gjioy3po7wu9wjkefqgv/11-8-2025Carnival-110.jpg',45:'https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_2/v1777909804/canterburyfortmyersorg/stjbwrrqbvxyl7gttcsc/5-1-2026CougarClassic2026-100.jpg',46:'https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_3/v1791812497/canterburyfortmyersorg/h8xswvvljnhyhbjypyxm/SavetheDateExtravaganza2027_VF.png'};
const photo=id=>eventPhotos[id]||photos[id===11?1:id===12?2:0];
const nodeRequire=createRequire(import.meta.url);
const source=JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(new URL('./native-source.b64',import.meta.url),'utf8'),'base64')).toString());
export function createNativeRuntime({baseRows,opportunities,groups,reporting,banner}){
 const ORG=900001,OWNER=900002;
 const organization={id:ORG,name:'Canterbury School — Vivid Demo',slug:'canterbury-demo',is_active:true,website:'https://www.canterburyfortmyers.org/',public_heading:'Support Canterbury School',public_description:'Explore campus banners, Carnival activities, the Cougar Classic and Extravaganza. Event inquiries carry no promised price or availability. QR tracking is optional; inventory, contracts and renewals work without it.',public_logo_url:''};
 const fixtures=query=>{
  const data=reporting(query),active=data.rows;
  const locations=[...new Set(opportunities.map(o=>o.space_id))].map(id=>{const o=opportunities.find(o=>o.space_id===id),r=baseRows.find(r=>r.opportunity_id===o.id),d=active.filter(r=>opportunities.find(o=>o.id===r.opportunity_id).space_id===id);return {id,name:o.edition,location:o.channel,market:o.channel,organization_id:ORG,user_id:baseRows.some(r=>opportunities.find(x=>x.id===r.opportunity_id).space_id===id)?OWNER:900003,organization_name:organization.name,description:o.description,live_date:'2026-09-15',created_at:'2026-09-15',end_date:'2026-12-31',is_archived:false,qr_count:d.length,qr_placements:d.length,campaign_count:d.length,active_campaigns:d.length,scans:d.reduce((s,r)=>s+r.scans,0),conversions:d.reduce((s,r)=>s+r.conversions,0),revenue:d.reduce((s,r)=>s+r.revenue,0),conversion_value:d.reduce((s,r)=>s+r.revenue,0),placement_value:d.reduce((s,r)=>s+r.cost,0)};});
  const records=baseRows.map(r=>{const o=opportunities.find(o=>o.id===r.opportunity_id),l=locations.find(l=>l.id===o.space_id),d=active.find(d=>d.qr_id===r.qr_id)||{scans:0,clicks:0,conversions:0,revenue:0};return {...r,...d,id:r.qr_id,name:r.qr_name,qr_name:r.qr_name,advertiser_name:r.advertiser,business_name:r.advertiser,space_id:o.space_id,location_id:o.space_id,location_name:l.name,space_name:l.name,market:l.location,location:l.location,organization_id:ORG,user_id:OWNER,owner_id:OWNER,customer_id:OWNER,advertiser_id:1,live_date:r.start_date,created_at:r.start_date,annual_cost:r.cost,annual_impressions:0,campaign_count:1,qr_count:1,qr_id:r.qr_id,offer_clicks:d.clicks,map_clicks:0,waze_clicks:0,total_intent:d.clicks,conversion_value:d.revenue,is_active:true,is_archived:false,active_campaigns:1,destination_url:r.destination_url,website_url:r.destination_url,url:r.destination_url,is_imported:false,placement_type:r.kind==='digital'?'digital':'qr',tracking_mode:'performance'};});
  const campaigns=records.map(r=>({...r,id:r.campaign_id,name:r.campaign_name,campaign_url:r.destination_url,advertiser:r.advertiser,landing_url:r.destination_url,offer_url:r.destination_url,is_test:false}));
  const opps=opportunities.map(o=>({...o,organization_id:ORG,annual_price:o.price??0,location_id:o.space_id,location_name:locations.find(l=>l.id===o.space_id).name,space_name:locations.find(l=>l.id===o.space_id).name,program_name:o.channel,advertiser_name:o.status==='Sold'?baseRows[0].advertiser:'',status:o.status.toLowerCase(),is_active:true,created_at:'2026-09-15',updated_at:'2026-10-14',photo_url:'',image_url:'',benefits:o.description}));
  const contracts=records.map(r=>({...r,id:r.qr_id,contract_name:r.qr_name,contract_type:'Advertising',total_contract_value:r.cost,annual_value:r.cost,billing_frequency:'One Time',status:'active',source_type:'advertising_request',advertising_request_id:r.qr_id,opportunity_id:r.opportunity_id,expiration_date:r.end_date,renewal_date:r.renewal_date,renewed_from_contract_id:null,opportunity_name:r.qr_name,contact_name:'Demo Contact',contact_email:'demo@example.com',email:'demo@example.com',days_until_expiration:77,renewal_status:'Not Started',renewal_probability:0,auto_renew:false,benefit_count:3,completed_benefits:2}));
  const requests=[...records.map(r=>({...r,id:r.qr_id,request_id:r.qr_id,opportunity_name:r.qr_name,opportunity_title:r.qr_name,contact_name:'Demo Contact',contact_email:'demo@example.com',email:'demo@example.com',phone:'',business_website:'https://example.com/',status:'Approved',created_vivid_user_id:OWNER,created_location_id:r.space_id,created_qr_id:r.qr_id,created_campaign_id:r.campaign_id,created_contract_id:r.qr_id,contract_start_date:r.start_date,contract_end_date:r.end_date,marketplace_price:r.cost,setup_status:'Completed'})),{id:104,request_id:104,organization_id:ORG,space_id:12,location_id:12,opportunity_id:3,opportunity_name:opportunities[2].title,opportunity_title:opportunities[2].title,business_name:'Demo Local Sponsor',contact_name:'Demo Contact',contact_email:'demo@example.com',email:'demo@example.com',phone:'',status:'Pending',created_at:'2026-10-14',location_name:locations.find(l=>l.id===12).name,program_name:'Campus banners',price:1500,campaign_destination:'https://example.com/',requested_start_date:'2026-11-01',requested_end_date:'2026-11-30',notes:'Sample Middle School banner request.'}];
  const relationships=records.map(r=>({...r,id:r.qr_id,location_id:r.space_id,campaign_id:r.campaign_id,effective_start_date:r.start_date,effective_end_date:r.end_date,started_at:r.start_date,assigned_at:r.start_date,assignment_days:30,allocated_cost:r.cost*30/108,is_active:true}));
  const totals={scans:active.reduce((s,r)=>s+r.scans,0),offer_clicks:active.reduce((s,r)=>s+r.clicks,0),map_clicks:0,waze_clicks:0,conversions:active.reduce((s,r)=>s+r.conversions,0),revenue:active.reduce((s,r)=>s+r.revenue,0),conversion_value:active.reduce((s,r)=>s+r.revenue,0),qr_count:active.length,campaign_count:active.length,advertiser_count:1,active_contracts:contracts.length,total_contract_value:contracts.reduce((s,r)=>s+r.cost,0),allocated_cost:active.reduce((s,r)=>s+r.cost*30/108,0),location_count:locations.length,total_locations:locations.length,total_scans:active.reduce((s,r)=>s+r.scans,0)};
  return {data,locations,records,campaigns,opps,contracts,requests,relationships,totals};
 };

 const db=new PGlite();
 const ready=(async()=>{
  const statements=JSON.parse(fs.readFileSync(new URL('./native-schema.json',import.meta.url),'utf8'));
  let pending=statements;
  for(let attempt=0;attempt<8&&pending.length;attempt++){
   const next=[];for(const sql of pending){try{await db.exec(sql);}catch(e){next.push(sql);}}
   if(next.length===pending.length){console.log('Unneeded demo schema statements skipped:',next.length);break;}pending=next;
  }
  await db.exec('ALTER TABLE organization_advertising_requests ALTER COLUMN price DROP NOT NULL');
  await db.exec('ALTER TABLE organization_opportunities ADD COLUMN IF NOT EXISTS available_from date; ALTER TABLE organization_opportunities ADD COLUMN IF NOT EXISTS available_until date;');
  await db.exec('ALTER TABLE organizations ADD COLUMN IF NOT EXISTS public_heading text; ALTER TABLE organizations ADD COLUMN IF NOT EXISTS public_description text; ALTER TABLE organizations ADD COLUMN IF NOT EXISTS public_logo_url text;');
  const fixture=fixtures({});
  const tableData={organizations:[{...organization,slug:'canterbury-demo'}],users:[{id:OWNER,name:'Demo Contact',email:'demo@example.com',password:'demo-disabled',role:'customer',advertiser_customer_id:OWNER},{id:900003,name:'Canterbury School Demo Publisher',email:'publisher-demo@example.com',password:'demo-disabled',role:'customer'}],organization_users:[{id:OWNER,user_id:OWNER,organization_id:ORG,role:'organization_admin',is_active:true}],organization_programs:groups.map(g=>({...g,organization_id:ORG,is_active:g.id!==3,public_image_url:photo(g.id>3?40+g.id:g.id===1?10:11)})),spaces:fixture.locations,qr_codes:fixture.records.map(r=>({...r,total_cost:r.cost})),campaigns:fixture.campaigns,advertisers:[{id:1,organization_id:ORG,name:baseRows[0].advertiser,email:'demo@example.com',is_active:true}],contracts:fixture.contracts,qr_campaigns:fixture.relationships,campaign_schedules:fixture.relationships.map(r=>({...r,id:r.campaign_id,days_of_week:'0,1,2,3,4,5,6',start_time:'00:00',end_time:'23:59',priority:1})),organization_opportunities:fixture.opps.map(o=>({...o,is_active:o.id!==6,status:o.status==='sold'?'Sold':o.status==='pending'?'Pending':'Available',pricing_unit:o.pricing_unit.replace(/^per /,''),suggested_term_length:1,suggested_term_unit:o.inquiry?'Event':'School Year',category:o.channel,photo_url:photo(o.space_id)})),organization_advertising_requests:fixture.requests.map(r=>({...r,destination_url:r.destination_url||'https://example.com/',price:r.cost||r.price||0,approved_at:r.status==='Approved'?'2026-09-15T12:00:00Z':null,submitted_at:'2026-09-15T12:00:00Z'})),campaign_destinations:fixture.records.map(r=>({id:r.campaign_id,campaign_id:r.campaign_id,name:r.destination_name,destination_type:'offer',destination_url:r.destination_url,conversion_url:'https://example.com/thank-you',estimated_value:1200,display_order:1,is_active:true}))};
  for(const [table,rows]of Object.entries(tableData)){
   let columns=(await db.query('SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1',[table])).rows;
   if(!columns.length){await db.exec('CREATE TABLE '+table+' (id integer PRIMARY KEY)');columns=[{column_name:'id',data_type:'integer'}];}
   const known=new Set(columns.map(c=>c.column_name));
   // Populate only native schema columns; add a few fixture identity fields used by later migrations.
   for(const key of ['slug','advertiser_customer_id','is_test'])if(rows.some(r=>r[key]!==undefined)&&!known.has(key)){await db.exec('ALTER TABLE '+table+' ADD COLUMN '+key+' '+(key==='is_test'?'boolean':key==='slug'?'text':'integer'));known.add(key);}
   for(const row of rows){const entries=Object.entries(row).filter(([k,v])=>known.has(k)&&v!==undefined);const keys=entries.map(([k])=>k);try{await db.query('INSERT INTO '+table+' ('+keys.map(k=>'"'+k+'"').join(',')+') VALUES ('+keys.map((k,i)=>'$'+(i+1)).join(',')+')',entries.map(([k,v])=>v));}catch(e){throw Error('Fixture '+table+': '+e.message);}}
  }
  // Deterministic sample events; no production telemetry or database connection exists.
  let id=1;for(let day=0;day<30;day++){for(const r of baseRows){for(const [type,key]of [['scan','scans'],['offer','clicks'],['conversion','conversions']]){const n=Math.floor(r[key]*(day+1)/30)-Math.floor(r[key]*day/30);for(let j=0;j<n;j++)await db.query('INSERT INTO events (id,qr_id,campaign_id,type,value,created_at) VALUES ($1,$2,$3,$4,$5,$6)',[id++,r.qr_id,r.campaign_id,type,type==='conversion'?r.revenue/r.conversions:0,new Date(Date.parse('2026-09-15T12:00:00Z')+day*86400000).toISOString()]);}}}
 })();
 async function insert(table,row){
 const known=new Set((await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",[table])).rows.map(r=>r.column_name));
 const entries=Object.entries(row).filter(([k,v])=>known.has(k)&&v!==undefined);
 await db.query('INSERT INTO '+table+' ('+entries.map(([k])=>'"'+k+'"').join(',')+') VALUES ('+entries.map((_,i)=>'$'+(i+1)).join(',')+')',entries.map(([k,v])=>v));
}
let nextId=1000;
const reps=[{id:1,name:'Alex Morgan (demo)',role:'Campus sponsorships'},{id:2,name:'Jordan Taylor (demo)',role:'Signature events'}];
const assignments=new Map(opportunities.map(o=>[o.id,o.program_id>3?2:1]));
const repFor=o=>reps.find(r=>r.id===assignments.get(o.id));
const onboarding=new Map();
const benefits=new Map([[101,[{name:'Artwork approved',done:true},{name:'Banner installed',done:true}]],[102,[{name:'Artwork approved',done:true},{name:'Banner installed',done:true}]],[103,[{name:'Artwork approved',done:true},{name:'Banner installed',done:true},{name:'Magazine and annual report recognition',done:false},{name:'Campus TV logo placement',done:false}]]]);
// Three sample slots per physical location. Packages reserve the same capacity as individual banners.
const campusNames={10:'Upper School driveway',11:'Murphy Sports Center',12:'Middle School driveway / tennis area'};
const reservations=new Map([[1,[10]],[2,[11]],[3,[12]],[4,[10,12]]]);
const requestDetails=new Map();
const contractDetails=new Map([[101,{opportunityId:1,locations:[10]}],[102,{opportunityId:2,locations:[11]}],[103,{opportunityId:4,locations:[10,12]}]]);
const remaining=location=>3-[...reservations.values()].filter(ids=>ids.includes(location)).length;
function selectedLocations(o,body){
 if(o.program_id===1)return [o.space_id];
 if(o.price===5000)return [10,11,12];
 if(o.price===2500){const ids=String(body.campus_locations||'10,11').split(',').map(Number);return ids.length===2&&new Set(ids).size===2&&ids.every(id=>campusNames[id])?ids:[];}
 return [];
}

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const error=(message,status=400)=>({status,html:message,headers:{}});
async function mutate(path,body){
 await ready;let m;
 if(path==='/org-sales-reps/assign'){const id=Number(body.opportunity_id),rep=Number(body.rep_id);if(!opportunities.some(o=>o.id===id)||!reps.some(r=>r.id===rep))return error('Choose a valid opportunity and sales rep.');assignments.set(id,rep);return {status:302,location:'/org-sales-reps?rep_id='+rep};}
 if(m=path.match(/^\/advertise\/canterbury-demo\/location\/(\d+)\/opportunity\/(\d+)\/submit$/)){
  const o=opportunities.find(o=>o.id===+m[2]&&o.space_id===+m[1]);if(!o||o.id===6)return error('Select a banner package. Audio recognition is a Gold benefit.');
  const fields=['business_name','contact_name','email','phone','website','business_category','campaign_name','destination_url','campaign_notes'];
  const r=Object.fromEntries(fields.map(k=>[k,String(body[k]||'').trim().slice(0,1000)]));
  if(!r.business_name||!r.contact_name||!r.email||!r.phone)return error('Complete the sponsor name and contact details.');
  if(r.destination_url&&!/^https?:\/\//.test(r.destination_url))return error('Use an http or https destination URL, or leave it blank.');
  const details={opportunityId:o.id,locations:selectedLocations(o,body),sponsorType:body.sponsor_type==='family'?'Family':'Business',recognition:String(body.recognition_name||r.business_name).trim().slice(0,180),sport:String(body.sport||'').slice(0,40)};
  if(o.price===5000&&!['Volleyball','Basketball','Football','Soccer','Lacrosse'].includes(details.sport))return error('Choose the sport for Gold audio recognition.');
  if(!o.inquiry){if(o.status!=='Available')return error('This sample opportunity is already reserved. Choose another available opportunity.',409);if(!details.locations.length||details.locations.some(id=>remaining(id)<1))return error('There is not enough sample capacity at the selected locations. Choose another package or location.',409);reservations.set(o.id,details.locations);o.status='Pending';}
  r.campaign_notes=[r.campaign_notes,'Sponsor type: '+details.sponsorType,'Recognition: '+details.recognition,details.locations.length?'Reserved locations: '+details.locations.map(id=>campusNames[id]).join('; '):'',details.sport?'Audio sport: '+details.sport:''].filter(Boolean).join('\n');
  const id=nextId++;requestDetails.set(id,details);await insert('organization_advertising_requests',{...r,id,organization_id:ORG,location_id:o.space_id,opportunity_id:o.id,opportunity_name:o.title,price:o.price,pricing_unit:o.pricing_unit,status:'Pending'});
  if(!o.inquiry)await db.query("UPDATE organization_opportunities SET status='Pending' WHERE id=$1",[o.id]);
  return {status:302,location:'/org-advertising-request/'+id};
 }
 if(m=path.match(/^\/org-advertising-request\/(\d+)\/approve$/)){
  const r=(await db.query('SELECT * FROM organization_advertising_requests WHERE id=$1',[+m[1]])).rows[0];if(!r)return error('Request not found.',404);
  if(opportunities.find(o=>o.id===r.opportunity_id)?.inquiry)return error('Inquiry saved. Canterbury must confirm this event package and price before approval or a contract can be created. Return to Requests to review the inquiry.',409);
  if(r.status==='Approved')return {status:302,location:'/demo-onboarding/'+r.id};
  const start=body.contract_start_date||'2026-10-15',end=body.contract_end_date||'2027-05-31';if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>=end)return error('Enter a valid contract date range.');
  onboarding.set(r.id,{...r,start,end,details:requestDetails.get(r.id)||{locations:reservations.get(r.opportunity_id)||[]}});await db.query("UPDATE organization_advertising_requests SET status='Approved',approved_at=CURRENT_TIMESTAMP,setup_status='Not Started' WHERE id=$1",[r.id]);
  return {status:302,location:'/demo-onboarding/'+r.id};
 }
 if(m=path.match(/^\/demo-onboarding\/(\d+)$/)){
  const r=onboarding.get(+m[1]);if(!r)return error('Approve this sample request first.');if(r.complete)return {status:302,location:'/org-contract/'+r.contractId};
  const id=nextId++,o=opportunities.find(o=>o.id===r.opportunity_id),tracked=body.tracking==='yes';
  const campaignName=String(body.campaign_name||r.campaign_name||o.title).slice(0,180),dest=String(body.destination_url||r.destination_url);if(tracked&&!/^https?:\/\//.test(dest))return error('Enter an http or https destination to enable QR tracking.');
  await insert('contracts',{id,customer_id:OWNER,organization_id:ORG,advertiser_id:1,contract_name:o.title+' — '+r.business_name,contract_type:'Sponsorship',start_date:r.start,end_date:r.end,expiration_date:r.end,total_contract_value:o.price,billing_frequency:'One Time',status:'active',location_id:o.space_id,opportunity_id:o.id,advertising_request_id:r.id,source_type:'advertising_request',notes:'DEMONSTRATION ONLY — no legal agreement or payment. '+(tracked?'Optional QR tracking enabled.':'Inventory-only sponsorship; no QR tracking.')});
  if(tracked){
   const template=fixtures({}).records[0];
   await insert('qr_codes',{...template,id,name:o.title,space_id:o.space_id,location_id:o.space_id,total_cost:o.price,annual_cost:o.price,live_date:r.start,end_date:r.end});
   await insert('campaigns',{...fixtures({}).campaigns[0],id,name:campaignName,campaign_url:dest,landing_url:dest,offer_url:dest,destination_url:dest,organization_request_id:r.id});
   await insert('qr_campaigns',{id,qr_id:id,campaign_id:id,assigned_at:r.start,effective_start_date:r.start,effective_end_date:r.end,is_active:true});
   await insert('campaign_destinations',{id,campaign_id:id,name:'Sponsor offer',destination_type:'offer',destination_url:dest,is_active:true,display_order:1});
   await db.query('UPDATE contracts SET qr_id=$1 WHERE id=$1',[id]);
   baseRows.push({qr_id:id,campaign_id:id,opportunity_id:o.id,qr_name:o.title,edition:o.edition,scans:0,clicks:0,conversions:0,revenue:0,cost:o.price,kind:'print',advertiser:r.business_name,advertiser_id:1,status:'Active',campaign_name:campaignName,start_date:r.start,end_date:r.end,contract_end:r.end,renewal_date:r.end,destination_name:'Sponsor offer',destination_url:dest});
  }
  await db.query("UPDATE organization_advertising_requests SET setup_status='Completed',setup_completed_at=CURRENT_TIMESTAMP,created_contract_id=$2,created_vivid_user_id=$3,created_advertiser_id=1 WHERE id=$1",[r.id,id,OWNER]);
  await db.query("UPDATE organization_opportunities SET status='Sold' WHERE id=$1",[o.id]);await db.query('UPDATE spaces SET user_id=$2 WHERE id=$1',[o.space_id,OWNER]);
  benefits.set(id,[{name:'Artwork approved',done:false},{name:'Banner installed',done:false},...(o.price>=2500?[{name:'Magazine and annual report recognition',done:false},{name:'Campus TV logo placement',done:false}]:[]),...(o.price===5000?[{name:'Audio acknowledgement — one sport',done:false},{name:'Approved promotional item distribution',done:false}]:[])]);
  o.status='Sold';contractDetails.set(id,{...r.details,opportunityId:o.id});r.complete=true;r.contractId=id;return {status:302,location:'/org-contract/'+id};
 }
 if(m=path.match(/^\/demo-benefit\/(\d+)\/(\d+)$/)){
  const b=benefits.get(+m[1]);if(!b?.[+m[2]])return error('Benefit not found.',404);b[+m[2]].done=body.completed==='yes';b[+m[2]].note=String(body.evidence||'').slice(0,1200);b[+m[2]].due=String(body.due_date||'').slice(0,10);b[+m[2]].completedAt=b[+m[2]].done?new Date().toISOString().slice(0,10):null;return {status:302,location:'/org-contract/'+m[1]};
 }
 if(m=path.match(/^\/org-contract\/(\d+)\/renew$/)){
  const r=(await db.query('SELECT * FROM contracts WHERE id=$1',[+m[1]])).rows[0];if(!r)return error('Contract not found.',404);
  const start=body.start_date,end=body.end_date,value=Number(body.total_contract_value);if(!start||!end||start>=end||!Number.isFinite(value)||value<0)return error('Enter valid renewal dates and value.');
  const id=nextId++;await insert('contracts',{...r,id,start_date:start,end_date:end,expiration_date:end,total_contract_value:value,status:'draft',renewed_from_contract_id:r.id,notes:'DEMONSTRATION renewal draft. No agreement sent.'});return {status:302,location:'/org-contract/'+id};
 }
 if(m=path.match(/^\/admin\/edit-campaign\/(\d+)$/)){
  const id=+m[1],r=baseRows.find(r=>r.campaign_id===id);if(!r)return error('Campaign not found.',404);
  const dest=String(body.campaign_url||body.landing_url||body.offer_url||body.destination_url||r.destination_url),name=String(body.name||body.campaign_name||r.campaign_name).slice(0,180);if(tracked&&!/^https?:\/\//.test(dest))return error('Enter an http or https destination to enable QR tracking.');
  await db.query('UPDATE campaigns SET name=$2,campaign_url=$3 WHERE id=$1',[id,name,dest]);await db.query('UPDATE campaign_destinations SET destination_url=$2 WHERE campaign_id=$1',[id,dest]);r.destination_url=dest;r.campaign_name=name;return {status:302,location:'/admin/view-campaign/'+id};
 }
 return null;
}
function writable(path){return path==='/org-sales-reps/assign'||/\/(submit|approve|renew)$/.test(path)||/^\/(demo-onboarding|demo-benefit|admin\/edit-campaign)\//.test(path);}
const realExcel=nodeRequire('exceljs');
const demoExcel={...realExcel,Workbook:class extends realExcel.Workbook {
 addWorksheet(...args){const sheet=super.addWorksheet(...args);const original=sheet.addRow.bind(sheet);sheet.addRow=(value,...rest)=>original(Array.isArray(value)?Array.from(value):value,...rest);return sheet;}
}};
async function decorateWorkbook(bytes,query){
 const book=new realExcel.Workbook();await book.xlsx.load(bytes);
 for(const sheet of book.worksheets){if(sheet.name==='Executive Summary')continue;const col=sheet.columnCount+1;sheet.getCell(1,col).value='Responsible rep';sheet.getColumn(col).width=30;sheet.eachRow((row,n)=>{if(n===1)return;const values=row.values.map(v=>typeof v==='object'?JSON.stringify(v):String(v??''));const matches=opportunities.filter(o=>values.includes(o.title)||values.includes(o.edition));if(!matches.length)for(const r of baseRows.filter(r=>values.includes(r.advertiser)||values.includes(r.campaign_name)||values.includes(r.qr_name)))matches.push(opportunities.find(o=>o.id===r.opportunity_id));const names=[...new Set(matches.filter(Boolean).map(o=>repFor(o).name))];if(sheet.name==='Available Opportunities'&&matches.some(o=>o?.inquiry))row.getCell(4).value='Contact for pricing';row.getCell(col).value=names.join(' / ')||'See Sales Reps tab';});}
 const summary=book.getWorksheet('Executive Summary');if(summary){const metrics=reporting(query).rows;summary.addRow([]);summary.addRow(['QR Scans',metrics.reduce((s,r)=>s+r.scans,0)]);summary.addRow(['QR Intent actions',metrics.reduce((s,r)=>s+r.clicks,0)]);summary.addRow(['Data scope','Simulated activity. Website clicks/visitors are separate; see Read Me.']);}
 const definitions=book.addWorksheet('Read Me');definitions.columns=[{header:'Metric / scope',width:30},{header:'Definition',width:110}];for(const row of [['Demo data','Fictional sponsors, contracts, capacity and simulated activity; no school or OneCause data connected.'],['Activity dates','September 15–October 14, 2026; filters select within this sample period.'],['Scans','QR opens.'],['Intent','Offer, maps and directions actions after scanning.'],['Website clicks / visitors','Separate website telemetry; none connected in this demo.'],['Conversions / revenue','Simulated advertiser outcomes and attributed sales value, not school sponsorship revenue.'],['Sponsorship value','Contract value owed for school sponsorships; not a payment receipt.']])definitions.addRow(row);
 const fulfillment=book.addWorksheet('Fulfillment');fulfillment.columns=[{header:'Contract ID',width:16},{header:'Benefit',width:44},{header:'Responsible rep',width:26},{header:'Due date',width:16},{header:'Status',width:16},{header:'Evidence / notes',width:65}];for(const [id,list]of benefits){const d=contractDetails.get(id),o=opportunities.find(o=>o.id===d?.opportunityId);for(const b of list)fulfillment.addRow([id,b.name,o?repFor(o).name:'Demo school team',b.due||'To be agreed',b.done?'Complete':'Pending',b.note||'']);}
 const sheet=book.addWorksheet('Sales Reps');sheet.columns=[{header:'Opportunity',key:'title',width:48},{header:'Program',key:'program',width:28},{header:'Responsible rep',key:'rep',width:30},{header:'Status',key:'status',width:18}];for(const o of opportunities.filter(o=>o.id!==6&&(!query.location_id||o.space_id===+query.location_id)))sheet.addRow({title:o.title,program:o.channel,rep:repFor(o).name,status:o.status});sheet.views=[{state:'frozen',ySplit:1}];sheet.getRow(1).font={bold:true};return Buffer.from(await book.xlsx.writeBuffer());
}
async function dispatch(path,query={},method='GET',body={}){
 if(method==='POST'&&writable(path))return mutate(path,body);
 let extra='';
 const detailMatch=path.match(/^\/advertise\/canterbury-demo\/location\/(\d+)\/opportunity\/(\d+)$/);
 if(detailMatch){const o=opportunities.find(o=>o.id===+detailMatch[2]&&o.space_id===+detailMatch[1]&&o.id!==6);if(!o)return error('Opportunity not found.',404);extra=marketplaceDetail(o,repFor(o),remaining,photo(o.space_id));}
 if(path==='/org-sales-reps'){
  const selected=reps.find(r=>r.id===Number(query.rep_id));
  extra='<h1>Sales Reps</h1><p>Demo assignments only. Assign an accountable person to every sponsorship. Changes stay in this isolated demo and reset on restart.</p><p><a href="/org-marketplace">Advertising inventory</a> · <a href="/advertise/canterbury-demo">Marketplace</a> · <a href="/org-sales-reps">All reps</a></p><div style="display:flex;gap:16px;flex-wrap:wrap">'+reps.map(r=>'<a style="padding:24px;border:1px solid #ddd;border-radius:12px" href="/org-sales-reps?rep_id='+r.id+'"><strong>'+esc(r.name)+'</strong><p>'+r.role+'</p><b>'+opportunities.filter(o=>assignments.get(o.id)===r.id&&o.id!==6).length+' opportunities</b></a>').join('')+'</div><h2>'+(selected?esc(selected.name):'All assignments')+'</h2>'+opportunities.filter(o=>o.id!==6&&(!selected||assignments.get(o.id)===selected.id)).map(o=>'<section style="padding:20px;margin:12px 0;border:1px solid #ddd;border-radius:12px"><h3><a href="/org-marketplace?location_id='+o.space_id+'&program_id='+o.program_id+'">'+esc(o.title)+'</a></h3><p>'+esc(o.channel)+' · '+(o.inquiry?'Pricing requires confirmation':esc(o.pricing_unit))+'</p><form method="POST" action="/org-sales-reps/assign"><input type="hidden" name="opportunity_id" value="'+o.id+'"><label>Responsible person <select name="rep_id">'+reps.map(r=>'<option value="'+r.id+'" '+(assignments.get(o.id)===r.id?'selected':'')+'>'+esc(r.name)+'</option>').join('')+'</select></label> <button>Save assignment</button></form></section>').join('');
 }

 const ob=path.match(/^\/demo-onboarding\/(\d+)$/);
 if(ob){const r=onboarding.get(+ob[1]);if(!r)return error('Approve this sample request first.');extra='<h1>Advertiser onboarding</h1><p>Demonstration only. Your request details carry forward automatically.</p><form method="POST" action="'+path+'"><p><strong>'+esc(r.business_name)+'</strong><br>'+esc(r.contact_name)+' · '+esc(r.email)+'<br>'+esc(r.opportunity_name)+'</p><label>Campaign name <input name="campaign_name" value="'+esc(r.campaign_name)+'"></label><br><label>Destination URL <input name="destination_url" type="url" value="'+esc(r.destination_url)+'"></label><p><label><input type="checkbox" name="tracking" value="yes" checked> Enable optional dynamic QR tracking</label></p><p>Reserved campus locations: '+esc((r.details?.locations||[]).map(id=>campusNames[id]).join(' · '))+'</p><p>Without QR tracking, the school still manages inventory, agreements, benefits and renewals. Conversions and revenue require connected tracking; new placements start with no activity.</p><button>Complete sample setup</button></form>';}

  if(['/org-opportunity-builder','/org-import-opportunities'].includes(path)&&!query.location_id)query={...query,location_id:'10'};
  let match,route;for(const candidate of routes){if(candidate.method!==method)continue;match=path.match(candidate.re);if(match){route=candidate;break;}}if(extra){match=[];route={keys:[],code:'async(req,res)=>res.send(page("Canterbury School",extraContent))'};}if(!route&&['/admin/marketing-command-center','/admin/ai-insights'].includes(path)){match=[];route={keys:[],code:path.endsWith('ai-insights')?'async(req,res)=>res.send(page("AI Performance Center",nativePerformance))':'async(req,res)=>res.send(page("Marketing Command Center",nativeMarketing))'};}if(!route)return null;
  const f=fixtures(query);await ready;
  const q=async(sql,params=[])=>{
   if(!/^\s*(SELECT|WITH)\b/i.test(sql))throw Error('Native demo blocks database writes');
   if(path==='/org-marketplace'&&query.status==='Available'&&/FROM organization_opportunities/i.test(sql)){sql=sql.replace(/FROM organization_opportunities\b/gi,"FROM (SELECT * FROM organization_opportunities WHERE LOWER(status)='available')");}
   return db.query(sql,params);
  };
  const dates={fromDate:f.data.from,toDate:f.data.to,queryString:new URLSearchParams({from:f.data.from,to:f.data.to}).toString()};
  const scope={organizationId:ORG,organization:organization,organizationName:organization.name,allowedLocationIds:f.locations.map(l=>l.id),selectedLocationId:query.location_id?+query.location_id:null,hasOrganizationWideAccess:true,organizationRole:'organization_admin',isSuperAdmin:false,...dates};
  const mocks={'./hexpol-careers-report':{shortcut:()=>''}};
  const moduleCache={};let context;const nativeRequire=name=>{if(mocks[name])return mocks[name];if(name.startsWith('node:'))return nodeRequire(name);const key=name.replace(/^\.\//,'');if(!source.modules[key])throw Error('Native dependency not supplied: '+name);if(moduleCache[key])return moduleCache[key].exports;const module={exports:{}};moduleCache[key]=module;vm.runInContext('(function(require,module,exports){'+source.modules[key]+'\n})',context)(nativeRequire,module,module.exports);return module.exports;};
  context=vm.createContext({extraContent:extra,marketplaceRequest:null,ExcelJS:demoExcel,console,URL,URLSearchParams,Date,Buffer,Math,Number,String,Set,Map,Promise,JSON,parseInt,parseFloat,Intl,process:{env:{}},require:nativeRequire,q,getOrganizationScope:async()=>scope,getOrganizationLocationScope:async()=>scope,ensureCampaignTestModeSchema:async()=>{},getAdvertiserReportingScope:async()=>({locationIds:f.locations.map(l=>l.id),campaignIds:f.campaigns.map(c=>c.id),qrIds:f.records.map(r=>r.id)}),getCustomerScope:async()=>({userId:OWNER}),PDFDocument:class extends nodeRequire('pdfkit'){end(...args){this.addPage();this.fontSize(18).text('Canterbury School — Responsible Reps');this.fontSize(10).text('Demonstration data · '+f.data.from+' through '+f.data.to);this.moveDown();this.text('QR scans: '+f.totals.scans+' | QR intent actions: '+f.totals.offer_clicks);this.text('Website clicks/visitors are separate telemetry, not connected in this demo.');this.text('Conversions and attributed revenue are simulated advertiser outcomes.');this.moveDown();for(const r of f.records){const o=opportunities.find(o=>o.id===r.opportunity_id);this.fontSize(11).text(r.qr_name+' — '+repFor(o).name);this.moveDown();}return super.end(...args);}},QRCode:nodeRequire('qrcode')});
  vm.runInContext(source.helpers,context);
  if(path==='/admin/marketing-command-center')context.nativeMarketing=nativeRequire('./marketing-command-center').renderCommandCenter({title:'Marketing Command Center',scope:{kind:'advertiser',userId:OWNER},range:{from:f.data.from,to:f.data.to},campaigns:f.campaigns.map(c=>({...c,clicks:c.clicks,conversion_value:c.revenue,square_conversions:0,square_value:0})),squareStatus:{connected:false},platform:query.platform||'',campaign:query.campaign||''});
  if(path==='/admin/ai-insights')context.nativePerformance=nativeRequire('./performance-center').renderPerformanceCenter({startDate:f.data.from,endDate:f.data.to,advertisingInvestment:4500,conversionRevenue:f.totals.revenue,conversions:f.totals.conversions,intent:f.totals.offer_clicks,scans:f.totals.scans,activeCampaigns:3,topFiveCampaigns:f.campaigns});
  const req={path,params:Object.fromEntries(route.keys.map((k,i)=>[k,match[i+1]==='canterbury-demo'&&k==='id'?String(ORG):decodeURIComponent(match[i+1])])),query:{...query,organization_id:String(ORG),start_date:f.data.from,end_date:f.data.to,from:f.data.from,to:f.data.to},method,body,headers:{},session:{user:{id:OWNER,role:'customer',name:'Demo Contact',email:'demo@example.com',advertiser_customer_id:OWNER},orgUser:{id:OWNER,user_id:OWNER,organization_id:ORG,name:'Canterbury School Demo Reviewer',email:'demo@example.com',organization_name:organization.name,organization_role:'organization_admin'}},protocol:'https',get:key=>key.toLowerCase()==='host'?(process.env.RAILWAY_PUBLIC_DOMAIN||'localhost'):'',originalUrl:path,url:path};
  let status=200,html,location;const headers={},chunks=[];
  const res=new Writable({write(chunk,enc,callback){chunks.push(Buffer.from(chunk));callback();}});
  res.status=n=>{status=n;return res;};res.send=body=>{html=body;return res;};res.redirect=(url)=>{location=url;return res;};res.setHeader=(k,v)=>{headers[k]=v;return res;};res.set=(k,v)=>{headers[k]=v;return res;};res.type=v=>{headers['Content-Type']=v;return res;};res.json=v=>{html=JSON.stringify(v);return res;};
  try{await vm.runInContext('('+route.code+')',context)(req,res);}catch(err){throw Object.assign(Error(path+': '+err.message),{status:500});}
  if(location)return {status:302,location};
  if(Buffer.isBuffer(html))return {status,bytes:path.endsWith('.xlsx')?await decorateWorkbook(html,query):html,headers};
  if(!html&&Object.keys(headers).some(k=>/content-type/i.test(k))){if(!res.writableFinished)await new Promise(resolve=>res.on('finish',resolve));const bytes=Buffer.concat(chunks);return {status,bytes:path.endsWith('.xlsx')?await decorateWorkbook(bytes,query):bytes,headers};}
  if(typeof html!=='string')return null;
  if(/(?:ERROR:|not defined|is not a function|Native dependency not supplied|Cannot read properties)/i.test(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g,'')))throw Object.assign(Error(path+': '+html.replace(/<[^>]*>/g,' ').slice(-400)),{status:500});
  if(path==='/org-marketplace'){
    for(const o of opportunities){const label='<div class="marketplace-label">Responsible person</div><div class="marketplace-value"><a href="/org-sales-reps?rep_id='+assignments.get(o.id)+'">'+esc(repFor(o).name)+'</a></div>';const edit=new RegExp('(<a\\s+class="marketplace-btn"\\s+href="/org-opportunity/edit/'+o.id+'[\\s\\S]*?</a>)');html=html.replace(edit,label+'$1');}
    html=html.replace(/\$0(?:\.00)?/g,'Price to be confirmed');
  }
  if(path.startsWith('/advertise/canterbury-demo')){
    html=html.replace(/(<(?:article)\b[^>]*>)([\s\S]*?)(<\/article>)/g,(all,start,body,end)=>{const loc=body.match(/\/location\/(\d+)/),prog=body.match(/program_id=(\d+)/);const o=opportunities.find(o=>loc?o.space_id===+loc[1]:prog?o.program_id===+prog[1]:false);return o?start+body+'<p>Responsible person: <a href="/org-sales-reps?rep_id='+assignments.get(o.id)+'">'+esc(repFor(o).name)+'</a></p>'+end:all;});
    html=html.replace(/<a\b([^>]*href="([^"]+)"[^>]*)>([\s\S]*?)<\/a>/g,(all,attrs,href,body)=>{if(!/<h[23]\b/.test(body))return all;const prog=href.match(/program_id=(\d+)/),opp=href.match(/\/opportunity\/(\d+)/);const matches=opportunities.filter(o=>opp?o.id===+opp[1]:prog?o.program_id===+prog[1]:false);if(!matches.length)return all;const names=[...new Set(matches.map(o=>repFor(o).name))].join(' / ');return '<a'+attrs+'>'+body+'<span style="display:block;margin-top:14px;font-size:13px">Responsible person: '+esc(names)+'</span></a>';});
    const match=path.match(/\/opportunity\/(\d+)/);const o=match&&opportunities.find(o=>o.id===+match[1]);if(o&&!detailMatch)html=html.replace('</body>','<p style="max-width:1100px;margin:24px auto">Responsible person: <a href="/org-sales-reps?rep_id='+assignments.get(o.id)+'">'+esc(repFor(o).name)+'</a></p></body>');
  }
  if(path.startsWith('/reports')||path==='/org-performance'){
   html=html.replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/g,(all,attrs,table)=>{if(!/<th\b/.test(table))return all;let found=false;const rows=table.replace(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g,(row,a,cells)=>{if(/<th\b/.test(cells))return '<tr'+a+'>'+cells+'<th>Responsible rep</th></tr>';if(!/<td\b/.test(cells))return row;const text=cells.replace(/<[^>]*>/g,' ');const matches=opportunities.filter(o=>text.includes(o.title)||text.includes(o.edition));const qr=cells.match(/(?:qr_id=|view-qr\/)(\d+)/),camp=cells.match(/(?:campaign_id=|view-campaign\/)(\d+)/);if(qr||camp){const r=baseRows.find(r=>qr?r.qr_id===+qr[1]:r.campaign_id===+camp[1]);if(r)matches.push(opportunities.find(o=>o.id===r.opportunity_id));}const ids=[...new Set(matches.filter(Boolean).map(o=>assignments.get(o.id)))];if(ids.length)found=true;return '<tr'+a+'>'+cells+'<td>'+ids.map(id=>'<a href="/org-sales-reps?rep_id='+id+'">'+esc(reps.find(r=>r.id===id).name)+'</a>').join(' / ')+'</td></tr>';});return found?'<table'+attrs+'>'+rows+'</table>':all;});
  }
  // Native photo routes are redirected to the official school images for this demo.
  html=html.replace(/src="\/org-opportunity\/(\d+)\/photo"/g,(all,id)=>{const o=opportunities.find(o=>o.id===+id);return o?'src="'+photo(o.space_id)+'" alt="'+esc(o.title)+'"':all;});
  html=html.replace(/<img([^>]*src="https:\/\/resources.finalsite.net[^>]*)>/g,(all,attrs)=>'<img'+attrs+' style="width:100%;height:220px;object-fit:contain;object-position:center;border-radius:12px;background:#edf2ed" loading="lazy">');
  if(path.startsWith('/org-')){
   html=html.replace(/<a\b[^>]*href="\/org-renewals[^"]*"[^>]*>[\s\S]*?<\/a>/,(a)=>a.replace(/href="[^"]*"/,'href="/org-sales-reps"').replace(/Renewals/g,'Sales Reps')+a);
   if(!html.includes('href="/org-sales-reps"'))html=html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/,'$1<nav style="margin:16px 0"><a href="/org-organization/canterbury-demo">Overview</a> · <a href="/org-marketplace">Advertising Inventory</a> · <a href="/org-sales-reps">Sales Reps</a> · <a href="/org-performance">Reports</a></nav>');
  }
  if(path==='/org-marketplace')html=html.split('<div class="marketplace-card">').map((part,i)=>{if(!i)return part;const match=part.match(/\/org-opportunity\/edit\/(\d+)/),o=match&&opportunities.find(o=>o.id===+match[1]);return '<div class="marketplace-card">'+(o?'<img src="'+photo(o.space_id)+'" alt="'+esc(o.title)+'" style="width:100%;height:220px;object-fit:'+(o.program_id===6?'contain':'cover')+';object-position:center;border-radius:12px;margin-bottom:18px;background:#edf2ed">':'')+part;}).join('');
  if((path==='/org-performance'||path==='/org-export')){html=html.replace('</body>','<section style="max-width:1160px;margin:24px auto;padding:24px;background:white;border-radius:14px"><h2>Responsible reps by placement</h2><p>Current assignments · sample activity for '+esc(f.data.from)+' through '+esc(f.data.to)+'</p><table><tr><th>Placement</th><th>Responsible rep</th><th>Scans</th><th>Conversions</th></tr>'+f.records.map(r=>{const o=opportunities.find(o=>o.id===r.opportunity_id);return '<tr><td>'+esc(r.qr_name)+'</td><td><a href="/org-sales-reps?rep_id='+assignments.get(o.id)+'">'+esc(repFor(o).name)+'</a></td><td>'+r.scans+'</td><td>'+r.conversions+'</td></tr>';}).join('')+'</table></section></body>');}
  // Branding/data-only substitutions; keep native page structure and form controls.
  html=html.replaceAll('https://vivid-routing-production.up.railway.app','https://'+(process.env.RAILWAY_PUBLIC_DOMAIN||'localhost')+'/demo/canterbury');
  html=html.replaceAll(String(ORG),'canterbury-demo').replace(/>Enterprise<\/a>/g,'>School portal</a>');
  html=html.replace(/<body[^>]*>/i,m=>m+banner());
  const eventOpportunity=!detailMatch&&opportunities.find(o=>o.inquiry&&path.includes('/opportunity/'+o.id));
  if(eventOpportunity){html=html.replace('</body>','<section style="max-width:1100px;margin:24px auto;padding:24px;background:white;border:1px solid #d9e4df;border-radius:14px"><h2>Event details · inquiry only</h2><p>'+esc(eventOpportunity.description)+'</p><p><a href="'+eventOpportunity.source+'" target="_blank" rel="noopener noreferrer">View official school event information</a></p></section></body>');}
  if(path.startsWith('/org-advertising-request/')){const id=Number(path.split('/').at(-1));const request=(await db.query('SELECT opportunity_id FROM organization_advertising_requests WHERE id=$1',[id])).rows[0];if(opportunities.find(o=>o.id===request?.opportunity_id)?.inquiry){html=html.replace(/<button([^>]*)>/g,'<button$1 disabled title="Package and price require school confirmation">');html=html.replace('</body>','<section style="padding:24px"><h2>Event inquiry received</h2><p>Package, benefits, price and availability require school confirmation. No agreement or payment has been created. This sample inquiry is retained in Requests until the demo restarts.</p></section></body>');}}

  const cm=path.match(/^\/org-contract\/(\d+)$/);if(cm){const id=+cm[1];if(!benefits.has(id))benefits.set(id,[{name:'Artwork approved',done:true},{name:'Banner installed',done:true},...(id===103?[{name:'Magazine and annual report recognition',done:false},{name:'Campus TV logo placement',done:false}]:[])]);const list=benefits.get(id);const detail=contractDetails.get(id)||{};const o=opportunities.find(o=>o.id===detail.opportunityId);html=html.replace('</body>',fulfillmentPanel(id,list,detail,o?repFor(o).name:'Demo school team',campusNames)+'</body>');}

  if(path.startsWith('/org-advertising-request/')){const id=Number(path.split('/').at(-1));if(onboarding.has(id))html=html.replace('</body>','<p style="padding:24px"><a href="/demo-onboarding/'+id+'">Continue advertiser onboarding with request details</a></p></body>');}

  const qrView=path.match(/^\/admin\/view-qr\/(\d+)$/);if(qrView&&baseRows.some(r=>r.qr_id===+qrView[1]))html=html.replace('</body>','<section style="max-width:1120px;margin:24px auto;padding:24px;background:white;border:1px solid #d9e4df;border-radius:14px"><h2>Optional dynamic QR</h2><p>The same QR opens the current campaign destination. This private sample QR requires your review session and is not for printed distribution.</p><a href="/qr/'+qrView[1]+'.png">Download sample QR</a> · <a href="/r/'+qrView[1]+'">Preview current destination</a></section></body>');
  if(path==='/my-setup'){const untracked=(await db.query('SELECT id,contract_name FROM contracts WHERE qr_id IS NULL AND organization_id=$1',[ORG])).rows;if(untracked.length)html=html.replace('</body>','<section style="max-width:1120px;margin:24px auto;padding:24px;background:white;border:1px solid #d9e4df;border-radius:14px"><h2>Sponsorships without QR tracking</h2><p>Your sponsorship remains managed. Scans, clicks, conversions and attributed revenue are not measured for these placements.</p>'+untracked.map(r=>'<p><a href="/org-contract/'+r.id+'">'+esc(r.contract_name)+'</a></p>').join('')+'</section></body>');}
  html=html.replace('</head>','<style>img[src*="footerlogo.png"]{object-fit:contain!important;background:#0b1f3a!important;padding:12px!important;border-radius:8px}</style></head>');
  html=html.replace(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi,(whole,attrs,body)=>/method\s*=\s*["']?post/i.test(attrs)&&!(/action=["'][^"']*\/review["']/i.test(attrs))&&!writable((attrs.match(/action=["']([^"']+)/i)||[])[1]||'')?'<form'+attrs+' onsubmit="return false">'+body.replace(/<button\b(?![^>]*type=["']button)/gi,'<button disabled title="Saving is disabled in this demo"')+'<p class="note">View-only demonstration. Saving is disabled.</p></form>':whole);
  html=html.replace(/[&?]location_id=null/g,'').replace(/href="\/admin\/setup"/g,'href="/my-setup"');
  html=html.replace(/href="\/admin\/(archive|deactivate|restore)-[^"]+"/g,'href="/my-setup" title="View-only demo: no records are changed"');
  html=html.replace(/<a\b([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi,(all,before,href,after,label)=>{const p=href.split(/[?#]/)[0];if(['/admin','/admin/users','/build-my-campaign'].includes(p)||p.startsWith('/admin/connectors/')||/^\/admin\/destination\/\d+\/edit$/.test(p)||/\/(?:disable|delete|remove|send-password-reset)$/.test(p))return '<span title="Unavailable in this view-only demo" style="opacity:.6">'+label+'</span>';return all;});
  html=polish(html,path,query,{remaining,opportunities,repFor,packageComparison});
  return {status,html,headers};
 }
 const routes=source.routes.map(r=>{const keys=[];const pattern=r.path.replace(/:[A-Za-z]+/g,s=>{keys.push(s.slice(1));return '([^/]+)';});return {...r,keys,re:new RegExp('^'+pattern+'$')};});
 return {dispatch,writable,sourceCommit:source.commit,paths:routes.map(r=>r.path)};
}
