import {createNativeRuntime} from './native-runtime.js';
import crypto from 'node:crypto';
import QRCode from 'qrcode';

// Standalone Canterbury School demonstration. No production imports, database, or credentials.
const INVITE_HASH = 'ee8449a8c972454b818380746e2a011f31e85403f544e76072539f302a3b3a94';
const PREFIX = '/demo/canterbury';
const SESSION_VALUE = crypto.randomBytes(32).toString('hex');
const EXPIRES = Date.parse('2027-01-14T23:59:59Z');
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const number=v=>Number(v||0).toLocaleString('en-US');
const date=v=>v?new Date(v).toISOString().slice(0,10):'Not set';
const source='https://www.canterburyfortmyers.org/giving/banner-program';
const groups=[
 {id:1,name:'Campus banners',description:'School-year banner placements. Bronze includes one location, Silver two and Gold three.',packages:['Upper School driveway','Murphy Sports Center','Middle School driveway / tennis area'],items:['Bronze — Upper School banner','Bronze — Murphy Sports Center banner','Bronze — Middle School banner']},
 {id:2,name:'Multi-location sponsorships',description:'School-year packages with magazine and annual report recognition and campus TV logo placement.',packages:['Two campus locations','Three campus locations'],items:['Silver banner sponsorship','Gold banner sponsorship']},
 {id:3,name:'Athletic recognition',description:'Gold includes audio acknowledgement for one sport and the option to distribute an approved promotional item at an athletics event.',packages:['Murphy Sports Center / FineMark Field'],items:['Audio acknowledgement — Gold benefit']}
];
let sequence=0;
const opportunities=groups.flatMap(g=>g.items.map((title,i)=>({id:++sequence,program_id:g.id,space_id:g.id===1?10+i:g.id===2?20+i:30,channel:g.name,edition:g.packages[i]||g.packages[0],title,status:[1,2,4].includes(sequence)?'Sold':sequence===3?'Pending':'Available',description:g.description})));
const demoPrices=[1500,1500,1500,2500,5000,0];
opportunities.forEach((o,i)=>{o.price=demoPrices[i];o.pricing_unit=i===5?'included with Gold':'per school year';});
// Additional sample availability at the published locations; quantities are illustrative.
for(const id of [1,2,3,4]){const o=opportunities.find(o=>o.id===id);opportunities.push({...o,id:opportunities.length+1,status:'Available'});}
for(const o of opportunities){o.description += ' '+(o.price===5000?'Gold: three banner locations, magazine and annual report recognition, campus TV logo placement, audio acknowledgement for one sport, and optional approved promotional item distribution.':o.price===2500?'Silver: two banner locations, magazine and annual report recognition, and campus TV logo placement.':o.price===1500?'Bronze: one banner location for the school year.':'Included with Gold, not sold separately.');}
// Public event listings verified October 15, 2026. Unpublished prices stay null.
const eventGroups=[
 {id:4,name:'Carnival',description:'October 24, 2026 · Mason Goss ’86 Field · 5–8 p.m. Activity sponsorship recognition for families. Package pricing and availability require school confirmation.',source:'https://www.canterburyfortmyers.org/community/carnival',date:'2026-10-24',items:[['Bounce house sponsorship','Recognition signage near a bounce house.'],['Activity sponsorship','Recognition signage near an activity.'],['Game sponsorship','Recognition signage near a game.']]},
 {id:5,name:'Cougar Classic',description:'May 14, 2027 · The Club at Gateway · Annual golf tournament. Explore sponsorship interest; 2027 package names, benefits and pricing require confirmation.',source:'https://www.canterburyfortmyers.org/giving/golf-tournament',date:'2027-05-14',items:[['Cougar Classic 2027 — sponsorship inquiry','The school invites supporters to sponsor its annual golf tournament. Specific tiers and prices are not verified.']]},
 {id:6,name:'Extravaganza',description:'January 30, 2027 · Murphy Sports Center · Canterbury’s annual fundraising celebration. Register interest in event support; sponsorship packages have not been verified.',source:'https://www.canterburyfortmyers.org/giving/extravaganza/extravaganza-2027',date:'2027-01-30',items:[['Extravaganza 2027 — event support inquiry','An evening supporting Canterbury students and programs. Inquiry only: no specific sponsor benefits or rates are promised.']]}
];
for(const g of eventGroups){groups.push({...g,packages:[g.name+' '+g.date.slice(0,4)],items:g.items.map(x=>x[0])});for(const [title,detail]of g.items){opportunities.push({id:opportunities.length+1,program_id:g.id,space_id:40+g.id,channel:g.name,edition:g.name+' · '+g.date,title,status:'Available',price:null,pricing_unit:'pricing to be confirmed',event_date:g.date,source:g.source,inquiry:true,description:g.description+' '+detail+' Request details only; this demo sends no messages to the school.'});}}
const advertiser='Demo Family Business';
const baseRows=[
 {qr_id:101,campaign_id:201,opportunity_id:1,qr_name:'Upper School driveway banner',edition:'Upper School driveway',scans:126,clicks:84,conversions:7,revenue:840,cost:1500,kind:'print'},
 {qr_id:102,campaign_id:202,opportunity_id:2,qr_name:'Murphy Sports Center banner',edition:'Murphy Sports Center',scans:90,clicks:63,conversions:5,revenue:600,cost:1500,kind:'print'},
 {qr_id:103,campaign_id:203,opportunity_id:4,qr_name:'Silver banner sponsorship',edition:'Two campus locations',scans:92,clicks:61,conversions:5,revenue:600,cost:2500,kind:'print'}
].map(r=>({...r,advertiser,advertiser_id:1,status:'Active',campaign_name:'Demo — '+r.qr_name,start_date:'2026-09-15',end_date:'2027-05-31',contract_end:'2027-05-31',renewal_date:'2027-04-01',destination_name:'Sample family offer',destination_url:'https://example.com/?vivid_demo=canterbury'}));
const sampleContractRevenue=baseRows.reduce((sum,r)=>sum+r.cost,0);
function reporting(q){
 const from=q.start_date||q.startDate||q.from||'2026-09-15',to=q.end_date||q.endDate||q.to||'2026-10-14';
 for(const value of [from,to])if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||date(value)!==value)throw Object.assign(Error('Choose valid reporting dates.'),{status:400});
 if(from>to)throw Object.assign(Error('Start date must be before the end date.'),{status:400});
 if(q.advertiser_id&&q.advertiser_id!=='1')throw Object.assign(Error('Advertiser unavailable in this demo.'),{status:404});
 let rows=baseRows.map(r=>({...r,scans:0,clicks:0,conversions:0,revenue:0}));
 // Daily, deterministic sample activity; date filters work without storing events.
 for(let d=Date.parse('2026-09-15');d<=Date.parse('2026-10-14');d+=86400000){const day=date(d);if(day<from||day>to)continue;const idx=(d-Date.parse('2026-09-15'))/86400000;
  rows.forEach((r,i)=>{for(const k of ['scans','clicks','conversions','revenue'])r[k]+=Math.floor(baseRows[i][k]*(idx+1)/30)-Math.floor(baseRows[i][k]*idx/30);});}
 if(q.location_id){const ids=opportunities.filter(o=>String(o.space_id)===q.location_id).map(o=>o.id);if(!ids.length)throw Object.assign(Error('Location unavailable in this demo.'),{status:404});rows=rows.filter(r=>ids.includes(r.opportunity_id));}
 for(const [key,field]of [['qr_id','qr_id'],['campaign_id','campaign_id']])if(q[key]){rows=rows.filter(r=>String(r[field])===q[key]);if(!rows.length)throw Object.assign(Error('Placement unavailable in this demo.'),{status:404});}
 return {rows,from,to,brand:'Canterbury School',marketplace:'canterbury-demo',detailRoot:'/canterbury-demo/placement'};
}
function demoBanner(){return `<div class="canterbury-demo-bar"><strong>Canterbury School · Private demo</strong><nav><a href="/org-organization/canterbury-demo">School portal</a> · <a href="/advertise/canterbury-demo">Marketplace</a> · <a href="/my-setup">Advertiser portal</a> · <a href="/admin/marketing-command-center">Marketing Command Center</a></nav><details><summary>About this demonstration</summary><p>Illustrative availability, fictional sponsors and simulated reporting. Changes reset on restart. No school messages, payments or agreements are sent. Event prices require confirmation. Independent Vivid demonstration; no OneCause integration is connected.</p></details></div>`;}

