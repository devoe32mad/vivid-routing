"use strict";
const crypto=require('crypto');
const TOKEN_HASH='599ff0e96fd65b0a385cc18895fb24a88c407030d79abc1886beac58a61f2fdc';
const EXPIRES=Date.parse('2026-10-27T04:00:00Z'); // End of October 26, America/New_York.
const ORG=39;
const DEFAULT_DATES='from=2026-09-13&to=2026-10-12';
const homes={enterprise:'/org-organization/39?organization_id=39&'+DEFAULT_DATES,advertiser:'/my-setup',marketplace:'/advertise/henry-ford-health-demo'};
const simple=new Set([...require('./responsibility-routes').paths,'/org-business-breakdown','/org-help','/help','/admin/conversion-tracking','/org-advertisers','/org-locations','/org-marketplace','/org-contracts','/org-renewals','/org-revenue-pipeline','/org-placement-report','/org-performance','/org-advertising-requests','/org-export','/org-export/renewals.csv','/org-export/renewals.pdf','/my-setup','/reports','/reports-qr','/reports-location','/reports-campaign','/admin/reports','/export/report.pdf','/export/report.xlsx','/export/events.csv','/export/website-pages.pdf','/export/website-pages.csv','/org-export/report.pdf','/org-export/report.xlsx','/admin/marketing-command-center','/campaign-help','/org-campaign-builder-requests','/org-campaign-help-example','/org-location/new','/org-opportunity/new']);
function readOnlyAdmin(path){return ['/org-operations','/org-users','/org-users/new','/org-bulk-import','/org-import-locations-assets','/org-locations-assets-template','/org-programs','/org-settings','/org-permissions'].includes(path)||/^\/org-user\/\d+\/edit$/.test(path)||/^\/org-programs\/\d+\/settings$/.test(path);}
function editableRoute(path){if(/^\/admin\/edit-assignment\/\d+$|^\/admin\/campaign\/\d+\/new-destination$|^\/admin\/destination\/\d+\/edit$/.test(path))return true;if(crmRoute(path,true))return true;return path==='/org-responsibility/save'|| /^\/admin\/edit-location\/\d+$/.test(path)|| ['/admin/new-qr','/admin/new-campaign','/admin/assign','/admin/schedule','/org-programs'].includes(path)||/^\/admin\/edit-qr\/\d+$/.test(path)||/^\/org-programs\/\d+\/settings$/.test(path)|| /^\/admin\/edit-campaign\/\d+$/.test(path)||/^\/(?:org-)?campaign-help(?:\/\d+)?$/.test(path)||/^\/org-opportunity\/(?:new|edit\/\d+)$/.test(path)||path==='/org-location/new'||/^\/org-contract\/\d+\/(?:fulfillment|renew|renewal-review|renewal-approve|activate|activity)$/.test(path);}
function routeAllowed(path){if(/^\/org-qr\/\d+$|^\/admin\/destination\/\d+\/clicks$/.test(path))return true;if(crmRoute(path))return true;if(/^\/demo-advertiser\/placement\/\d+$/.test(path))return true;return /^\/org-revenue-pipeline\/location\/\d+(?:\/revenue)?$/.test(path)|| readOnlyAdmin(path)|| /^\/admin\/view-(?:qr|location)\/\d+$/.test(path)||/^\/admin\/campaign\/\d+\/website-pages$/.test(path)||/^\/r\/\d+$/.test(path)|| /^\/admin\/(?:archive|restore)-(?:campaign|qr)\/\d+$/.test(path)|| path==='/admin/qr-setup-choice'||/^\/qr\/\d+\.png$/.test(path)|| editableRoute(path)|| simple.has(path)||path==='/org-organization/39'||/^\/advertise\/henry-ford-health-demo(?:\/(?:program|location)\/\d+(?:\/opportunity\/\d+)?)?$/.test(path)||/^\/org-(?:location|campaign|contract|advertising-request)\/\d+$/.test(path)||/^\/org-advertiser\/[^/]+$/.test(path)||/^\/admin\/view-campaign\/\d+$/.test(path);}
function validToken(value){if(typeof value!=='string'||value.length>100)return false;return crypto.timingSafeEqual(crypto.createHash('sha256').update(value).digest(),Buffer.from(TOKEN_HASH,'hex'));}
function install(source){
 const createMarker='// HFHS_REVIEW_CREATE_V1';
 if(!source.includes(createMarker)){
  const patch=(startText,anchor,addition)=>{const start=source.indexOf(startText),end=source.indexOf('\napp.',start+1);if(start<0||end<0)throw Error('Demo create route missing: '+startText);let part=source.slice(start,end);if(part.split(anchor).length!==2)throw Error('Demo create anchor missing: '+anchor);part=part.replace(anchor,anchor+addition);source=source.slice(0,start)+part+source.slice(end);};
  patch('app.post("/admin/new-qr",','    const qrId = newQr.rows[0].id;', '\n    if(req.hfhsReviewVerified)await require("./hfhs-review-access").track(q,"qr",qrId);');
  patch('app.post("/admin/new-campaign",','  Number(campaignInsertResult.rows[0].id);','\nif(req.hfhsReviewVerified){await q("UPDATE campaigns SET organization_id=39,is_test=true WHERE id=$1 AND user_id=$2",[campaignId,userId]);await require("./hfhs-review-access").track(q,"campaign",campaignId);}');
  patch('app.get("/admin/schedule",',' let activeScheduleHtml = "";', '\nif(req.hfhsReviewVerified||req.rubberWorldReviewVerified||req.ccpsReviewVerified){const allowed=await require("./hfhs-demo-setup-scope").reportScope(q,currentUser);schedules.rows=schedules.rows.filter(r=>allowed.qrIds.includes(Number(r.qr_id))&&allowed.campaignIds.includes(Number(r.campaign_id)));}');
  // Filter at render time as well as server-side write checks: no other account choices.
  source+='\n'+createMarker+'\n';
 }

 const editorMarker='// HFHS_REVIEW_CAMPAIGN_CHOICES_V2';
 if(!source.includes(editorMarker)){
  const start=source.indexOf('app.get(\n  "/admin/edit-campaign/:campaignId",'),end=source.indexOf('\napp.',start+1);
  if(start<0||end<0)throw Error('Review campaign editor anchor missing');
  let part=source.slice(start,end);const anchor='      const assignedQrs = await q(';
  if(part.split(anchor).length!==2)throw Error('Review QR choices anchor missing');
  part=part.replace(anchor,`      const marketplaceRequest=(await q(\`SELECT ar.*,o.name AS organization_name,s.name AS event_name FROM organization_advertising_requests ar JOIN organizations o ON o.id=ar.organization_id LEFT JOIN spaces s ON s.id=ar.location_id AND s.organization_id=o.id WHERE ar.created_campaign_id=$1 AND ar.created_vivid_user_id=$2 AND ar.setup_status IS DISTINCT FROM 'Demo Archived' ORDER BY ar.id LIMIT 1\`,[campaignId,campaignOwnerId])).rows[0]||null;\n`+anchor);
  part=part.replace(anchor,'      if(req.hfhsReviewVerified){const demoScope=await require("./hfhs-demo-setup-scope").reportScope(q,req.session.user);qrs.rows=qrs.rows.filter(r=>demoScope.qrIds.includes(Number(r.id)));}\n'+anchor);
  source=source.slice(0,start)+part+source.slice(end)+'\n'+editorMarker+'\n';
 }
 const marker='// HFHS_READ_ONLY_REVIEW_V1';if(source.includes(marker))return source;
 const anchor='const disabledPublicMaintenanceRoutes =';if(source.split(anchor).length!==2)throw Error('Review middleware anchor missing');
 source=source.replace(anchor,marker+'\nrequire("./hfhs-review-access").register(app,{q});\n'+anchor);
 const scope='  let organizationId = null;';const at=source.indexOf('async function getOrganizationScope('),pos=source.indexOf(scope,at);if(at<0||pos<0)throw Error('Review scope anchor missing');
 source=source.slice(0,pos)+'  if(req.hfhsReviewVerified)return require("./hfhs-review-access").scope(req,explicitOrganizationId,q,getOrgDateFilter);\n'+source.slice(pos);
 const guard='function requireOrganizationPermission(permissionKey) {\n  return async (req, res, next) => {\n    try {';
 if(source.split(guard).length!==2)throw Error('Review permission anchor missing');
 source=source.replace(guard,guard+'\n      if(req.hfhsReviewVerified)return next(); // Only guarded demo routes reach this point.');
 return source;
}
async function scope(req,explicit,q,getDates){
 if(explicit!=null&&Number(explicit)!==ORG)throw Error('Demo organization mismatch');
 const locations=(await q('SELECT id FROM spaces WHERE organization_id=$1 AND COALESCE(is_archived,false)=false',[ORG])).rows.map(r=>Number(r.id));
 const selected=req.query.location_id?Number(req.query.location_id):null;if(selected&&!locations.includes(selected))throw Error('Demo location mismatch');
 const dates=getDates(req);if(dates.error)throw Error(dates.error);
 const qs=new URLSearchParams({organization_id:String(ORG)});if(selected)qs.set('location_id',String(selected));if(dates.fromDate)qs.set('from',dates.fromDate);if(dates.toDate)qs.set('to',dates.toDate);
 return {organizationId:ORG,organizationRole:'organization_admin',isSuperAdmin:false,hasOrganizationWideAccess:true,allowedLocationIds:locations,selectedLocationId:selected,fromDate:dates.fromDate,toDate:dates.toDate,canEdit:true,queryString:qs.toString()};
}
function register(app,{q}){
 app.get('/hfhs-review/:token/:view',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  if(Date.now()>=EXPIRES)return res.status(410).send('This HFHS review link expired on October 26, 2026.');
  if(!validToken(req.params.token)||!homes[req.params.view])return res.status(404).send('Review link not found.');
  try{
   await ensure(q);
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
  if(req.path.startsWith("/ccps-review/"))return next(); // CCPS entry validates its own bearer token before replacing the session.
  const review=req.session?.hfhsReview;if(!review)return next();
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(review.version!==TOKEN_HASH||review.expires!==EXPIRES||Date.now()>=EXPIRES){return req.session.destroy(()=>res.status(410).send('This HFHS review has expired.'));}
  if(req.path==='/logout'||req.path==='/hfhs-review-exit')return req.session.destroy(()=>res.redirect(homes.marketplace));
  const notice=()=>res.status(403).send('<h2>HFHS demo workspace</h2><p>You can explore reports and edit HFHS demo campaigns, campaign collaboration, sponsorship inventory, locations, renewals and benefit fulfillment. Account settings and other customers are outside this demo.</p><p><a href="'+homes.enterprise+'">Enterprise</a> · <a href="'+homes.marketplace+'">Marketplace</a> · <a href="'+homes.advertiser+'">Advertiser reports</a></p>');
  // Canonicalize repeated HFHS organization selectors from navigation links.
  // Reject mixed IDs instead of selecting the first value.
  if(['GET','HEAD'].includes(req.method)){
   const query=new URLSearchParams(req.originalUrl.split('?').slice(1).join('?'));
   let changed=false;
   for(const key of ['organization_id','org_id']){
    const values=query.getAll(key);
    if(values.length>1){
     if(values.some(value=>value!==String(ORG)))return notice();
     query.set(key,String(ORG));changed=true;
    }
   }
   if(changed)return res.redirect(req.path+'?'+query.toString());
  }
  if(readOnlyAdmin(req.path)&&!['GET','HEAD'].includes(req.method))return res.status(403).send('Administration is view-only in this HFHS demo. No changes were saved.');
  if(!['GET','HEAD','POST'].includes(req.method))return notice();
  if(req.method==='POST'&&!editableRoute(req.path))return notice();
  if(req.method==='POST'&&(!req.session.hfhsReviewCsrf||req.body?._hfhs_review_csrf!==req.session.hfhsReviewCsrf))return res.status(403).send('Please reload this demo form before saving.');
  if(req.path==='/org-dashboard')return res.redirect(homes.enterprise);
  if(req.path==='/admin/archived-campaigns')return res.redirect('/my-setup?status=all');
  if(req.path==='/dashboard')return res.redirect('/my-setup');
  if(req.path==='/admin/new-location')return res.redirect('/org-location/new?organization_id=39');
  if(!routeAllowed(req.path))return notice();
  try{
   req.session.hfhsReviewCsrf ||= crypto.randomBytes(24).toString('hex');
   for(const key of ['organization_id','org_id'])if((req.query[key]&&String(req.query[key])!==String(ORG))||(req.body?.[key]&&String(req.body[key])!==String(ORG)))return notice();
   for(const key of ['user_id','customer_id','owner_id','account_id'])if(req.query[key])return notice();
   const user={id:review.ownerId,login_user_id:review.ownerId,customer_id:review.ownerId,role:'customer',name:'HFHS Demo Reviewer',email:'michaelandrewdevoe@gmail.com'};
   let allowed=await require('./hfhs-demo-setup-scope').reportScope(q,user);
   allowed=await require('./demo-advertiser-account').select(req,q,user,review,allowed);
   if(!allowed)return notice();
   if(/^\/admin\/destination\/\d+\/(?:edit|clicks)$/.test(req.path)){
    user.demoAdvertiserId=Number(review.advertiserId);
    if(!user.demoAdvertiserId)return notice();
    allowed=await require('./demo-advertiser-account').narrow(q,user,allowed);
   }
   const locations=(await q('SELECT id FROM spaces WHERE organization_id=$1 AND COALESCE(is_archived,false)=false',[ORG])).rows.map(r=>Number(r.id));
   for(const [keys,ids]of [[['location_id','space_id'],locations],[['campaign_id','campaign'],allowed.campaignIds],[['qr_id','qr','placement_id'],allowed.qrIds]])for(const key of keys){if(key==='campaign'&&req.path==='/admin/marketing-command-center')continue; // MCC validates its channel-specific campaign/source keys.
    for(const v of [req.query[key],req.body?.[key]])if(v&&v!=='all'&&v!=='All'&&!ids.includes(Number(v)))return notice();}
   const pipelineLocation=req.path.match(/^\/org-revenue-pipeline\/location\/(\d+)(?:\/revenue)?$/);if(pipelineLocation&&!locations.includes(Number(pipelineLocation[1])))return notice();
   if(crmRoute(req.path)||crmRoute(req.path,true)){
    let key;try{key=decodeURIComponent(req.path.split('/')[2]).trim().toLowerCase();}catch(e){return notice();}
    const advertiser=(await q('SELECT id FROM advertisers WHERE organization_id=$1 AND LOWER(TRIM(name))=$2 LIMIT 1',[ORG,key])).rows[0];
    if(!advertiser)return notice();
    const record=req.path.match(/\/(task|opportunity)\/(\d+)(?:\/(?:edit|complete))?$/);
    if(record){const table=record[1]==='task'?'advertiser_relationship_tasks':'advertiser_sales_opportunities';if(!(await q('SELECT id FROM '+table+' WHERE id=$1 AND organization_id=$2 AND advertiser_id=$3',[Number(record[2]),ORG,Number(advertiser.id)])).rows.length)return notice();}
   }
   const orgQr=req.path.match(/^\/org-qr\/(\d+)$/);if(orgQr&&!allowed.qrIds.includes(Number(orgQr[1])))return notice();
   const assignment=req.path.match(/^\/admin\/edit-assignment\/(\d+)$/);
   if(assignment&&!(await q('SELECT id FROM qr_campaigns WHERE id=$1 AND qr_id=ANY($2::int[]) AND campaign_id=ANY($3::int[])',[Number(assignment[1]),allowed.qrIds,allowed.campaignIds])).rows.length)return notice();
   const newDestination=req.path.match(/^\/admin\/campaign\/(\d+)\/new-destination$/);if(newDestination&&!allowed.campaignIds.includes(Number(newDestination[1])))return notice();
   const destination=req.path.match(/^\/admin\/destination\/(\d+)\/(?:edit|clicks)$/);
   if(destination&&!(await q('SELECT id FROM campaign_destinations WHERE id=$1 AND campaign_id=ANY($2::int[])',[Number(destination[1]),allowed.campaignIds])).rows.length)return notice();
   let match=req.path.match(/^\/org-(location|campaign|contract|advertising-request)\/(\d+)$/);
   if(match){const kind=match[1],id=Number(match[2]);if(kind==='location'&&!locations.includes(id))return notice();if(kind==='campaign'&&!allowed.campaignIds.includes(id))return notice();if(kind==='contract'||kind==='advertising-request'){const table=kind==='contract'?'contracts':'organization_advertising_requests';if(!(await q('SELECT id FROM '+table+' WHERE id=$1 AND organization_id=$2',[id,ORG])).rows.length)return notice();}}
   match=req.path.match(/^\/admin\/(?:view|edit)-campaign\/(\d+)$/);if(match&&!allowed.campaignIds.includes(Number(match[1])))return notice();
   match=req.path.match(/^\/admin\/(?:view|edit)-location\/(\d+)$/);if(match&&!locations.includes(Number(match[1])))return notice();
   match=req.path.match(/^\/admin\/view-qr\/(\d+)$|^\/r\/(\d+)$/);if(match&&!allowed.qrIds.includes(Number(match[1]||match[2])))return notice();
   match=req.path.match(/^\/admin\/campaign\/(\d+)\/website-pages$/);if(match&&!allowed.campaignIds.includes(Number(match[1])))return notice();
   match=req.path.match(/^\/admin\/(?:archive|restore)-(campaign|qr)\/(\d+)$/);if(match){if(!allowed[match[1]==='qr'?'qrIds':'campaignIds'].includes(Number(match[2]))||req.query._hfhs_review_csrf!==req.session.hfhsReviewCsrf)return notice();}
   match=req.path.match(/^\/admin\/edit-qr\/(\d+)$|^\/qr\/(\d+)\.png$/);if(match&&!allowed.qrIds.includes(Number(match[1]||match[2])))return notice();
   match=req.path.match(/^\/org-user\/(\d+)\/edit$/);if(match&&!(await q('SELECT id FROM organization_users WHERE id=$1 AND organization_id=$2',[Number(match[1]),ORG])).rows.length)return notice();
   match=req.path.match(/^\/org-programs\/(\d+)\/settings$/);if(match&&!(await q('SELECT id FROM organization_programs WHERE id=$1 AND organization_id=$2',[Number(match[1]),ORG])).rows.length)return notice();
   if(req.method==='POST'&&req.path==='/admin/new-qr'&&!locations.includes(Number(req.body.space_id)))return notice();
   if(req.method==='POST'&&['/admin/assign','/admin/schedule'].includes(req.path)&&(!allowed.qrIds.includes(Number(req.body.qr_id))||!allowed.campaignIds.includes(Number(req.body.campaign_id))))return notice();
   if(req.body?.qr_ids&&!allowed.qrIds.includes(Number(req.body.qr_ids)))return notice();
   for(const [key,table] of [['program_id','organization_programs'],['opportunity_id','organization_opportunities'],['advertiser_id','advertisers'],['contract_id','contracts'],['request_id','organization_advertising_requests'],['marketplace_request_id','organization_advertising_requests']])for(const value of [req.body?.[key],req.query[key]])if(value&&value!=='NaN'&&Number(value)!==0){if(!(await q('SELECT id FROM '+table+' WHERE id=$1 AND organization_id=$2',[Number(value),ORG])).rows.length)return notice();}
   match=req.path.match(/^\/org-opportunity\/edit\/(\d+)$/);if(match&&!(await q('SELECT id FROM organization_opportunities WHERE id=$1 AND organization_id=$2',[Number(match[1]),ORG])).rows.length)return notice();
   match=req.path.match(/^\/org-contract\/(\d+)\/(?:fulfillment|renew|renewal-review|renewal-approve|activate|activity)$/);if(match&&!(await q('SELECT id FROM contracts WHERE id=$1 AND organization_id=$2',[Number(match[1]),ORG])).rows.length)return notice();
   match=req.path.match(/^\/(?:org-)?campaign-help\/(\d+)$/);if(match&&!(await q('SELECT id FROM sponsorship_campaign_help WHERE id=$1 AND organization_id=$2 AND user_id=$3',[Number(match[1]),ORG,review.ownerId])).rows.length)return notice();
   if(req.method==='POST'&&(/^\/admin\/edit-campaign\//.test(req.path)||req.path==='/admin/new-campaign'))req.body.is_test='on';
   req.session.user=user;req.session.orgUser={id:review.ownerId,organization_id:ORG,organization_name:'Henry Ford Health Demo',organization_role:'organization_admin',name:'HFHS Demo Reviewer',email:user.email};
   delete req.session.platformUser;
   req.hfhsReviewVerified=true;
   if(req.path==='/org-business-breakdown'&&req.query.metric==='available'){const target=new URLSearchParams({organization_id:String(ORG),status:'Available'});for(const key of ['location_id','program_id'])if(req.query[key])target.set(key,String(req.query[key]));return res.redirect('/org-marketplace?'+target.toString());}
   await require('./responsibility-routes').attach(req,res,q);
   const send=res.send;res.send=function(body){if(typeof body==='string'&&/<(?:html|body|main|div)\b/i.test(body)){
    const banner='<div style="padding:12px 20px;background:#edf3f9;color:#23374d;font:14px system-ui"><strong>HFHS interactive demo · Editing enabled</strong> · Illustrative demo data · Expires October 26, 2026 (Eastern)<br><a href="'+homes.enterprise+'">Enterprise</a> · <a href="'+homes.marketplace+'">Marketplace</a> · <a href="'+homes.advertiser+'">Advertiser portal</a> · <a href="/org-advertiser/demo%20sponsor%20%E2%80%94%20fundraising%20%26%20events?organization_id=39">Sponsor CRM</a> · <a href="/admin/marketing-command-center">Marketing Command Center</a></div>';
    body=body.replace(/href="(\/admin\/(?:archive|restore)-(?:campaign|qr)\/\d+)"/g,(_,url)=>'href="'+url+'?_hfhs_review_csrf='+req.session.hfhsReviewCsrf+'"');
    body=body.replace(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi,(whole,attrs,options)=>{const name=attrs.match(/name=["']([^"']+)["']/i)?.[1];const ids=['space_id','location_id'].includes(name)?locations:['qr_id','qr_ids'].includes(name)?allowed.qrIds:['campaign_id','campaign'].includes(name)?allowed.campaignIds:null;if(!ids)return whole;return '<select'+attrs+'>'+options.replace(/<option\b[^>]*value=["']([^"']*)["'][^>]*>[\s\S]*?<\/option>/gi,(option,id)=>!id||ids.includes(Number(id))?option:'')+'</select>';});
    body=body.replace(/<form\b[^>]*>/gi,form=>/method=["']?post/i.test(form)?form.replace(/enctype=["']multipart\/form-data["']/i,'')+'<input type="hidden" name="_hfhs_review_csrf" value="'+req.session.hfhsReviewCsrf+'">':form);
    body=body.replace(/<input\b[^>]*type=["']file["'][^>]*>/gi,'<span>Photo uploads are available after demo onboarding.</span>');
    if(readOnlyAdmin(req.path)){body=body.replace(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi,(form,attrs,inside)=>/method=["']?post/i.test(attrs)&&! /action=["']\/org-responsibility\/save(?:\?|["'])/i.test(attrs)?'<div class="hfhs-admin-preview"><fieldset disabled style="border:0;margin:0;padding:0;min-width:0">'+inside+'</fieldset><p style="color:#64748b;font-size:13px">View-only demo — administrative changes are disabled.</p></div>':form);}
    body=body.replace(/<a\b([^>]*?)href=["'](\/admin\/(?:advertiser-customer\/\d+\/users|import-qr|connectors\/[^"'?]+)|\/build-my-campaign)(?:\?[^"']*)?["']([^>]*)>([\s\S]*?)<\/a>/gi,(_,before,url,after,label)=>'<span'+before+after+' aria-disabled="true" title="Available after onboarding; unavailable in the shared demo" style="opacity:.6;cursor:not-allowed">'+label+' <small>(after onboarding)</small></span>');
    if(crmRoute(req.path))body=body.replace(/<textarea\b([^>]*)>/gi,(_,attrs)=>'<textarea'+attrs.replace(/\sstyle=(["'])[\s\S]*?\1/gi,'')+' style="display:block;width:100%;max-width:100%;min-height:180px;box-sizing:border-box;padding:12px;border:1px solid #DBE3EF;border-radius:12px;font:inherit;line-height:1.5;resize:vertical;margin:6px 0 16px;">');
    body=body.replace(/michaelandrewdevoe@gmail\.com/gi,'HFHS Demo Reviewer');
    body=/<body[^>]*>/i.test(body)?body.replace(/<body[^>]*>/i,m=>m+banner):banner+body;
    if(readOnlyAdmin(req.path))body=body.replace('HFHS interactive demo · Editing enabled','HFHS interactive demo · Administration is view-only');
   }return send.call(this,body);};
   if(/^\/admin\/destination\/\d+\/edit$/.test(req.path))return await editDemoDestination(req,res,q,allowed);
   if(await require('./demo-advertiser-account').respond(req,res,q,ORG,allowed))return;
   next();
  }catch(e){console.error('HFHS REVIEW GUARD ERROR:',e.message);res.status(503).send('Demo review is temporarily unavailable.');}
 });
}
module.exports={install,register,scope,validToken,routeAllowed,editableRoute,EXPIRES};

async function ensure(q){await q("CREATE TABLE IF NOT EXISTS hfhs_review_entities(kind TEXT NOT NULL,entity_id INTEGER NOT NULL,organization_id INTEGER NOT NULL DEFAULT 39,PRIMARY KEY(kind,entity_id))");}
async function track(q,kind,id){await ensure(q);await q("INSERT INTO hfhs_review_entities(kind,entity_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[kind,id]);}
async function extras(q){await ensure(q);return (await q("SELECT e.kind,e.entity_id FROM hfhs_review_entities e WHERE e.organization_id=39 AND ((e.kind='qr' AND EXISTS(SELECT 1 FROM qr_codes qr JOIN spaces s ON s.id=qr.space_id WHERE qr.id=e.entity_id AND s.organization_id=39)) OR (e.kind='campaign' AND EXISTS(SELECT 1 FROM campaigns c WHERE c.id=e.entity_id AND c.organization_id=39)))")).rows;}
module.exports.track=track;module.exports.extras=extras;

module.exports.readOnlyAdmin=readOnlyAdmin;

function crmRoute(path,write=false){
 const match=path.match(/^\/org-advertiser\/[^/]+\/(.+)$/);
 if(!match)return false;
 return (write ? /^(?:relationship|tasks|task\/\d+\/(?:edit|complete)|opportunities|opportunity\/\d+|activity)$/ : /^(?:relationship\/edit|tasks(?:\/new)?|task\/\d+\/edit|opportunities(?:\/new)?|opportunity\/\d+(?:\/edit)?|activity(?:\/new)?)$/).test(match[1]);
}

module.exports.crmRoute=crmRoute;

async function editDemoDestination(req,res,q,allowed){
 const id=Number(req.path.split('/')[3]);
 const row=(await q('SELECT d.*,c.name AS campaign_name FROM campaign_destinations d JOIN campaigns c ON c.id=d.campaign_id WHERE d.id=$1 AND c.organization_id=39 AND d.campaign_id=ANY($2::int[])',[id,allowed.campaignIds])).rows[0];
 if(!row)return res.status(404).send('Destination not found in this demo account.');
 const types=['website','order','offer','menu','reservation','appointment','directions','store_locator','phone','email','sms','registration','donation','tickets','pdf','video','social','app','other'];
 if(req.method==='POST'){
  const v=req.body,name=String(v.name||'').trim(),type=String(v.destination_type||'');
  const normalize=value=>{const s=String(value||'').trim();if(!s)return '';return /^[a-z][a-z0-9+.-]*:/i.test(s)?s:'https://'+s;};
  const url=normalize(v.destination_url),conversion=normalize(v.conversion_url),value=Number(v.estimated_value||0),order=Number(v.display_order||1);
  if(!name||!types.includes(type)||! /^(https?:\/\/|mailto:|tel:|sms:)/i.test(url)||(conversion&&!/^https?:\/\//i.test(conversion))||!Number.isFinite(value)||value<0||!Number.isInteger(order)||order<1)return res.status(400).send('Enter a name, valid destination URL, nonnegative value and valid display order. Use Back to correct the form.');
  await q('UPDATE campaign_destinations SET name=$1,destination_type=$2,destination_url=$3,conversion_url=$4,estimated_value=$5,display_order=$6,is_active=$7,updated_at=NOW() WHERE id=$8 AND campaign_id=$9',[name,type,url,conversion,value,order,v.is_active==='on',id,row.campaign_id]);
  return res.redirect(303,'/admin/view-campaign/'+row.campaign_id);
 }
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const field=(label,name,type='text')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(row[name])+'" '+(['name','destination_url'].includes(name)?'required':'')+(type==='number'?' min="'+(name==='display_order'?1:0)+'" step="'+(name==='display_order'?1:.01)+'"':'')+'></label>';
 return res.send('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Edit Destination</title><style>body{font:15px system-ui;background:#f4f7f5;color:#183d29;margin:0}.wrap{max-width:850px;margin:28px auto;padding:0 18px}.card{background:white;border-radius:14px;padding:24px;box-shadow:0 5px 14px #0001}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}label{display:block;font-weight:600}input,select{display:block;box-sizing:border-box;width:100%;padding:11px;border:1px solid #dbe3df;border-radius:8px;margin-top:7px;font:inherit}.btn{display:inline-block;border:0;border-radius:8px;padding:12px 18px;background:#2f7d46;color:white;text-decoration:none;font:inherit;cursor:pointer}.secondary{background:#e9efeb;color:#183d29}</style></head><body><main class="wrap"><a href="/admin/view-campaign/'+row.campaign_id+'">← Back to campaign</a><h1>Edit Destination</h1><p>'+esc(row.campaign_name)+'</p><section class="card"><form method="post" action="/admin/destination/'+id+'/edit"><div class="grid">'+field('Destination Name','name')+'<label>Destination Type<select name="destination_type">'+types.map(t=>'<option value="'+t+'"'+(t===row.destination_type?' selected':'')+'>'+esc(t.replace(/_/g,' '))+'</option>').join('')+'</select></label>'+field('Destination URL','destination_url')+field('Conversion Page URL (Optional)','conversion_url')+field('Estimated Revenue Per Conversion ($)','estimated_value','number')+field('Display Order','display_order','number')+'</div><label style="margin:20px 0"><input type="checkbox" name="is_active" '+(row.is_active?'checked':'')+' style="display:inline;width:auto"> Active</label><button class="btn" type="submit">Save Destination</button> <a class="btn secondary" href="/admin/view-campaign/'+row.campaign_id+'">Cancel</a></form></section></main></body></html>');
}
