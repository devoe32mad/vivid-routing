import {imagery,opportunityImage} from './imagery.js';
import {createNativeRuntime} from './native-runtime.js';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import {createJourney} from './journey.js';
import {readFileSync} from 'node:fs';

// Standalone OSBA demonstration. No production imports, database, or credentials.
const INVITE_HASH = '6446ed9c5132ae3946fb895e95460d629c2a55ea7169f4b3f19e43bafa0ba95c';
const PREFIX = '/demo/osba';
const SESSION_VALUE = crypto.randomBytes(32).toString('hex');
const EXPIRES = Date.parse('2027-01-14T23:59:59Z');
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const number=v=>Number(v||0).toLocaleString('en-US');
const date=v=>v?new Date(v).toISOString().slice(0,10):'Not set';
const source='https://www.ohioschoolboards.org/advertise-osba-media-kit';
const mediaKit='https://www.ohioschoolboards.org/sites/default/files/uploads/2026_Media_Kit/2026_MKT_MediaKit_v1.pdf';
const sponsorshipGuide='https://www.ohioschoolboards.org/sites/default/files/uploads/2026_Media_Kit/2026_MKT_SponsorshipGuide_v2.pdf';
const groups=[
 {id:1,name:'Publications',description:'Journal magazine and the annual VendorBook: explore formats and published 2026 rates.'},
 {id:2,name:'Digital advertising',description:'Website, directory, newsletter and social advertising.'},
 {id:3,name:'Events & sponsorships',description:'Capital Conference, Nov. 15–17, 2026. Published sponsorship packages; demo availability is illustrative.'},
 {id:4,name:'Webinars',description:'Educational webinar: a 60-minute vendor session, limited to one vendor per month.'}
];
const opportunities=[];
function offer(id,program_id,space_id,edition,title,price,pricing_unit,description,sourceUrl=source,status='Available'){
 opportunities.push({id,program_id,space_id,edition,title,price,pricing_unit,sourceUrl,description:description+' Confirm dates and availability with OSBA.',channel:groups.find(g=>g.id===program_id).name,status});
}
// Preserve existing sample contract references; additional inventory has independent IDs.
offer(1,1,10,'OSBA Journal','Journal — full-page advertisement',1500,'per issue','One full-page display advertisement in an OSBA Journal issue, reaching Ohio school board members and district leaders.',mediaKit,'Sold');
offer(2,1,11,'OSBA VendorBook','VendorBook — full-page advertisement',1200,'per year','One full-page display advertisement in OSBA’s annual directory of goods and services for schools.',mediaKit);
offer(3,2,20,'OSBA website','Website banner',400,'per month','Homepage placement linking to your website.',source,'Sold');
offer(4,3,30,'2026 Capital Conference','Conference luncheon sponsorship',7500,'per event','Silver package. Luncheon tickets, social promotion and wall graphics.',sponsorshipGuide);
offer(5,3,30,'2026 Capital Conference','Hydration station sponsorship',3000,'per event','Bronze package. Water-station branding and annual VendorLink.',sponsorshipGuide,'Sold');
offer(6,4,40,'Educational webinar','Educational webinar',1500,'per webinar','60-minute vendor presentation; one vendor each month.',source,'Pending');
let nextId=7;
for(const [title,price] of [['Inside front cover',1700],['Inside back cover',1550],['Outside back cover',1550],['2/3 page',1100],['1/2 page',930],['1/3 page',650],['1/6 page',400]])offer(nextId++,1,10,'OSBA Journal','Journal — '+title,price,'per issue',title+' advertisement in one OSBA Journal issue. Optional dynamic QR tracking is available in this Vivid demo.',mediaKit);
for(const [title,price] of [['Inside front cover',1400],['Inside back cover',1400],['Outside back cover',1450],['1/2 page',800],['1/3 page',600],['1/6 page',390],['Business card ad',225],['Five-line listing',85],['Additional category',25]])offer(nextId++,1,11,'OSBA VendorBook','VendorBook — '+title,price,'per year',title==='Additional category'?'Add-on to a directory listing; price per category.':title+' placement in OSBA’s annual VendorBook directory of goods and services for schools.',mediaKit);
offer(nextId++,2,21,'OSBA VendorLink','VendorLink annual listing',150,'per year','An annual OSBA VendorLink directory entry with your company name, website link and business description.');
offer(nextId++,2,22,'OSBA Update e-newsletter','Update newsletter tile ad',250,'per email','A linked logo tile in one OSBA Update email, directing readers to your website. Limited to one vendor per month.');
offer(nextId++,2,23,'OSBA Facebook','Facebook advertising package',800,'per six months','Two advertising posts per month on OSBA’s Facebook page for six months, introducing your business to OSBA’s audience.');
for(const [title,price,description] of [
 ['Standalone photo opportunity',25000,'Diamond package. Branded attendee photo experience.'],
 ['Conference App',20000,'Platinum package. App branding and banner placement.'],
 ['General Session',8750,'Gold package. Session sponsorship.'],
 ['Refreshment station',8750,'Gold package. Coffee-break sponsorship.'],
 ['Sunday Welcome Reception',8000,'Gold package. Sunday reception sponsorship.'],
 ['Monday President’s Reception',8000,'Gold package. Monday reception sponsorship.'],
 ['Black Caucus Dinner',7500,'Silver package. Dinner sponsorship.'],
 ['Exhibitor Express Talks',5500,'Silver package. Two 30-minute presentations.'],
 ['Spotlight Session',4500,'Bronze package. Session sponsorship.'],
 ['Hotel transportation',4500,'Bronze package. Shuttle branding.'],
 ['OSBA Game Card',3000,'Bronze package. Booth-visit promotion.'],
 ['Rest & Relax Lounge',3000,'Bronze package. Lounge sponsorship.']
])offer(nextId++,3,30,'2026 Capital Conference',title,price,'per event',description,sponsorshipGuide);
// These real 2026 products are already sold according to OSBA; keep them internal.
offer(nextId++,3,30,'2026 Capital Conference','Attendee bags — sold for 2026',20000,'per event','Platinum package. OSBA marks this exclusive offering sold for 2026.',sponsorshipGuide,'Sold');
offer(nextId++,3,30,'2026 Capital Conference','Attendee lanyards — sold for 2026',20000,'per event','Platinum package. OSBA marks this exclusive offering sold for 2026.',sponsorshipGuide,'Sold');
// Separate sample openings let visitors explore the original products without altering contracts.
offer(nextId++,1,10,'OSBA Journal','Journal — full-page opening (sample)',1500,'per issue','Illustrative additional opening; optional QR tracking.',mediaKit);
offer(nextId++,2,20,'OSBA website','Website banner opening (sample)',400,'per month','Illustrative additional month; destination website link.');
offer(nextId++,3,30,'2026 Capital Conference','Hydration station opening (sample)',3000,'per event','Illustrative additional sponsor opening.',sponsorshipGuide);
offer(nextId++,4,40,'Educational webinar','Educational webinar opening (sample)',1500,'per webinar','Illustrative additional month; 60-minute vendor session.');
for(const o of opportunities){
 const extra=o.program_id===1?' Artwork: print-ready PDF, embedded fonts, CMYK, 300 dpi. Publication dates and artwork deadlines require confirmation.':o.space_id===23?' Package term: six months, two posts per month.':o.program_id===4?' Provide a session title, speakers, description, three learning takeaways and three preferred dates. OSBA approval is required.':'';
 const benefits=o.id===4?' Includes a table for eight, table-tent recognition, two Facebook posts, a 10 × 10 booth, annual VendorLink, half-page Journal ad, two wall graphics, two InfoAlerts and a conference website banner.': [5,42].includes(o.id)?' Includes water-station branding and annual VendorLink; up to four sponsors in the published package.':[36,37].includes(o.id)?' Includes one month of website banner advertising and one InfoAlert.':o.id===33?' Includes a 10 × 10 booth, annual VendorLink, half-page Journal ad, two 30-minute talks, two InfoAlerts and an app session banner.':o.space_id===11&&o.id!==21&&o.id!==22?' Display advertising includes a five-line listing in two categories. Additional categories cost $25 each.':'';
 o.description+=' '+benefits+extra;
 if(o.id===22)o.status='Sold'; // Add-on is selected with a directory request, not sold independently.
}
const advertiser='Demo School Solutions';
const baseRows=[
 {qr_id:101,campaign_id:201,opportunity_id:1,qr_name:'Journal — full-page advertisement',edition:'Illustrative print issue',scans:126,clicks:84,conversions:7,revenue:8400,cost:2200,kind:'print'},
 {qr_id:102,campaign_id:202,opportunity_id:3,qr_name:'Website banner',edition:'Illustrative website campaign',scans:0,clicks:213,conversions:11,revenue:13200,cost:1500,kind:'digital'},
 {qr_id:103,campaign_id:203,opportunity_id:5,qr_name:'Hydration station sponsorship',edition:'Future-cycle event example',scans:92,clicks:61,conversions:5,revenue:6000,cost:4000,kind:'event'}
].map(r=>({...r,cost:opportunities.find(o=>o.id===r.opportunity_id).price,advertiser,advertiser_id:1,status:'Active',campaign_name:'Demo — '+r.qr_name,start_date:'2026-09-15',end_date:'2026-12-31',contract_end:'2026-12-31',renewal_date:'2026-12-01',destination_name:'Illustrative product inquiry',destination_url:'https://example.com/?vivid_demo=osba'}));
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
 return {rows,from,to,brand:'OSBA',marketplace:'osba-demo',detailRoot:'/osba-demo/placement'};
}
function demoBanner(){return `<nav aria-label="Demo portals" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px 20px;padding:10px 24px;background:#f3f6f5;border-bottom:1px solid #dce5df;color:#52645a;font:13px Arial"><span style="font-size:12px">Demo · Sample data</span><a style="color:#17482f" href="/org-organization/osba-demo">Publisher Portal</a><a style="color:#17482f" href="/advertise/osba-demo">Marketplace</a><a style="color:#17482f" href="/my-setup">Advertiser Portal</a></nav>`;}
function demoFooter(){return `<footer style="padding:24px;text-align:center;color:#65776b;font:12px/1.7 Arial;overflow-wrap:anywhere;border-top:1px solid #dce5df">Demonstration with a session-only sample journey. Inventory, availability and performance are illustrative.<br>Published offerings: <a href="${source}" target="_blank" rel="noopener noreferrer">OSBA media page</a> · <a href="${mediaKit}" target="_blank" rel="noopener noreferrer">2026 media kit</a> · <a href="${sponsorshipGuide}" target="_blank" rel="noopener noreferrer">Sponsorship guide</a></footer>`;}
function rewrite(html){return html.replace(/(["'`])(\/(?!\/)[^\s"'`<>]*)\1/g,(all,quote,url)=>quote+PREFIX+url+quote);}
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
function response(body,status=200,type='text/html; charset=utf-8',extra={}){return new Response(body,{status,headers:{...headers,'Content-Type':type,...extra}});}
function validToken(token){return typeof token==='string'&&token.length<100&&crypto.createHash('sha256').update(token).digest('hex')===INVITE_HASH;}
const journey=createJourney({opportunities,banner:demoBanner,footer:demoFooter});
const vividNative=createNativeRuntime({baseRows,opportunities,groups,reporting,banner:demoBanner,footer:demoFooter});
export {vividNative};
export async function handle(request){
 try{const url=new URL(request.url),path=url.pathname,q=Object.fromEntries(url.searchParams);
  if(path==='/health')return response('ok',200,'text/plain');
  if(!['GET','HEAD','POST'].includes(request.method))return response('This demonstration is view-only.',405,'text/plain',{'Allow':'GET, HEAD'});
  if(Date.now()>=EXPIRES)return response('This demo invitation has expired.',410,'text/plain');
  const entry=path.match(/^\/osba-review\/([^/]+)\/(enterprise|marketplace|advertiser)$/);
  if(entry){if(!validToken(entry[1]))return response('Demo link not found.',404,'text/plain');const target=entry[2]==='marketplace'?'/advertise/osba-demo':entry[2]==='advertiser'?'/my-setup':'/enterprise';return response('',302,'text/plain',{'Location':PREFIX+target,'Set-Cookie':`vivid.osba.demo=${SESSION_VALUE}; HttpOnly; SameSite=Lax; ${url.protocol==='https:'?'Secure; ':''}Path=${PREFIX}; Max-Age=28800`});}
  if(!path.startsWith(PREFIX+'/'))return response('A private OSBA demo invitation is required.',404,'text/plain');
  const cookie=request.headers.get('cookie')||'';if(!cookie.split(';').some(c=>c.trim()==='vivid.osba.demo='+SESSION_VALUE))return response('Please reopen your original OSBA demo invitation.',401,'text/plain');
  const rawPath=path.slice(PREFIX.length);
  if(rawPath==='/assets/conference.webp')return response(readFileSync(new URL('./conference.webp',import.meta.url)),200,'image/webp');
  const asset=rawPath.startsWith('/assets/')?imagery[rawPath.slice(8)]:null;
  if(asset)return response(asset.bytes,200,asset.mime);
  const imageMatch=rawPath.match(/^\/org-opportunity\/(\d+)\/photo$/);
  if(imageMatch){const o=opportunities.find(o=>o.id===+imageMatch[1]);if(!o)return response('Image not found',404,'text/plain');const a=opportunityImage(o);return response(a.bytes,200,a.mime);}
  const journeyResult=await journey.handle(request,rawPath);
  if(journeyResult)return response(journeyResult.pdf||rewrite(journeyResult.html||''),journeyResult.status||200,journeyResult.pdf?'application/pdf':'text/html; charset=utf-8',journeyResult.headers||{});
  if(q.organization_id&&q.organization_id!=='osba-demo')return response('Organization unavailable in this demo.',404,'text/plain');
  const aliases={'/enterprise':'/org-organization/osba-demo','/locations':'/org-locations','/inventory':'/org-marketplace','/advertisers':'/org-advertisers','/requests':'/org-advertising-requests','/contracts':'/org-contracts','/renewals':'/org-renewals','/pipeline':'/org-revenue-pipeline','/operations':'/org-operations','/campaign-help':'/help'};
  let nativePath=aliases[rawPath]||rawPath;
  if(rawPath==='/org-business-breakdown'&&q.metric==='available'){nativePath='/org-marketplace';q.status='Available';}
  const legacyPlacement=rawPath.match(/^\/osba-demo\/placement\/(\d+)$/);if(legacyPlacement)nativePath='/admin/view-qr/'+legacyPlacement[1];
  const legacyContract=rawPath.match(/^\/contract\/(\d+)$/);if(legacyContract)nativePath='/org-contract/'+legacyContract[1];
  const program=rawPath.match(/^\/advertise\/osba-demo\/program\/(\d+)$/);if(program){q.program_id=program[1];nativePath='/advertise/osba-demo';}
  const formPreview=request.method==='POST'&&/^\/advertise\/osba-demo\/location\/\d+\/opportunity\/\d+\/review$/.test(rawPath);
  if(request.method==='POST'&&!formPreview)return response('This demonstration is view-only.',405,'text/plain');
  const nativeBody=formPreview?Object.fromEntries(await request.formData()):{};
  const nativeResult=await vividNative.dispatch(nativePath,q,formPreview?'POST':'GET',nativeBody);
  if(nativeResult){
   if(nativeResult.location)return response('',302,'text/plain',{Location:PREFIX+nativeResult.location.replace('organization_id=900001','organization_id=osba-demo')});
   if(nativeResult.bytes)return response(nativeResult.bytes,nativeResult.status,nativeResult.headers['Content-Type']||'application/octet-stream',nativeResult.headers);
   if(nativeResult.headers?.['Content-Type']?.includes('csv'))return response(nativeResult.html,nativeResult.status,nativeResult.headers['Content-Type'],nativeResult.headers);
   return response(rewrite(journey.decorate(nativeResult.html,rawPath,nativeBody)),nativeResult.status);
  }
  const local=rawPath;
  if(local==='/export/report.csv'){const result=await vividNative.dispatch('/export/events.csv',q);return response(result.html,200,'text/csv; charset=utf-8',result.headers);}
  const qr=local.match(/^\/qr\/(\d+)\.png$/);if(qr){if(!baseRows.some(r=>r.qr_id===+qr[1]))return response('QR not found.',404,'text/plain');return response(await QRCode.toBuffer('https://example.com/?vivid_demo=osba&placement='+qr[1],{width:400,margin:3}),200,'image/png',{'Content-Disposition':`attachment; filename="OSBA-SAMPLE-QR-${qr[1]}.png"`});}
  const open=local.match(/^\/r\/(\d+)$/);if(open&&baseRows.some(r=>r.qr_id===+open[1]))return response('',302,'text/plain',{Location:'https://example.com/?vivid_demo=osba'});
  return response('Demo page not found.',404,'text/plain');
 }catch(error){console.error('OSBA DEMO:',error.message);return response(h(error.status?error.message:'Demo temporarily unavailable.'),error.status||500);}
}
if(typeof Bun!=='undefined')Bun.serve({port:Number(Bun.env.PORT||3000),fetch:handle});
else {const {createServer}=await import('node:http');createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=chunks.length?Buffer.concat(chunks):undefined;const result=await handle(new Request((String(req.headers['x-forwarded-proto']||'http').split(',')[0])+"://"+(req.headers.host||'localhost')+req.url,{method:req.method,headers:req.headers,...(body?{body}: {})}));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}).listen(Number(process.env.PORT||3000));}
