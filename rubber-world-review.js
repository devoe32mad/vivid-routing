'use strict';
const crypto = require('crypto');
const {KEY,EMAIL,SLUG}=require('./seed-rubber-world-demo');
const EXPIRES=Date.parse('2026-11-13T05:00:00Z');
const HASH='8345f599f2d2656aa891b559632f392c6f26fab58bcab3ae312cd27a99603b42';
const isDemo=user=>user?.role==='customer'&&user.email===EMAIL;
async function reportScope(q,user){
 if(!isDemo(user))return null;
 const org=(await q('SELECT id FROM organizations WHERE slug=$1 AND customer_id=$2',[SLUG,user.id])).rows[0];
 if(!org)return {locationIds:[],qrIds:[],campaignIds:[]};
 const locations=(await q('SELECT id FROM spaces WHERE organization_id=$1',[org.id])).rows;
 const qrs=(await q('SELECT qr.id FROM qr_codes qr JOIN spaces s ON s.id=qr.space_id WHERE s.organization_id=$1',[org.id])).rows;
 const campaigns=(await q('SELECT id FROM campaigns WHERE organization_id=$1 AND user_id=$2',[org.id,user.id])).rows;
 if(user.rubberWorldAdvertiserId){
  const owned=(await q(`SELECT DISTINCT c.id AS campaign_id,qr.id AS qr_id,s.id AS location_id FROM campaigns c JOIN qr_campaigns qc ON qc.campaign_id=c.id JOIN qr_codes qr ON qr.id=qc.qr_id JOIN spaces s ON s.id=qr.space_id WHERE c.organization_id=$1 AND s.organization_id=$1 AND c.user_id=$2 AND c.advertiser_id=$3`,[org.id,user.id,user.rubberWorldAdvertiserId])).rows;
  return {locationIds:[...new Set(owned.map(x=>Number(x.location_id)))],qrIds:[...new Set(owned.map(x=>Number(x.qr_id)))],campaignIds:[...new Set(owned.map(x=>Number(x.campaign_id)))]};
 }
 return {locationIds:locations.map(x=>Number(x.id)),qrIds:qrs.map(x=>Number(x.id)),campaignIds:campaigns.map(x=>Number(x.id))};
}
function validToken(token){return typeof token==='string'&&token.length<100&&crypto.timingSafeEqual(crypto.createHash('sha256').update(token).digest(),Buffer.from(HASH,'hex'));}
const setupRoutes=new Set(['/admin/new-location','/admin/new-qr','/admin/import-qr','/admin/new-campaign','/admin/assign','/admin/schedule']);
const simple=new Set([...require("./rubber-world-native-navigation").paths,...setupRoutes,...require('./responsibility-routes').paths,...require('./rubber-world-ai-demo').paths,'/org-business-breakdown','/org-help','/help','/org-advertisers','/org-locations','/org-marketplace','/org-contracts','/org-renewals','/org-revenue-pipeline','/org-placement-report','/org-performance','/org-advertising-requests','/org-export','/org-export/renewals.csv','/org-export/renewals.pdf','/my-setup','/reports','/reports-qr','/reports-location','/reports-campaign','/admin/reports','/export/report.pdf','/export/report.xlsx','/export/events.csv','/org-export/report.pdf','/org-export/report.xlsx','/org-operations','/org-users','/org-programs','/org-settings','/org-permissions','/campaign-help','/org-campaign-builder-requests','/org-campaign-help-example']);
function routeAllowed(path,org){return /^\/admin\/advertiser-customer\/\d+\/users$/.test(path)|| /^\/rubber-world-demo\/placement\/\d+$/.test(path)||/^\/admin\/edit-(?:qr|campaign)\/\d+$/.test(path)||simple.has(path)||path===`/org-organization/${org}`||/^\/org-revenue-pipeline\/location\/\d+(?:\/revenue)?$/.test(path)||/^\/org-(?:location|campaign|contract|advertising-request|advertiser)\/\d+$/.test(path)||/^\/admin\/view-(?:qr|campaign|location)\/\d+$/.test(path)||/^\/admin\/campaign\/\d+\/website-pages$/.test(path)||/^\/qr\/\d+\.png$/.test(path)||/^\/org-opportunity\/\d+\/photo$/.test(path)||/^\/advertise\/rubber-world-demo(?:\/(?:program|location)\/\d+(?:\/opportunity\/\d+)?)?$/.test(path);}
function copy(text){return text.replace(/Add a physical placement location such as:\s*school,\s*store,\s*marina,\s*event,\s*or parking area\./g,"Add a print issue, digital edition, or website advertising collection.").replace(/\bActual Events?\b/g,'Issues / Editions').replace(/\bEvent Types?\b/g,'Channels').replace(/\bevent types?\b/g,'channels').replace(/\bLocations\b/g,'Issues / Editions').replace(/\bLocation\b/g,'Issue / Edition').replace(/\blocations\b/g,'issues / editions').replace(/\blocation\b/g,'issue / edition').replace(/\bEvents\b/g,'Issues / Editions').replace(/\bEvent\b/g,'Issue / Edition').replace(/\bevents\b/g,'issues / editions').replace(/\bevent\b/g,'issue / edition').replace(/\bSponsorship\b/g,'Advertising').replace(/\bsponsorship\b/g,'advertising').replace(/\bSponsors\b/g,'Advertisers').replace(/\bSponsor\b/g,'Advertiser').replace(/\bsponsors\b/g,'advertisers').replace(/\bsponsor\b/g,'advertiser').replace(/\bPrograms\b/g,'Channels').replace(/\bProgram\b/g,'Channel').replace(/\bprograms\b/g,'channels').replace(/\bprogram\b/g,'channel').replace(/rubber-world-demo@example\.invalid/g,'Rubber World Demo').replace(/Create a Issue \/ Edition/g,'Create an Issue / Edition');}
function presentation(html){
 // Change visible prose only: preserve URLs, form names, scripts and styles.
 return html.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]+>)/gi).map(part=>part.startsWith('<')?part:copy(part)).join('');
}
function overviewSummary(html){
 return html.replace(/<section\b[^>]*>[\s\S]*?<\/section>/gi,section=>{
  if(!section.includes('Ask Vivid: What needs attention?'))return section;
  const summary=section.indexOf('<div style="margin-top:18px;padding:18px;');
  const actions=section.indexOf('<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));');
  const disclaimer=section.indexOf('<div style="margin-top:16px;color:#65776b;');
  if(summary<0||actions<summary||disclaimer<actions)return section;
  const opening=section.slice(0,section.indexOf('>')+1);
  return opening+section.slice(summary,actions).replace('margin-top:18px;padding:18px;','margin-top:0;padding:18px;')+section.slice(disclaimer);
 });
}
function register(app,{q}){
 app.get('/rubber-world-review/:token/:view',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  if(!validToken(req.params.token))return res.status(404).send('Demo link not found.');
  if(Date.now()>=EXPIRES)return res.status(410).send('This demonstration link has expired.');
  if(!['enterprise','marketplace','advertiser'].includes(req.params.view))return res.status(404).send('Demo view not found.');
  try{
   const found=(await q(`SELECT o.id,o.customer_id FROM organizations o JOIN vivid_evaluation_fixtures f ON f.organization_id=o.id JOIN users u ON u.id=o.customer_id WHERE f.fixture_key=$1 AND o.slug=$2 AND u.email=$3`,[KEY,SLUG,EMAIL])).rows;
   if(found.length!==1)throw Error('Rubber World demo identity unavailable');
   const org=found[0];
   await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
   req.session.rubberWorldReview={org:Number(org.id),owner:Number(org.customer_id),expires:EXPIRES,version:HASH};req.session.cookie.maxAge=Math.min(8*3600000,EXPIRES-Date.now());
   await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
   res.redirect(req.params.view==='enterprise'?`/org-organization/${org.id}?organization_id=${org.id}&from=2026-09-14&to=2026-10-13`:req.params.view==='marketplace'?'/advertise/rubber-world-demo':'/my-setup');
  }catch(e){console.error('RUBBER WORLD REVIEW:',e.message);res.status(503).send('Rubber World demo is not available yet.');}
 });
 app.use(async(req,res,next)=>{
  const review=req.session?.rubberWorldReview;if(!review)return next();
  if(/^\/(?:hfhs|ccps)-review\//.test(req.path))return next();
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(review.version!==HASH||review.expires!==EXPIRES||Date.now()>=EXPIRES)return req.session.destroy(()=>res.status(410).send('This demo has expired.'));
  if(req.path==='/logout')return req.session.destroy(()=>res.redirect('/login'));
  const org=review.org,home=`/org-organization/${org}?organization_id=${org}&from=2026-09-14&to=2026-10-13`;
  const nav=`<a href="${home}">Enterprise</a> · <a href="/advertise/rubber-world-demo">Marketplace</a> · <a href="/my-setup">Advertiser portal</a>`;
  const deny=()=>res.status(403).send(`<h2>Rubber World demo</h2><p>This view-only demonstration contains illustrative magazine advertising data.</p>${nav}`);
  if(!['GET','HEAD'].includes(req.method)&&!(req.method==='POST'&&req.path==='/org-responsibility/save'))return deny();
  if(req.path==='/dashboard')return res.redirect('/my-setup');
  if(req.path==='/org-dashboard')return res.redirect(home);
  if(!routeAllowed(req.path,org))return deny();
  if(setupRoutes.has(req.path))delete req.query.marketplace_request_id;
  const managedCustomer=req.path.match(/^\/admin\/advertiser-customer\/(\d+)\/users$/);
  if(managedCustomer&&Number(managedCustomer[1])!==review.owner)return deny();
  try{
   const user={id:review.owner,login_user_id:review.owner,customer_id:review.owner,role:'customer',name:'Rubber World Demo Reviewer',email:EMAIL};
   const advertiserSurface=require("./rubber-world-native-navigation").paths.includes(req.path)||setupRoutes.has(req.path)||/^\/admin\/advertiser-customer\//.test(req.path)||req.path==='/my-setup'||req.path.startsWith('/rubber-world-demo/placement/')||/^\/(?:reports(?:-|$)|admin\/(?:reports|view-|edit-|campaign\/)|export\/|qr\/|campaign-help)/.test(req.path);
   if(advertiserSurface){
    const advertisers=(await q('SELECT DISTINCT advertiser_id,advertiser FROM campaigns WHERE organization_id=$1 AND user_id=$2 AND advertiser_id IS NOT NULL ORDER BY advertiser,advertiser_id',[org,review.owner])).rows;
    const selected=Number(req.query.advertiser_id||review.advertiserId||advertisers[0]?.advertiser_id);
    if(!advertisers.some(a=>Number(a.advertiser_id)===selected))return deny();
    review.advertiserId=selected;user.rubberWorldAdvertiserId=selected;
    if(req.path==='/my-setup'||req.path.startsWith('/rubber-world-demo/placement/'))req.query.advertiser_id=String(selected);
   }
   const scope=await reportScope(q,user);
   if(!scope?.locationIds.length)return deny();
   for(const key of ['organization_id','organizationId','org_id','orgId'])if(req.query[key]&&String(req.query[key])!==String(org))return deny();
   for(const key of ['user_id','userId','customer_id','customerId','owner_id','ownerId','account_id','accountId','account'])if(req.query[key])return deny();
   for(const [keys,ids]of [[['location_id','locationId','space_id','spaceId'],scope.locationIds],[['campaign_id','campaignId','campaign'],scope.campaignIds],[['qr_id','qrId','qr','placement_id','placementId'],scope.qrIds]])for(const key of keys)if(req.query[key]&&!['all','All'].includes(req.query[key])&&!ids.includes(Number(req.query[key])))return deny();
   const checks=[[/^\/rubber-world-demo\/placement\/(\d+)$/,scope.qrIds],[/^\/admin\/edit-qr\/(\d+)$/,scope.qrIds],[/^\/admin\/edit-campaign\/(\d+)$/,scope.campaignIds],[/^\/org-revenue-pipeline\/location\/(\d+)/,scope.locationIds],[/^\/org-location\/(\d+)$/,scope.locationIds],[/^\/admin\/view-location\/(\d+)$/,scope.locationIds],[/^\/org-campaign\/(\d+)$/,scope.campaignIds],[/^\/admin\/view-campaign\/(\d+)$/,scope.campaignIds],[/^\/admin\/campaign\/(\d+)\/website-pages$/,scope.campaignIds],[/^\/admin\/view-qr\/(\d+)$/,scope.qrIds],[/^\/qr\/(\d+)\.png$/,scope.qrIds],[/^\/advertise\/rubber-world-demo\/location\/(\d+)/,scope.locationIds]];
   for(const [regex,ids]of checks){const match=req.path.match(regex);if(match&&!ids.includes(Number(match[1])))return deny();}
   const refs=[['program_id','organization_programs'],['opportunity_id','organization_opportunities'],['advertiser_id','advertisers'],['contract_id','contracts'],['request_id','organization_advertising_requests'],['marketplace_request_id','organization_advertising_requests']];
   for(const [key,table]of refs)if(req.query[key]&&!(await q(`SELECT id FROM ${table} WHERE id=$1 AND organization_id=$2`,[Number(req.query[key]),org])).rows.length)return deny();
   const pathRefs=[[/^\/org-contract\/(\d+)$/,'contracts'],[/^\/org-advertising-request\/(\d+)$/,'organization_advertising_requests'],[/^\/org-advertiser\/(\d+)$/,'advertisers'],[/^\/org-opportunity\/(\d+)\/photo$/,'organization_opportunities'],[/^\/advertise\/rubber-world-demo\/program\/(\d+)$/,'organization_programs'],[/\/opportunity\/(\d+)$/,'organization_opportunities']];
   for(const [regex,table]of pathRefs){const match=req.path.match(regex);if(match&&!(await q(`SELECT id FROM ${table} WHERE id=$1 AND organization_id=$2`,[Number(match[1]),org])).rows.length)return deny();}
   req.session.user=user;req.session.orgUser={id:review.owner,organization_id:org,organization_name:'Rubber World Magazine Demo',organization_role:'organization_admin',name:user.name,email:EMAIL};delete req.session.platformUser;req.rubberWorldReviewVerified=true;
   await require('./responsibility-routes').attach(req,res,q);
   const send=res.send;res.send=function(body){if(typeof body==='string'&&/<(?:html|body|main|div)\b/i.test(body)){
    if(req.path===`/org-organization/${org}`)body=overviewSummary(body);
    body=require('./rubber-world-ai-demo').navigation(body);
    body=body.replace(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi,(whole,attrs,options)=>{
     const name=attrs.match(/name=["']([^"']+)["']/i)?.[1];
     const ids=['space_id','location_id'].includes(name)?scope.locationIds:['qr_id','qr_ids'].includes(name)?scope.qrIds:['campaign_id','campaign'].includes(name)?scope.campaignIds:name==='advertiser_id'&&user.rubberWorldAdvertiserId?[user.rubberWorldAdvertiserId]:null;
     if(!ids)return whole;
     return '<select'+attrs+'>'+options.replace(/<option\b[^>]*value=["']([^"']*)["'][^>]*>[\s\S]*?<\/option>/gi,(option,id)=>!id||ids.includes(Number(id))?option:'')+'</select>';
    });
    body=(req.path.startsWith('/advertise/rubber-world-demo')?body:presentation(body)).replace(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi,(form,attrs,inside)=>/method=["']?post/i.test(attrs)&&! /action=["']\/org-responsibility\/save(?:\?|["'])/i.test(attrs)?'<form'+attrs+' onsubmit="return false">'+inside.replace(/<button\b([^>]*)>/gi,(tag,a)=>/type=["\']button["\']/i.test(a)?tag:'<button'+a+' disabled title="Saving is disabled in this demo">')+'<p>Explore these settings. Saving is disabled in this shared demonstration.</p></form>':form);
    body=body.replace(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi,(link,before,href,after,label)=>{
     if(!href.startsWith('/'))return link;
     const path=href.split(/[?#]/)[0];
     if(/^\/admin\/(?:ai-|weekly-ai-report)/.test(path))return ''; 
     if(routeAllowed(path,org)||['/logout','/dashboard','/org-dashboard'].includes(path))return link;
     return '<span title="View-only demo" style="color:#87949e">'+label+'</span>';
    });
    const banner=`<div style="padding:14px 24px;background:#edf3f9;color:#23374d;font:14px system-ui"><strong>Rubber World Magazine · Vivid demonstration</strong> · View-only except responsibility assignments · Sample rates and simulated activity<br>${nav}</div>`;
    body=/<body[^>]*>/i.test(body)?body.replace(/<body[^>]*>/i,m=>m+banner):banner+body;
   }return send.call(this,body);};
   if(/^\/rubber-world-demo\/placement\/\d+$/.test(req.path)){
    const portal=require('./rubber-world-advertiser-portal');
    try{return res.send(portal.render(await portal.load(q,org,req.query),req.query,req.path.match(/placement\/(\d+)$/)?.[1]));}catch(e){if(e.status)return res.status(e.status).send(e.message);throw e;}
   }
   const ai=require('./rubber-world-ai-demo');if(ai.paths.includes(req.path))return res.send(ai.render(req.path,org,await ai.load(q,org)));
   const proceed=()=>require('./ai-preview-access').aiPreviewMiddleware(req,res,next);
   if(require('./rubber-world-native-navigation').paths.includes(req.path))return require('./rubber-world-native-navigation').run(scope,proceed);
   return proceed();
  }catch(e){console.error('RUBBER WORLD REVIEW GUARD:',e.message);res.status(503).send('Demo review is temporarily unavailable.');}
 });
}
module.exports={register,isDemo,reportScope,validToken,routeAllowed,presentation,EXPIRES};
