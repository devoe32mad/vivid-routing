import {createNativeRuntime} from './native-runtime.js';
import crypto from 'node:crypto';
import QRCode from 'qrcode';

// Standalone PAC World demonstration. No production imports, database, or credentials.
const INVITE_HASH = 'f5f541392a0f8471f7777ab9da05f6276133b69a8316801c56bc43eff1bf341d';
const PREFIX = '/demo/pac-world';
const SESSION_VALUE = crypto.randomBytes(32).toString('hex');
const EXPIRES = Date.parse('2027-01-14T23:59:59Z');
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const number=v=>Number(v||0).toLocaleString('en-US');
const date=v=>v?new Date(v).toISOString().slice(0,10):'Not set';
import {groups,opportunities,baseRows} from './catalogue.js';
import fs from 'node:fs';
const source='https://www.pacw.org/advertising';
const sampleContractRevenue=baseRows.reduce((sum,r)=>sum+r.cost,0);
function reporting(q){
 const from=q.start_date||q.startDate||q.from||'2026-09-15',to=q.end_date||q.endDate||q.to||'2026-10-14';
 for(const value of [from,to])if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||date(value)!==value)throw Object.assign(Error('Choose valid reporting dates.'),{status:400});
 if(from>to)throw Object.assign(Error('Start date must be before the end date.'),{status:400});
 if(q.advertiser_id&&!baseRows.some(r=>String(r.advertiser_id)===q.advertiser_id))throw Object.assign(Error('Advertiser unavailable in this demo.'),{status:404});
 let rows=baseRows.map(r=>({...r,scans:0,clicks:0,conversions:0,revenue:0}));
 // Daily, deterministic sample activity; date filters work without storing events.
 for(let d=Date.parse('2026-09-15');d<=Date.parse('2026-10-14');d+=86400000){const day=date(d);if(day<from||day>to)continue;const idx=(d-Date.parse('2026-09-15'))/86400000;
  rows.forEach((r,i)=>{for(const k of ['scans','clicks','conversions','revenue'])r[k]+=Math.floor(baseRows[i][k]*(idx+1)/30)-Math.floor(baseRows[i][k]*idx/30);});}
 if(q.location_id){const ids=opportunities.filter(o=>String(o.space_id)===q.location_id).map(o=>o.id);if(!ids.length)throw Object.assign(Error('Location unavailable in this demo.'),{status:404});rows=rows.filter(r=>ids.includes(r.opportunity_id));}
 for(const [key,field]of [['qr_id','qr_id'],['campaign_id','campaign_id']])if(q[key]){rows=rows.filter(r=>String(r[field])===q[key]);if(!rows.length)throw Object.assign(Error('Placement unavailable in this demo.'),{status:404});}
 if(q.advertiser_id)rows=rows.filter(r=>String(r.advertiser_id)===q.advertiser_id);
 return {rows,from,to,brand:'PAC World',marketplace:'pac-world-demo',detailRoot:'/pac-world-demo/placement'};
}
function demoBanner(){return `<div class="pac-world-demo-bar"><strong>PAC World · Sample data</strong><nav><a href="/org-organization/pac-world-demo">Publisher Portal</a> · <a href="/advertise/pac-world-demo">Marketplace</a> · <a href="/my-setup">Advertiser Portal</a></nav><details><summary>About this private demonstration</summary><p>Published 2026 products and rates; fictional advertisers, availability, assignments and results. Requests, contracts, fulfillment, rep assignments and destinations are saved in this isolated demo. No live database, emails, payments or binding agreements. Dates before today are historical examples; 2027 rates and schedules require confirmation.</p><a href="https://www.pacw.org/advertising" target="_blank" rel="noopener">Official advertising page</a></details></div>`;}

