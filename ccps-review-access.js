"use strict";
const crypto=require('crypto');
const TOKEN_HASH='188e0f0bd318471590748aac75127204755b0edad9dfa806cba2757335c751be';
const EXPIRES=Date.parse('2026-10-28T04:00:00Z'); // End of October 27, America/New_York.
const ORG=13;
const DEFAULT_DATES='from=2026-09-14&to=2026-10-13';
const homes={enterprise:'/org-organization/13?organization_id=13&'+DEFAULT_DATES,advertiser:'/my-setup',marketplace:'/advertise/ccps'};
const simple=new Set(['/admin/archived-campaigns',...require('./responsibility-routes').paths,'/org-business-breakdown','/org-help','/help','/admin/conversion-tracking','/org-advertisers','/org-locations','/org-marketplace','/org-contracts','/org-renewals','/org-revenue-pipeline','/org-placement-report','/org-performance','/org-advertising-requests','/org-export','/org-export/renewals.csv','/org-export/renewals.pdf','/my-setup','/reports','/reports-qr','/reports-location','/reports-campaign','/admin/reports','/export/report.pdf','/export/report.xlsx','/export/events.csv','/org-export/report.pdf','/org-export/report.xlsx','/export/website-pages.csv','/export/website-pages.pdf','/admin/marketing-command-center','/campaign-help','/org-campaign-builder-requests','/org-campaign-help-example','/org-location/new','/org-opportunity/new']);
function readOnlyAdmin(path){return ['/org-operations','/org-users','/org-users/new','/org-bulk-import','/org-import-locations-assets','/org-locations-assets-template','/org-programs','/org-settings','/org-permissions'].includes(path)||/^\/org-user\/\d+\/edit$/.test(path)||/^\/org-programs\/\d+\/settings$/.test(path);}
function editableRoute(path){return /^\/admin\/edit-location\/\d+$/.test(path)|| ['/admin/new-qr','/admin/new-campaign','/admin/assign','/admin/schedule','/org-programs'].includes(path)||/^\/admin\/edit-qr\/\d+$/.test(path)||/^\/org-programs\/\d+\/settings$/.test(path)|| /^\/admin\/edit-campaign\/\d+$/.test(path)||/^\/(?:org-)?campaign-help(?:\/\d+)?$/.test(path)||/^\/org-opportunity\/(?:new|edit\/\d+)$/.test(path)||path==='/org-location/new'||/^\/org-contract\/\d+\/(?:fulfillment|renew|renewal-review|renewal-approve|activate|activity)$/.test(path);}
const setupRoutes=new Set(['/admin/new-qr','/admin/new-campaign','/admin/assign','/admin/schedule']);
function routeAllowed(path){if(/^\/demo-advertiser\/placement\/\d+$/.test(path))return true;if(setupRoutes.has(path))return true;return /^\/org-opportunity\/\d+\/photo$/.test(path)||path==='/advertise/ccps/build-my-campaign'||/^\/admin\/view-schedule\/\d+$/.test(path)|| /^\/org-revenue-pipeline\/location\/\d+(?:\/revenue)?$/.test(path)|| readOnlyAdmin(path)|| /^\/admin\/view-(?:qr|location)\/\d+$/.test(path)||/^\/admin\/campaign\/\d+\/website-pages$/.test(path)||/^\/r\/\d+$/.test(path)|| /^\/admin\/(?:archive|restore)-(?:campaign|qr)\/\d+$/.test(path)|| path==='/admin/qr-setup-choice'||/^\/qr\/\d+\.png$/.test(path)|| editableRoute(path)|| simple.has(path)||path==='/org-organization/13'||/^\/advertise\/ccps(?:\/(?:program|location)\/\d+(?:\/opportunity\/\d+)?)?$/.test(path)||/^\/org-(?:location|campaign|contract|advertising-request)\/\d+$/.test(path)||/^\/org-advertiser\/[^/]+$/.test(path)||/^\/admin\/view-campaign\/\d+$/.test(path);}
function validToken(value){if(typeof value!=='string'||value.length>100)return false;return crypto.timingSafeEqual(crypto.createHash('sha256').update(value).digest(),Buffer.from(TOKEN_HASH,'hex'));}
function install(source){
 source=require("./ccps-demo-data-scope").install(source);
 const archiveMarker='// CCPS_NATIVE_ARCHIVE_SCOPE_V1';
 if(!source.includes(archiveMarker)){
  const start=source.indexOf('app.get("/admin/archived-campaigns",'),end=source.indexOf('\napp.',start+1);
  if(start<0||end<0)throw Error('CCPS archive route missing');
  let part=source.slice(start,end);
  const anchor='    res.send(page("Archive Center", `';
  if(part.split(anchor).length!==2)throw Error('CCPS archive render anchor missing');
  part=part.replace(anchor,`    ${archiveMarker}
    if(req.ccpsReviewVerified)await require("./ccps-review-access").filterSetup(q,req.session.user,{campaigns,locations:archivedLocations,qrs:archivedQrs,schedules:archivedSchedules});
`+anchor);
  source=source.slice(0,start)+part+source.slice(end);
 }

 const marker='// CCPS_READ_ONLY_REVIEW_V1';if(source.includes(marker))return source;
 const anchor='const disabledPublicMaintenanceRoutes =';if(source.split(anchor).length!==2)throw Error('CCPS review middleware anchor missing');
 source=source.replace(anchor,marker+'\nrequire("./ccps-review-access").register(app,{q});\n'+anchor);
 const at=source.indexOf('async function getOrganizationScope('),pos=source.indexOf('  let organizationId = null;',at);
 if(at<0||pos<0)throw Error('CCPS review scope anchor missing');
 source=source.slice(0,pos)+'  if(req.ccpsReviewVerified)return require("./ccps-review-access").scope(req,explicitOrganizationId,q,getOrgDateFilter);\n'+source.slice(pos);
 const guard='function requireOrganizationPermission(permissionKey) {\n  return async (req, res, next) => {\n    try {';
 if(source.split(guard).length!==2)throw Error('CCPS review permission anchor missing');
 return source.replace(guard,guard+'\n      if(req.ccpsReviewVerified)return next(); // Read-only routes with CCPS entity checks only.');
}
async function scope(req,explicit,q,getDates){
 if(explicit!=null&&Number(explicit)!==ORG)throw Error('Demo organization mismatch');
 const locations=(await q('SELECT id FROM spaces WHERE organization_id=$1 AND COALESCE(is_archived,false)=false',[ORG])).rows.map(r=>Number(r.id));
 const selected=req.query.location_id?Number(req.query.location_id):null;if(selected&&!locations.includes(selected))throw Error('Demo location mismatch');
 const dates=getDates(req);if(dates.error)throw Error(dates.error);
 const qs=new URLSearchParams({organization_id:String(ORG)});if(selected)qs.set('location_id',String(selected));if(dates.fromDate)qs.set('from',dates.fromDate);if(dates.toDate)qs.set('to',dates.toDate);
 return {organizationId:ORG,organizationRole:'organization_admin',isSuperAdmin:false,hasOrganizationWideAccess:true,allowedLocationIds:locations,selectedLocationId:selected,fromDate:dates.fromDate,toDate:dates.toDate,canEdit:false,queryString:qs.toString()};
}
function register(app,{q}){
 app.get('/ccps-review/:token/:view',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  if(Date.now()>=EXPIRES)return res.status(410).send('This CCPS review link expired on October 27, 2026.');
  if(!validToken(req.params.token)||!homes[req.params.view])return res.status(404).send('Review link not found.');
  try{
   const owner=(await q("SELECT u.id AS customer_id,u.email FROM organizations o JOIN users u ON LOWER(u.email)='mike@vividspots.com' WHERE o.id=$1 AND o.name='CCPS' AND COALESCE(o.is_active,true)=true AND u.role='customer'",[ORG])).rows[0];
   if(!owner)throw Error('Demo identity unavailable');
   await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
   req.session.ccpsReview={expires:EXPIRES,ownerId:Number(owner.customer_id),version:TOKEN_HASH};
   req.session.cookie.maxAge=Math.min(8*3600000,EXPIRES-Date.now());
   await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
   res.redirect(homes[req.params.view]);
  }catch(e){console.error('CCPS REVIEW ENTRY ERROR:',e.message);res.status(503).send('Demo access is temporarily unavailable.');}
 });
 app.use((req,res,next)=>require("./ccps-demo-data-scope").run(Boolean(req.session?.ccpsReview),async()=>{
  const review=req.session?.ccpsReview;if(!review)return next();
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(review.version!==TOKEN_HASH||review.expires!==EXPIRES||Date.now()>=EXPIRES){return req.session.destroy(()=>res.status(410).send('This CCPS review has expired.'));}
  if(req.path==='/logout'||req.path==='/ccps-review-exit')return req.session.destroy(()=>res.redirect(homes.marketplace));
  const notice=()=>res.status(403).send('<h2>CCPS demo workspace</h2><p>Explore CCPS reports, schools, sponsorship inventory, contracts and renewals. This shared demo is view-only; changes and other accounts are unavailable.</p><p><a href="'+homes.enterprise+'">Enterprise</a> · <a href="'+homes.marketplace+'">Marketplace</a> · <a href="'+homes.advertiser+'">Advertiser reports</a></p>');
  if(readOnlyAdmin(req.path)&&!['GET','HEAD'].includes(req.method))return res.status(403).send('Administration is view-only in this CCPS demo. No changes were saved.');
  if(!['GET','HEAD'].includes(req.method)&&!(req.method==='POST'&&req.path==='/org-responsibility/save'))return res.status(403).send('This CCPS demo is view-only. No changes were saved.');
  if(/^\/admin\/(?:archive|restore)-/.test(req.path)||/^\/r\//.test(req.path)||/\/(?:activate|renewal-approve)$/.test(req.path))return notice();
  if(req.path==='/org-dashboard')return res.redirect(homes.enterprise);
  if(req.path==='/dashboard')return res.redirect('/my-setup');
  if(req.path==='/admin/new-location')return res.redirect('/org-location/new?organization_id=13');

  if(!routeAllowed(req.path))return notice();
  // Marketplace assignment GETs can auto-complete setup; previews never do.
  if(setupRoutes.has(req.path))delete req.query.marketplace_request_id;
  try{
   for(const key of ['organization_id','org_id'])if((req.query[key]&&String(req.query[key])!==String(ORG))||(req.body?.[key]&&String(req.body[key])!==String(ORG)))return notice();
   for(const key of ['user_id','customer_id','owner_id','account_id','account','advertiser_customer_id'])if(req.query[key])return notice();
   const photo=req.path.match(/^\/org-opportunity\/(\d+)\/photo$/);
   if(photo){
    if(!(await q('SELECT id FROM organization_opportunities WHERE id=$1 AND organization_id=$2 AND COALESCE(is_active,true)=true',[Number(photo[1]),ORG])).rows.length)return notice();
    return next();
   }
   const user={id:review.ownerId,login_user_id:review.ownerId,customer_id:review.ownerId,role:'customer',name:'CCPS Demo Reviewer',email:'mike@vividspots.com',ccpsReview:true};
   // Default this demo to the existing paid sponsor, without altering source data.
   if(!review.sponsorPreviewV2){review.advertiserId=1300042;review.sponsorPreviewV2=true;}
   if(req.path==='/admin/archived-campaigns')user.demoAdvertiserId=review.advertiserId;
   let allowed=await reportScope(q,user);
   const combinedReport=(['/reports','/reports-qr','/reports-campaign','/reports-location','/admin/reports'].includes(req.path)||req.path.startsWith('/export/'))&&!req.query.advertiser_id;
   if(!combinedReport)allowed=await require('./demo-advertiser-account').select(req,q,user,review,allowed);
   if(!allowed)return notice();
   const locations=(await q('SELECT id FROM spaces WHERE organization_id=$1 AND COALESCE(is_archived,false)=false',[ORG])).rows.map(r=>Number(r.id));
   for(const [keys,ids]of [[['location_id','space_id'],locations],[['campaign_id','campaign','campaignId'],allowed.campaignIds],[['qr_id','qr','qrId','placement_id'],allowed.qrIds]])for(const key of keys){for(const v of [req.query[key],req.body?.[key]])if(v&&v!=='all'&&v!=='All'&&!ids.includes(Number(v)))return notice();}
   const pipelineLocation=req.path.match(/^\/org-revenue-pipeline\/location\/(\d+)(?:\/revenue)?$/);if(pipelineLocation&&!locations.includes(Number(pipelineLocation[1])))return notice();
   const schedule=req.path.match(/^\/admin\/view-schedule\/(\d+)$/);if(schedule){const row=(await q('SELECT qr_id,campaign_id FROM campaign_schedules WHERE id=$1',[Number(schedule[1])])).rows[0];if(!row||!allowed.qrIds.includes(Number(row.qr_id))||!allowed.campaignIds.includes(Number(row.campaign_id)))return notice();}
   let match=req.path.match(/^\/org-(location|campaign|contract|advertising-request)\/(\d+)$/);
   if(match){const kind=match[1],id=Number(match[2]);if(kind==='location'&&!locations.includes(id))return notice();if(kind==='campaign'&&!allowed.campaignIds.includes(id))return notice();if(kind==='contract'||kind==='advertising-request'){const table=kind==='contract'?'contracts':'organization_advertising_requests';if(!(await q('SELECT id FROM '+table+' WHERE id=$1 AND organization_id=$2',[id,ORG])).rows.length)return notice();}}
   match=req.path.match(/^\/admin\/(?:view|edit)-campaign\/(\d+)$/);if(match&&!allowed.campaignIds.includes(Number(match[1])))return notice();
   match=req.path.match(/^\/admin\/(?:view|edit)-location\/(\d+)$/);if(match&&!locations.includes(Number(match[1])))return notice();
   match=req.path.match(/^\/admin\/view-qr\/(\d+)$|^\/r\/(\d+)$/);if(match&&!allowed.qrIds.includes(Number(match[1]||match[2])))return notice();
   match=req.path.match(/^\/admin\/campaign\/(\d+)\/website-pages$/);if(match&&!allowed.campaignIds.includes(Number(match[1])))return notice();
   match=req.path.match(/^\/admin\/edit-qr\/(\d+)$|^\/qr\/(\d+)\.png$/);if(match&&!allowed.qrIds.includes(Number(match[1]||match[2])))return notice();
   match=req.path.match(/^\/org-user\/(\d+)\/edit$/);if(match&&!(await q('SELECT id FROM organization_users WHERE id=$1 AND organization_id=$2',[Number(match[1]),ORG])).rows.length)return notice();
   match=req.path.match(/^\/org-programs\/(\d+)\/settings$/);if(match&&!(await q('SELECT id FROM organization_programs WHERE id=$1 AND organization_id=$2',[Number(match[1]),ORG])).rows.length)return notice();
   if(req.body?.qr_ids&&!allowed.qrIds.includes(Number(req.body.qr_ids)))return notice();
   for(const [key,table] of [['program_id','organization_programs'],['opportunity_id','organization_opportunities'],['advertiser_id','advertisers'],['contract_id','contracts'],['request_id','organization_advertising_requests'],['marketplace_request_id','organization_advertising_requests']])for(const value of [req.body?.[key],req.query[key]])if(value&&value!=='NaN'&&Number(value)!==0){if(!(await q('SELECT id FROM '+table+' WHERE id=$1 AND organization_id=$2',[Number(value),ORG])).rows.length)return notice();}
   match=req.path.match(/^\/org-opportunity\/edit\/(\d+)$/);if(match&&!(await q('SELECT id FROM organization_opportunities WHERE id=$1 AND organization_id=$2',[Number(match[1]),ORG])).rows.length)return notice();
   match=req.path.match(/^\/org-contract\/(\d+)\/(?:fulfillment|renew|renewal-review|renewal-approve|activate|activity)$/);if(match&&!(await q('SELECT id FROM contracts WHERE id=$1 AND organization_id=$2',[Number(match[1]),ORG])).rows.length)return notice();
   match=req.path.match(/^\/(?:org-)?campaign-help\/(\d+)$/);if(match&&!(await q('SELECT id FROM sponsorship_campaign_help WHERE id=$1 AND organization_id=$2 AND user_id=$3',[Number(match[1]),ORG,review.ownerId])).rows.length)return notice();
   req.session.user=user;req.session.orgUser={id:review.ownerId,organization_id:ORG,organization_name:'CCPS Demo',organization_role:'organization_admin',name:'CCPS Demo Reviewer',email:user.email};
   delete req.session.platformUser;
   req.ccpsReviewVerified=true;
   // Match Overview sample results on first visit; preserve explicit filter choices.
   if(req.path==='/org-performance' && req.query.include_test===undefined && req.query.performance_filter!=='1'){
    const params=new URLSearchParams(req.query);params.set('include_test','1');
    return res.redirect('/org-performance?'+params.toString());
   }
   await require('./responsibility-routes').attach(req,res,q);
   const schoolPhotos=await require("./ccps-demo-presentation").load(q,req.path);
   const send=res.send;res.send=function(body){if(typeof body==='string'&&/<(?:html|body|main|div)\b/i.test(body)){
    body=require("./ccps-demo-presentation").render(body,schoolPhotos,req.path);
    body=require("./ccps-gridiron").decorateRequest(body,req.path);
    body=body.replace(/Sales Rep Report/g,'School Responsibility Report').replace(/Sales Reps/g,'School Contacts').replace(/Sales Rep/g,'School Contact').replace(/sales reps/g,'school contacts').replace(/sales rep/g,'school contact').replace(/Demo sales team/g,'Demo school staff');
    if(req.path==='/admin/archived-campaigns')body=body.replace('href="/admin"','href="/my-setup"').replace('← Back to Admin','← Back to My Setup');

    body=body.replace("Advertisers are summed by location; the same advertiser may appear in more than one location.","Advertisers counts unique sponsors across the selected schools.");
    const banner='<div style="padding:12px 20px;background:#edf3f9;color:#23374d;font:14px system-ui"><strong>CCPS interactive demo · View-only except responsibility assignments</strong> · Fictional sample sponsors · Sample Performance results at Gulf Coast · Expires October 27, 2026 (Eastern)<br><a href="'+homes.enterprise+'">Enterprise</a> · <a href="'+homes.marketplace+'">Marketplace</a> · <a href="'+homes.advertiser+'">Advertiser portal</a></div>';
    body=body.replace(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi,(whole,attrs,options)=>{const name=attrs.match(/name=["']([^"']+)["']/i)?.[1];const ids=['organization_id','org_id'].includes(name)?[ORG]:['space_id','location_id'].includes(name)?locations:['qr_id','qr_ids'].includes(name)?allowed.qrIds:['campaign_id','campaign','campaignId'].includes(name)?allowed.campaignIds:null;if(!ids)return whole;return '<select'+attrs+'>'+options.replace(/<option\b[^>]*value=["']([^"']*)["'][^>]*>[\s\S]*?<\/option>/gi,(option,id)=>!id||ids.includes(Number(id))?option:'')+'</select>';});
    body=body.replace(/<input\b[^>]*type=["']file["'][^>]*>/gi,'<span>Photo uploads are available after demo onboarding.</span>');
    {body=body.replace(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi,(form,attrs,inside)=>{
     if(!/method=["']?post/i.test(attrs)||/action=["']\/org-responsibility\/save(?:\?|["'])/i.test(attrs))return form;
     if(setupRoutes.has(req.path))return '<form'+attrs+' onsubmit="return false">'+inside.replace(/<button\b([^>]*)>/gi,(tag,a)=>/type=["']button["']/i.test(a)?tag:'<button'+a+' disabled title="Saving is disabled in this demo">')+'<p style="color:#64748b;font-size:13px">View-only demo — explore the Vivid setup fields. Saving is disabled.</p></form>';
     return '<div class="ccps-admin-preview"><fieldset disabled style="border:0;margin:0;padding:0;min-width:0">'+inside+'</fieldset><p style="color:#64748b;font-size:13px">View-only demo — administrative changes are disabled.</p></div>';
    });}
    body=body.replace(/<a\b[^>]*href=["']\/admin\/(?:archive|restore)-(?:campaign|qr)\/[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,'');
    body=body.replace(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi,(link,before,href,after,label)=>{
      const text=label.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
      if(/^Advertisers(?:\s|$)/i.test(text)&&(href==='#revenue-by-location'||href.startsWith('/org-revenue-pipeline'))){
        const target='/org-advertisers?organization_id=13'+(req.query.location_id?'&location_id='+Number(req.query.location_id):'')+'#advertiser-list';
        return '<a'+before+'href="'+target+'"'+after+'>'+label+'</a>';
      }
      if(!href.startsWith('/'))return link;
      const path=href.split(/[?#]/)[0];
      const blocked=/^\/admin\/(?:archive|restore|deactivate)-/.test(path)||/^\/r\//.test(path);
      const redirects=['/dashboard','/org-dashboard','/admin/archived-campaigns','/admin/new-location'];
      return blocked||(!routeAllowed(path)&&!redirects.includes(path))?'':link;
    });
    body=body.replace(/mike@vividspots\.com/gi,'CCPS Demo Reviewer');
    const sponsorChoice=user.demoAdvertiserId?'<div style="padding:10px 20px;font:14px system-ui;background:#f4f7f5">Sponsor preview: <a href="/my-setup?advertiser_id=1300042">Gulf Coast Home Services · Performance example</a> · <a href="/my-setup?advertiser_id=1300041">Coastal Family Dental · Basic example</a>. Each preview shows only that sponsor.</div>':'';
    body=/<body[^>]*>/i.test(body)?body.replace(/<body[^>]*>/i,m=>m+banner+sponsorChoice):banner+sponsorChoice+body;
    if(readOnlyAdmin(req.path))body=body.replace('CCPS interactive demo · View-only','CCPS interactive demo · Administration is view-only');
   }return send.call(this,body);};

   if(require('./ccps-gridiron').respond(req,res))return;
   if(req.path==='/org-business-breakdown'&&req.query.metric==='available')return res.send(await require('./ccps-demo-presentation').available(q));
   if(await require('./demo-advertiser-account').respond(req,res,q,ORG,allowed))return;
   next();
  }catch(e){console.error('CCPS REVIEW GUARD ERROR:',e.message);res.status(503).send('Demo review is temporarily unavailable.');}
 }));
}
module.exports={install,register,scope,validToken,routeAllowed,editableRoute,EXPIRES};

module.exports.readOnlyAdmin=readOnlyAdmin;

async function reportScope(q,user){
 if(!user?.ccpsReview||user.role!=='customer')return null;
 const result=await q(`SELECT DISTINCT s.id AS location_id,qr.id AS qr_id,c.id AS campaign_id
 FROM spaces s JOIN qr_codes qr ON qr.space_id=s.id
 JOIN qr_campaigns qc ON qc.qr_id=qr.id JOIN campaigns c ON c.id=qc.campaign_id
 WHERE s.organization_id=$1 AND c.user_id=$2
 AND NOT EXISTS(SELECT 1 FROM qr_campaigns other_qc JOIN qr_codes other_qr ON other_qr.id=other_qc.qr_id
 JOIN spaces other_s ON other_s.id=other_qr.space_id WHERE other_qc.campaign_id=c.id AND other_s.organization_id IS DISTINCT FROM $1)
 AND NOT EXISTS(SELECT 1 FROM qr_campaigns other_qc JOIN campaigns other_c ON other_c.id=other_qc.campaign_id WHERE other_qc.qr_id=qr.id AND other_c.user_id IS DISTINCT FROM $2)`,[ORG,user.id]);
 const ids=key=>[...new Set(result.rows.map(r=>Number(r[key])))];
 return require('./demo-advertiser-account').narrow(q,user,{campaignIds:ids('campaign_id'),qrIds:ids('qr_id'),locationIds:ids('location_id')});
}
async function filterSetup(q,user,results){
 const allowed=await reportScope(q,user);if(!allowed)return;
 for(const [key,result] of Object.entries(results)){
  result.rows=result.rows.filter(r=>key==='locations'?allowed.locationIds.includes(Number(r.id)):
   key==='qrs'?allowed.qrIds.includes(Number(r.id)):
   ['campaigns','archivedCampaigns'].includes(key)?allowed.campaignIds.includes(Number(r.id)):
   allowed.qrIds.includes(Number(r.qr_id))&&allowed.campaignIds.includes(Number(r.campaign_id)));
  result.rowCount=result.rows.length;
 }
}
module.exports.reportScope=reportScope;module.exports.filterSetup=filterSetup;