function rewrite(html){return html.replace(/(["'`])(\/(?!\/)[^\s"'`<>]*)\1/g,(all,quote,url)=>quote+PREFIX+url+quote);}
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
function response(body,status=200,type='text/html; charset=utf-8',extra={}){return new Response(body,{status,headers:{...headers,'Content-Type':type,...extra}});}
function validToken(token){return typeof token==='string'&&token.length<100&&crypto.createHash('sha256').update(token).digest('hex')===INVITE_HASH;}
const vividNative=createNativeRuntime({baseRows,opportunities,groups,reporting,banner:demoBanner});
export {vividNative};
export async function handle(request){
 try{const url=new URL(request.url),path=url.pathname,q=Object.fromEntries(url.searchParams);
  if(path==='/health')return response('ok',200,'text/plain');
  if(!['GET','HEAD','POST'].includes(request.method))return response('This demonstration is view-only.',405,'text/plain',{'Allow':'GET, HEAD'});
  if(Date.now()>=EXPIRES)return response('This demo invitation has expired.',410,'text/plain');
  const entry=path.match(/^\/canterbury-review\/([^/]+)\/(enterprise|marketplace|advertiser)$/);
  if(entry){if(!validToken(entry[1]))return response('Demo link not found.',404,'text/plain');const target=entry[2]==='marketplace'?'/advertise/canterbury-demo':entry[2]==='advertiser'?'/my-setup':'/enterprise';return response('',302,'text/plain',{'Location':PREFIX+target,'Set-Cookie':`vivid.canterbury.demo=${SESSION_VALUE}; HttpOnly; SameSite=Lax; ${url.protocol==='https:'?'Secure; ':''}Path=${PREFIX}; Max-Age=28800`});}
  if(!path.startsWith(PREFIX+'/'))return response('A private Canterbury School demo invitation is required.',404,'text/plain');
  const cookie=request.headers.get('cookie')||'';if(!cookie.split(';').some(c=>c.trim()==='vivid.canterbury.demo='+SESSION_VALUE))return response('Please reopen your original Canterbury School demo invitation.',401,'text/plain');
  const rawPath=path.slice(PREFIX.length);
  if(q.organization_id&&q.organization_id!=='canterbury-demo')return response('Organization unavailable in this demo.',404,'text/plain');
  const aliases={'/enterprise':'/org-organization/canterbury-demo','/locations':'/org-locations','/inventory':'/org-marketplace','/advertisers':'/org-advertisers','/requests':'/org-advertising-requests','/contracts':'/org-contracts','/renewals':'/org-renewals','/pipeline':'/org-revenue-pipeline','/operations':'/org-operations','/campaign-help':'/help'};
  let nativePath=aliases[rawPath]||rawPath;
  if(rawPath==='/org-business-breakdown'&&q.metric==='available'){nativePath='/org-marketplace';q.status='Available';}
  const legacyPlacement=rawPath.match(/^\/canterbury-demo\/placement\/(\d+)$/);if(legacyPlacement)nativePath='/admin/view-qr/'+legacyPlacement[1];
  const legacyContract=rawPath.match(/^\/contract\/(\d+)$/);if(legacyContract)nativePath='/org-contract/'+legacyContract[1];
  const program=rawPath.match(/^\/advertise\/canterbury-demo\/program\/(\d+)$/);if(program){q.program_id=program[1];nativePath='/advertise/canterbury-demo';}
  const formPreview=request.method==='POST'&&/^\/advertise\/canterbury-demo\/location\/\d+\/opportunity\/\d+\/review$/.test(rawPath);
  if(request.method==='POST'&&!formPreview&&!vividNative.writable(rawPath))return response('This demonstration is view-only.',405,'text/plain');
  if(request.method==='POST'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return response('Invalid request origin.',403,'text/plain');
  const nativeBody=request.method==='POST'?Object.fromEntries(await request.formData()):{};
  const nativeResult=await vividNative.dispatch(nativePath,q,request.method==='POST'?'POST':'GET',nativeBody);
  if(nativeResult){
   if(nativeResult.location)return response('',302,'text/plain',{Location:PREFIX+nativeResult.location.replace('organization_id=900001','organization_id=canterbury-demo')});
   if(nativeResult.bytes)return response(nativeResult.bytes,nativeResult.status,nativeResult.headers['Content-Type']||'application/octet-stream',nativeResult.headers);
   if(nativeResult.headers?.['Content-Type']?.includes('csv'))return response(nativeResult.html,nativeResult.status,nativeResult.headers['Content-Type'],nativeResult.headers);
   return response(rewrite(nativeResult.html),nativeResult.status);
  }
  const local=rawPath;
  if(local==='/export/report.csv'){const result=await vividNative.dispatch('/export/events.csv',q);return response(result.html,200,'text/csv; charset=utf-8',result.headers);}
  const qr=local.match(/^\/qr\/(\d+)\.png$/);if(qr){if(!baseRows.some(r=>r.qr_id===+qr[1]))return response('QR not found.',404,'text/plain');return response(await QRCode.toBuffer(url.origin+PREFIX+'/r/'+qr[1],{width:400,margin:3}),200,'image/png',{'Content-Disposition':`attachment; filename="Canterbury-SAMPLE-QR-${qr[1]}.png"`});}
  const open=local.match(/^\/r\/(\d+)$/);if(open&&baseRows.some(r=>r.qr_id===+open[1]))return response('',302,'text/plain',{Location:baseRows.find(r=>r.qr_id===+open[1]).destination_url});
  return response('Demo page not found.',404,'text/plain');
 }catch(error){console.error('CANTERBURY DEMO:',error.message);return response(h(error.status?error.message:'Demo temporarily unavailable.'),error.status||500);}
}
if(typeof Bun!=='undefined')Bun.serve({port:Number(Bun.env.PORT||3000),fetch:handle});
else {const {createServer}=await import('node:http');createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=chunks.length?Buffer.concat(chunks):undefined;const result=await handle(new Request((String(req.headers['x-forwarded-proto']||'http').split(',')[0])+"://"+(req.headers.host||'localhost')+req.url,{method:req.method,headers:req.headers,...(body?{body}: {})}));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}).listen(Number(process.env.PORT||3000));}
