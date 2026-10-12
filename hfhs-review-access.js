"use strict";
const crypto=require('crypto');
const TOKEN_HASH='599ff0e96fd65b0a385cc18895fb24a88c407030d79abc1886beac58a61f2fdc';
const EXPIRES=Date.parse('2026-10-27T04:00:00Z'); // End of October 26, America/New_York.
const ORG=39;
const DEFAULT_DATES='from=2026-09-13&to=2026-10-12';
const homes={enterprise:'/org-organization/39?organization_id=39&'+DEFAULT_DATES,advertiser:'/my-setup',marketplace:'/advertise/henry-ford-health-demo'};
const simple=new Set(['/org-advertisers','/org-locations','/org-marketplace','/org-contracts','/org-renewals','/org-revenue-pipeline','/org-placement-report','/org-performance','/org-advertising-requests','/org-export','/org-export/renewals.csv','/org-export/renewals.pdf','/my-setup','/reports','/reports-qr','/reports-location','/reports-campaign','/admin/reports','/export/report.pdf','/export/report.xlsx','/export/events.csv','/org-export/report.pdf','/org-export/report.xlsx','/admin/marketing-command-center','/campaign-help']);
function routeAllowed(path){return simple.has(path)||path==='/org-organization/39'||/^\/advertise\/henry-ford-health-demo(?:\/(?:program|location)\/\d+(?:\/opportunity\/\d+)?)?$/.test(path)||/^\/org-(?:location|campaign|contract|advertising-request)\/\d+$/.test(path)||/^\/org-advertiser\/[^/]+$/.test(path)||/^\/admin\/view-campaign\/\d+$/.test(path);}
function validToken(value){if(typeof value!=='string'||value.length>100)return false;return crypto.timingSafeEqual(crypto.createHash('sha256').update(value).digest(),Buffer.from(TOKEN_HASH,'hex'));}
function install(source){
 const marker='// HFHS_READ_ONLY_REVIEW_V1';if(source.includes(marker))return source;
 const anchor='const disabledPublicMaintenanceRoutes =';if(source.split(anchor).length!==2)throw Error('Review middleware anchor missing');
 source=source.replace(anchor,marker+'\nrequire("./hfhs-review-access").register(app,{q});\n'+anchor);
 const scope='  let organizationId = null;';const at=source.indexOf('async function getOrganizationScope('),pos=source.indexOf(scope,at);if(at<0||pos<0)throw Error('Review scope anchor missing');
 source=source.slice(0,pos)+'  if(req.hfhsReviewVerified)return require("./hfhs-review-access").scope(req,explicitOrganizationId,q,getOrgDateFilter);\n'+source.slice(pos);
 const guard='function requireOrganizationPermission(permissionKey) {\n  return async (req, res, next) => {\n    try {';
 if(source.split(guard).length!==2)throw Error('Review permission anchor missing');
 source=source.replace(guard,guard+'\n      if(req.hfhsReviewVerified)return next(); // Only read-only allowlisted routes reach this point.');
 return source;
}
async function scope(req,explicit,q,getDates){
 if(explicit!=null&&Number(explicit)!==ORG)throw Error('Demo organization mismatch');
 const locations=(await q('SELECT id FROM spaces WHERE organization_id=$1 AND COALESCE(is_archived,false)=false',[ORG])).rows.map(r=>Number(r.id));
 const selected=req.query.location_id?Number(req.query.location_id):null;if(selected&&!locations.includes(selected))throw Error('Demo location mismatch');
 const dates=getDates(req);if(dates.error)throw Error(dates.error);
 const qs=new URLSearchParams({organization_id:String(ORG)});if(selected)qs.set('location_id',String(selected));if(dates.fromDate)qs.set('from',dates.fromDate);if(dates.toDate)qs.set('to',dates.toDate);
 return {organizationId:ORG,organizationRole:'read_only',isSuperAdmin:false,hasOrganizationWideAccess:true,allowedLocationIds:locations,selectedLocationId:selected,fromDate:dates.fromDate,toDate:dates.toDate,canEdit:false,queryString:qs.toString()};
}
function register(app,{q}){
 app.get('/hfhs-review/:token/:view',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  if(Date.now()>=EXPIRES)return res.status(410).send('This HFHS review link expired on October 26, 2026.');
  if(!validToken(req.params.token)||!homes[req.params.view])return res.status(404).send('Review link not found.');
  try{
   const owner=(await q("SELECT o.customer_id,u.email FROM organizations o JOIN users u ON u.id=o.customer_id WHERE o.id=$1 AND o.slug='henry-ford-health-demo' AND LOWER(u.email)='michaelandrewdevoe@gmail.com'",[ORG])).rows[0];
   if(!owner)throw Error('Demo identity unavailable');
   await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
   req.session.hfhsReview={expires:EXPIRES,ownerId:Number(owner.customer_id),version:TOKEN_HASH};
   req.session.cookie.maxAge=Math.min(8*3600000,EXPIRES-Date.now());
   await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
   res.redirect(homes[req.params.view]);
  }catch(e){console.error('HFHS REVIEW ENTRY ERROR:',e.message);res.status(503).send('Demo access is temporarily unavailable.');}
 });
 app.use(async(req,res,next)=>{
  const review=req.session?.hfhsReview;if(!review)return next();
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(review.version!==TOKEN_HASH||review.expires!==EXPIRES||Date.now()>=EXPIRES){return req.session.destroy(()=>res.status(410).send('This HFHS review has expired.'));}
  if(req.path==='/logout'||req.path==='/hfhs-review-exit')return req.session.destroy(()=>res.redirect(homes.marketplace));
  const notice=()=>res.status(403).send('<h2>HFHS read-only demo</h2><p>You can explore pages, filters and reports. Editing, sending messages and account settings are unavailable in this review.</p><p><a href="'+homes.enterprise+'">Enterprise</a> · <a href="'+homes.marketplace+'">Marketplace</a> · <a href="'+homes.advertiser+'">Advertiser reports</a></p>');
  if(req.method!=='GET'&&req.method!=='HEAD')return notice();
  if(!routeAllowed(req.path))return notice();
  try{
   for(const key of ['organization_id','org_id'])if(req.query[key]&&String(req.query[key])!==String(ORG))return notice();
   for(const key of ['user_id','customer_id','owner_id','account_id'])if(req.query[key])return notice();
   const user={id:review.ownerId,login_user_id:review.ownerId,customer_id:review.ownerId,role:'customer',name:'HFHS Demo Reviewer',email:'michaelandrewdevoe@gmail.com'};
   const allowed=await require('./hfhs-demo-setup-scope').reportScope(q,user);
   if(!allowed)return notice();
   const locations=(await q('SELECT id FROM spaces WHERE organization_id=$1 AND COALESCE(is_archived,false)=false',[ORG])).rows.map(r=>Number(r.id));
   for(const [keys,ids]of [[['location_id','space_id'],locations],[['campaign_id','campaign'],allowed.campaignIds],[['qr_id','qr','placement_id'],allowed.qrIds]])for(const key of keys){const v=req.query[key];if(v&&v!=='all'&&v!=='All'&&!ids.includes(Number(v)))return notice();}
   let match=req.path.match(/^\/org-(location|campaign|contract|advertising-request)\/(\d+)$/);
   if(match){const kind=match[1],id=Number(match[2]);if(kind==='location'&&!locations.includes(id))return notice();if(kind==='campaign'&&!allowed.campaignIds.includes(id))return notice();if(kind==='contract'||kind==='advertising-request'){const table=kind==='contract'?'contracts':'organization_advertising_requests';if(!(await q('SELECT id FROM '+table+' WHERE id=$1 AND organization_id=$2',[id,ORG])).rows.length)return notice();}}
   match=req.path.match(/^\/admin\/view-campaign\/(\d+)$/);if(match&&!allowed.campaignIds.includes(Number(match[1])))return notice();
   req.session.user=user;req.session.orgUser={id:review.ownerId,organization_id:ORG,organization_name:'Henry Ford Health Demo',organization_role:'read_only',name:'HFHS Demo Reviewer',email:user.email};
   delete req.session.platformUser;
   req.hfhsReviewVerified=true;
   const send=res.send;res.send=function(body){if(typeof body==='string'&&/<(?:html|body|main|div)\b/i.test(body)){
    const banner='<div style="padding:12px 20px;background:#edf3f9;color:#23374d;font:14px system-ui"><strong>HFHS interactive review · Read only</strong> · Illustrative demo data · Expires October 26, 2026 (Eastern)<br><a href="'+homes.enterprise+'">Enterprise</a> · <a href="'+homes.marketplace+'">Marketplace</a> · <a href="'+homes.advertiser+'">Advertiser portal</a> · <a href="/admin/marketing-command-center">Marketing Command Center</a></div>';
    body=body.replace(/michaelandrewdevoe@gmail\.com/gi,'HFHS Demo Reviewer');
    body=/<body[^>]*>/i.test(body)?body.replace(/<body[^>]*>/i,m=>m+banner):banner+body;
   }return send.call(this,body);};
   next();
  }catch(e){console.error('HFHS REVIEW GUARD ERROR:',e.message);res.status(503).send('Demo review is temporarily unavailable.');}
 });
}
module.exports={install,register,scope,validToken,routeAllowed,EXPIRES};