function rewrite(html){return html.replace(/(["'`])(\/(?!\/)[^\s"'`<>]*)\1/g,(all,quote,url)=>quote+PREFIX+url+quote);}
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
function response(body,status=200,type='text/html; charset=utf-8',extra={}){return new Response(body,{status,headers:{...headers,'Content-Type':type,...extra}});}
function validToken(token){return typeof token==='string'&&token.length<100&&crypto.createHash('sha256').update(token).digest('hex')===INVITE_HASH;}
const vividNative=createNativeRuntime({baseRows,opportunities,groups,reporting,banner:demoBanner});
export {vividNative};
export async function handle(request){
 try{const url=new URL(request.url),path=url.pathname,q=Object.fromEntries(url.searchParams);
  if(path==='/health'){await vividNative.ready;return response('ok',200,'text/plain');}
  if(!['GET','HEAD','POST'].includes(request.method))return response('This demonstration is view-only.',405,'text/plain',{'Allow':'GET, HEAD'});
  if(Date.now()>=EXPIRES)return response('This demo invitation has expired.',410,'text/plain');
  const entry=path.match(/^\/pac-world-review\/([^/]+)\/(enterprise|marketplace|advertiser)$/);
  if(entry){if(!validToken(entry[1]))return response('Demo link not found.',404,'text/plain');const target=entry[2]==='marketplace'?'/advertise/pac-world-demo':entry[2]==='advertiser'?'/my-setup':'/enterprise';return response('',302,'text/plain',{'Location':PREFIX+target,'Set-Cookie':`vivid.pac-world.demo=${SESSION_VALUE}; HttpOnly; SameSite=Lax; ${url.protocol==='https:'?'Secure; ':''}Path=${PREFIX}; Max-Age=28800`});}
  if(!path.startsWith(PREFIX+'/'))return response('A private PAC World demo invitation is required.',404,'text/plain');
  const cookie=request.headers.get('cookie')||'';if(!cookie.split(';').some(c=>c.trim()==='vivid.pac-world.demo='+SESSION_VALUE))return response('Please reopen your original PAC World demo invitation.',401,'text/plain');
  const rawPath=path.slice(PREFIX.length);
  if(/^\/assets\/[a-z0-9-]+\.(png|jpg)$/.test(rawPath)){const file=new URL('.'+rawPath,import.meta.url);if(fs.existsSync(file))return response(fs.readFileSync(file),200,rawPath.endsWith('.jpg')?'image/jpeg':'image/png');}

  if(q.organization_id&&q.organization_id!=='pac-world-demo')return response('Organization unavailable in this demo.',404,'text/plain');
  const aliases={'/enterprise':'/org-organization/pac-world-demo','/locations':'/org-locations','/inventory':'/org-marketplace','/advertisers':'/org-advertisers','/requests':'/org-advertising-requests','/contracts':'/org-contracts','/renewals':'/org-renewals','/pipeline':'/org-revenue-pipeline','/operations':'/org-operations','/campaign-help':'/help'};
  let nativePath=aliases[rawPath]||rawPath;
  if(rawPath==='/org-business-breakdown'&&q.metric==='available'){nativePath='/org-marketplace';q.status='Available';}
  const legacyPlacement=rawPath.match(/^\/pac-world-demo\/placement\/(\d+)$/);if(legacyPlacement)nativePath='/admin/view-qr/'+legacyPlacement[1];
  const legacyContract=rawPath.match(/^\/contract\/(\d+)$/);if(legacyContract)nativePath='/org-contract/'+legacyContract[1];
  const program=rawPath.match(/^\/advertise\/pac-world-demo\/program\/(\d+)$/);if(program){q.program_id=program[1];nativePath='/advertise/pac-world-demo';}
  const formPreview=request.method==='POST'&&/^\/advertise\/pac-world-demo\/location\/\d+\/opportunity\/\d+\/review$/.test(rawPath);
  if(request.method==='POST'&&!formPreview&&!vividNative.writable(rawPath))return response('This demonstration is view-only.',405,'text/plain');
  if(request.method==='POST'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return response('Invalid request origin.',403,'text/plain');
  const nativeBody=request.method==='POST'?Object.fromEntries(await request.formData()):{};
  const nativeResult=await vividNative.dispatch(nativePath,q,request.method==='POST'?'POST':'GET',nativeBody);
  if(nativeResult){
   if(nativeResult.location)return response('',302,'text/plain',{Location:PREFIX+nativeResult.location.replace('organization_id=900001','organization_id=pac-world-demo')});
   if(nativeResult.bytes)return response(nativeResult.bytes,nativeResult.status,nativeResult.headers['Content-Type']||'application/octet-stream',nativeResult.headers);
   if(nativeResult.headers?.['Content-Type']?.includes('csv'))return response(nativeResult.html,nativeResult.status,nativeResult.headers['Content-Type'],nativeResult.headers);
   return response(rewrite(nativeResult.html),nativeResult.status);
  }
  const local=rawPath;
  if(local==='/export/report.csv'){const result=await vividNative.dispatch('/export/events.csv',q);return response(result.html,200,'text/csv; charset=utf-8',result.headers);}
  const qr=local.match(/^\/qr\/(\d+)\.png$/);if(qr){if(!baseRows.some(r=>r.qr_id===+qr[1]))return response('QR not found.',404,'text/plain');return response(await QRCode.toBuffer(url.origin+PREFIX+'/r/'+qr[1],{width:400,margin:3}),200,'image/png',{'Content-Disposition':`attachment; filename="PAC World-SAMPLE-QR-${qr[1]}.png"`});}
  const open=local.match(/^\/r\/(\d+)$/);if(open&&baseRows.some(r=>r.qr_id===+open[1]))return response('',302,'text/plain',{Location:baseRows.find(r=>r.qr_id===+open[1]).destination_url});
  return response('Demo page not found.',404,'text/plain');
 }catch(error){console.error('PAC WORLD DEMO:',error.message);return response(h(error.status?error.message:'Demo temporarily unavailable.'),error.status||500);}
}
if(typeof Bun!=='undefined')Bun.serve({port:Number(Bun.env.PORT||3000),fetch:handle});
else {const {createServer}=await import('node:http');createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=chunks.length?Buffer.concat(chunks):undefined;const result=await handle(new Request((String(req.headers['x-forwarded-proto']||'http').split(',')[0])+"://"+(req.headers.host||'localhost')+req.url,{method:req.method,headers:req.headers,...(body?{body}: {})}));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}).listen(Number(process.env.PORT||3000));}
