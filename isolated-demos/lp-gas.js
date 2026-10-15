import {createNativeRuntime} from './native-runtime.js';
import crypto from 'node:crypto';
import QRCode from 'qrcode';

// Standalone LP Gas demonstration. No production imports, database, or credentials.
const INVITE_HASH = '838cf329e5a5e44cf3c767f47261eea53b8c8c21d524e7d6aa1412e50727eb68';
const PREFIX = '/demo/lp-gas';
const SESSION_VALUE = crypto.randomBytes(32).toString('hex');
const EXPIRES = Date.parse('2027-01-14T23:59:59Z');
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const number=v=>Number(v||0).toLocaleString('en-US');
const date=v=>v?new Date(v).toISOString().slice(0,10):'Not set';
const source='https://www.lpgasmagazine.com/advertising/';
const groups=[
 {id:1,name:'Print advertising',description:'Issue-based placements with dynamic QR engagement.',packages:['Illustrative upcoming print issue'],items:['Print display advertisement','Additional print placement inquiry']},
 {id:2,name:'Email newsletters',description:'Newsletter placements connected to advertiser destinations.',packages:['Illustrative newsletter campaign'],items:['Blue Flame Pilot advertising','Propane Price Insider advertising']},
 {id:3,name:'Website advertising',description:'Website placements and section sponsorships.',packages:['Illustrative website campaign'],items:['Website display advertisement','Website section sponsorship']},
 {id:4,name:'Sponsored content & video',description:'Promotional stories and videos with measurable next steps.',packages:['Illustrative content campaign'],items:['Sponsored content campaign','Sponsored video campaign']},
 {id:5,name:'Webinars',description:'Webinar promotion connected to registration and follow-up.',packages:['Illustrative webinar campaign'],items:['Sponsored webinar']},
 {id:6,name:'Event partnerships',description:'Growth Summit and Hall of Fame partnership exploration.',packages:['Growth Summit — future-cycle example','Hall of Fame — future-cycle example'],items:['Growth Summit partnership','Hall of Fame partnership']},
 {id:7,name:'Buyers Guide',description:'Explore print and online supplier visibility.',packages:['Illustrative annual guide'],items:['Buyer’s Guide advertiser inquiry']}
];
let sequence=0;
const opportunities=groups.flatMap(g=>g.items.map((title,i)=>({id:++sequence,program_id:g.id,space_id:g.id===6?61+i:g.id*10,channel:g.name,edition:g.packages[Math.min(i,g.packages.length-1)],title,status:[1,3,10].includes(sequence)?'Sold':[6,8].includes(sequence)?'Pending':'Available',description:g.description})));
// Conservative illustrative planning prices, not verified LP Gas rate-card prices.
const demoPrices=[1500,750,500,350,400,750,1000,1250,2000,2500,1500,300];
const demoUnits=['per issue','per issue','per send','per send','per month','per month','per campaign','per campaign','per webinar','per event','per event','per year'];
opportunities.forEach((o,i)=>{o.price=demoPrices[i];o.pricing_unit=demoUnits[i];});
const advertiser='Demo Equipment Supplier';
const baseRows=[
 {qr_id:101,campaign_id:201,opportunity_id:1,qr_name:'Print display advertisement',edition:'Illustrative print issue',scans:126,clicks:84,conversions:7,revenue:8400,cost:2200,kind:'print'},
 {qr_id:102,campaign_id:202,opportunity_id:3,qr_name:'Blue Flame Pilot advertising',edition:'Illustrative newsletter campaign',scans:0,clicks:213,conversions:11,revenue:13200,cost:1500,kind:'digital'},
 {qr_id:103,campaign_id:203,opportunity_id:10,qr_name:'Growth Summit partnership',edition:'Future-cycle event example',scans:92,clicks:61,conversions:5,revenue:6000,cost:4000,kind:'event'}
].map(r=>({...r,cost:opportunities.find(o=>o.id===r.opportunity_id).price,advertiser,advertiser_id:1,status:'Active',campaign_name:'Demo — '+r.qr_name,start_date:'2026-09-15',end_date:'2026-12-31',contract_end:'2026-12-31',renewal_date:'2026-12-01',destination_name:'Illustrative product inquiry',destination_url:'https://example.com/?vivid_demo=lp-gas'}));
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
 return {rows,from,to,brand:'LP Gas',marketplace:'lp-gas-demo',detailRoot:'/lp-gas-demo/placement'};
}
function demoBanner(){return `<div style="padding:14px 24px;background:#edf3f9;color:#23374d;font:14px Arial"><strong>LP Gas Magazine · Vivid demonstration</strong> · View-only · Illustrative inventory, fictional contract values and simulated activity · Conservative demo pricing · Not verified LP Gas rates<br><a href="/org-organization/lp-gas-demo">Publisher portal</a> · <a href="/advertise/lp-gas-demo">Marketplace</a> · <a href="/my-setup">Advertiser portal</a> · <a href="/admin/marketing-command-center">Marketing Command Center</a></div>`;}
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
  const entry=path.match(/^\/lp-gas-review\/([^/]+)\/(enterprise|marketplace|advertiser)$/);
  if(entry){if(!validToken(entry[1]))return response('Demo link not found.',404,'text/plain');const target=entry[2]==='marketplace'?'/advertise/lp-gas-demo':entry[2]==='advertiser'?'/my-setup':'/enterprise';return response('',302,'text/plain',{'Location':PREFIX+target,'Set-Cookie':`vivid.lp-gas.demo=${SESSION_VALUE}; HttpOnly; SameSite=Lax; ${url.protocol==='https:'?'Secure; ':''}Path=${PREFIX}; Max-Age=28800`});}
  if(!path.startsWith(PREFIX+'/'))return response('A private LP Gas demo invitation is required.',404,'text/plain');
  const cookie=request.headers.get('cookie')||'';if(!cookie.split(';').some(c=>c.trim()==='vivid.lp-gas.demo='+SESSION_VALUE))return response('Please reopen your original LP Gas demo invitation.',401,'text/plain');
  const rawPath=path.slice(PREFIX.length);
  if(q.organization_id&&q.organization_id!=='lp-gas-demo')return response('Organization unavailable in this demo.',404,'text/plain');
  const aliases={'/enterprise':'/org-organization/lp-gas-demo','/locations':'/org-locations','/inventory':'/org-marketplace','/advertisers':'/org-advertisers','/requests':'/org-advertising-requests','/contracts':'/org-contracts','/renewals':'/org-renewals','/pipeline':'/org-revenue-pipeline','/operations':'/org-operations','/campaign-help':'/help'};
  let nativePath=aliases[rawPath]||rawPath;
  if(rawPath==='/org-business-breakdown'&&q.metric==='available'){nativePath='/org-marketplace';q.status='Available';}
  const legacyPlacement=rawPath.match(/^\/lp-gas-demo\/placement\/(\d+)$/);if(legacyPlacement)nativePath='/admin/view-qr/'+legacyPlacement[1];
  const legacyContract=rawPath.match(/^\/contract\/(\d+)$/);if(legacyContract)nativePath='/org-contract/'+legacyContract[1];
  const program=rawPath.match(/^\/advertise\/lp-gas-demo\/program\/(\d+)$/);if(program){q.program_id=program[1];nativePath='/advertise/lp-gas-demo';}
  const formPreview=request.method==='POST'&&/^\/advertise\/lp-gas-demo\/location\/\d+\/opportunity\/\d+\/review$/.test(rawPath);
  if(request.method==='POST'&&!formPreview)return response('This demonstration is view-only.',405,'text/plain');
  const nativeBody=formPreview?Object.fromEntries(await request.formData()):{};
  const nativeResult=await vividNative.dispatch(nativePath,q,formPreview?'POST':'GET',nativeBody);
  if(nativeResult){
   if(nativeResult.location)return response('',302,'text/plain',{Location:PREFIX+nativeResult.location.replace('organization_id=900001','organization_id=lp-gas-demo')});
   if(nativeResult.bytes)return response(nativeResult.bytes,nativeResult.status,nativeResult.headers['Content-Type']||'application/octet-stream',nativeResult.headers);
   if(nativeResult.headers?.['Content-Type']?.includes('csv'))return response(nativeResult.html,nativeResult.status,nativeResult.headers['Content-Type'],nativeResult.headers);
   return response(rewrite(nativeResult.html),nativeResult.status);
  }
  const local=rawPath;
  if(local==='/export/report.csv'){const result=await vividNative.dispatch('/export/events.csv',q);return response(result.html,200,'text/csv; charset=utf-8',result.headers);}
  const qr=local.match(/^\/qr\/(\d+)\.png$/);if(qr){if(!baseRows.some(r=>r.qr_id===+qr[1]))return response('QR not found.',404,'text/plain');return response(await QRCode.toBuffer('https://example.com/?vivid_demo=lp-gas&placement='+qr[1],{width:400,margin:3}),200,'image/png',{'Content-Disposition':`attachment; filename="LP-Gas-SAMPLE-QR-${qr[1]}.png"`});}
  const open=local.match(/^\/r\/(\d+)$/);if(open&&baseRows.some(r=>r.qr_id===+open[1]))return response('',302,'text/plain',{Location:'https://example.com/?vivid_demo=lp-gas'});
  return response('Demo page not found.',404,'text/plain');
 }catch(error){console.error('LP GAS DEMO:',error.message);return response(h(error.status?error.message:'Demo temporarily unavailable.'),error.status||500);}
}
if(typeof Bun!=='undefined')Bun.serve({port:Number(Bun.env.PORT||3000),fetch:handle});
else {const {createServer}=await import('node:http');createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=chunks.length?Buffer.concat(chunks):undefined;const result=await handle(new Request((String(req.headers['x-forwarded-proto']||'http').split(',')[0])+"://"+(req.headers.host||'localhost')+req.url,{method:req.method,headers:req.headers,...(body?{body}: {})}));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}).listen(Number(process.env.PORT||3000));}
