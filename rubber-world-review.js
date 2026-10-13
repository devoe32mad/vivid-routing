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
 return {locationIds:locations.map(x=>Number(x.id)),qrIds:qrs.map(x=>Number(x.id)),campaignIds:campaigns.map(x=>Number(x.id))};
}
function validToken(token){return typeof token==='string'&&token.length<100&&crypto.timingSafeEqual(crypto.createHash('sha256').update(token).digest(),Buffer.from(HASH,'hex'));}
const simple=new Set([...require('./rubber-world-ai-demo').paths,'/org-business-breakdown','/org-help','/help','/org-advertisers','/org-locations','/org-marketplace','/org-contracts','/org-renewals','/org-revenue-pipeline','/org-placement-report','/org-performance','/org-advertising-requests','/org-export','/org-export/renewals.csv','/org-export/renewals.pdf','/my-setup','/reports','/reports-qr','/reports-location','/reports-campaign','/admin/reports','/export/report.pdf','/export/report.xlsx','/export/events.csv','/org-export/report.pdf','/org-export/report.xlsx','/org-operations','/org-users','/org-programs','/org-settings','/org-permissions','/campaign-help','/org-campaign-builder-requests','/org-campaign-help-example']);
function routeAllowed(path,org){return simple.has(path)||path===`/org-organization/${org}`||/^\/org-revenue-pipeline\/location\/\d+(?:\/revenue)?$/.test(path)||/^\/org-(?:location|campaign|contract|advertising-request|advertiser)\/\d+$/.test(path)||/^\/admin\/view-(?:qr|campaign|location)\/\d+$/.test(path)||/^\/admin\/campaign\/\d+\/website-pages$/.test(path)||/^\/qr\/\d+\.png$/.test(path)||/^\/org-opportunity\/\d+\/photo$/.test(path)||/^\/advertise\/rubber-world-demo(?:\/(?:program|location)\/\d+(?:\/opportunity\/\d+)?)?$/.test(path);}
function copy(text){return text.replace(/Add a physical placement location such as:\s*school,\s*store,\s*marina,\s*event,\s*or parking area\./g,"Add a print issue, digital edition, or website advertising collection.").replace(/\bActual Events?\b/g,'Issues / Editions').replace(/\bEvent Types?\b/g,'Channels').replace(/\bevent types?\b/g,'channels').replace(/\bLocations\b/g,'Issues / Editions').replace(/\bLocation\b/g,'Issue / Edition').replace(/\blocations\b/g,'issues / editions').replace(/\blocation\b/g,'issue / edition').replace(/\bEvents\b/g,'Issues / Editions').replace(/\bEvent\b/g,'Issue / Edition').replace(/\bevents\b/g,'issues / editions').replace(/\bevent\b/g,'issue / edition').replace(/\bSponsorship\b/g,'Advertising').replace(/\bsponsorship\b/g,'advertising').replace(/\bSponsors\b/g,'Advertisers').replace(/\bSponsor\b/g,'Advertiser').replace(/\bsponsors\b/g,'advertisers').replace(/\bsponsor\b/g,'advertiser').replace(/\bPrograms\b/g,'Channels').replace(/\bProgram\b/g,'Channel').replace(/\bprograms\b/g,'channels').replace(/\bprogram\b/g,'channel').replace(/rubber-world-demo@example\.invalid/g,'Rubber World Demo').replace(/Create a Issue \/ Edition/g,'Create an Issue / Edition');}
function presentation(html){
 // Change visible prose only: preserve URLs, form names, scripts and styles.
 return html.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]+>)/gi).map(part=>part.startsWith('<')?part:copy(part)).join('');
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
  if(!['GET','HEAD'].includes(req.method))return deny();
  if(['/org-dashboard','/dashboard'].includes(req.path))return res.redirect(home);
  if(!routeAllowed(req.path,org))return deny();
  try{
   const user={id:review.owner,login_user_id:review.owner,customer_id:review.owner,role:'customer',name:'Rubber World Demo Reviewer',email:EMAIL};
   const scope=await reportScope(q,user);
   if(!scope?.locationIds.length)return deny();
   for(const key of ['organization_id','organizationId','org_id','orgId'])if(req.query[key]&&String(req.query[key])!==String(org))return deny();
   for(const key of ['user_id','userId','customer_id','customerId','owner_id','ownerId','account_id','accountId','account'])if(req.query[key])return deny();
   for(const [keys,ids]of [[['location_id','locationId','space_id','spaceId'],scope.locationIds],[['campaign_id','campaignId','campaign'],scope.campaignIds],[['qr_id','qrId','qr','placement_id','placementId'],scope.qrIds]])for(const key of keys)if(req.query[key]&&!['all','All'].includes(req.query[key])&&!ids.includes(Number(req.query[key])))return deny();
   const checks=[[/^\/org-revenue-pipeline\/location\/(\d+)/,scope.locationIds],[/^\/org-location\/(\d+)$/,scope.locationIds],[/^\/admin\/view-location\/(\d+)$/,scope.locationIds],[/^\/org-campaign\/(\d+)$/,scope.campaignIds],[/^\/admin\/view-campaign\/(\d+)$/,scope.campaignIds],[/^\/admin\/campaign\/(\d+)\/website-pages$/,scope.campaignIds],[/^\/admin\/view-qr\/(\d+)$/,scope.qrIds],[/^\/qr\/(\d+)\.png$/,scope.qrIds],[/^\/advertise\/rubber-world-demo\/location\/(\d+)/,scope.locationIds]];
   for(const [regex,ids]of checks){const match=req.path.match(regex);if(match&&!ids.includes(Number(match[1])))return deny();}
   const refs=[['program_id','organization_programs'],['opportunity_id','organization_opportunities'],['advertiser_id','advertisers'],['contract_id','contracts'],['request_id','organization_advertising_requests'],['marketplace_request_id','organization_advertising_requests']];
   for(const [key,table]of refs)if(req.query[key]&&!(await q(`SELECT id FROM ${table} WHERE id=$1 AND organization_id=$2`,[Number(req.query[key]),org])).rows.length)return deny();
   const pathRefs=[[/^\/org-contract\/(\d+)$/,'contracts'],[/^\/org-advertising-request\/(\d+)$/,'organization_advertising_requests'],[/^\/org-advertiser\/(\d+)$/,'advertisers'],[/^\/org-opportunity\/(\d+)\/photo$/,'organization_opportunities'],[/^\/advertise\/rubber-world-demo\/program\/(\d+)$/,'organization_programs'],[/\/opportunity\/(\d+)$/,'organization_opportunities']];
   for(const [regex,table]of pathRefs){const match=req.path.match(regex);if(match&&!(await q(`SELECT id FROM ${table} WHERE id=$1 AND organization_id=$2`,[Number(match[1]),org])).rows.length)return deny();}
   req.session.user=user;req.session.orgUser={id:review.owner,organization_id:org,organization_name:'Rubber World Magazine Demo',organization_role:'organization_admin',name:user.name,email:EMAIL};delete req.session.platformUser;req.rubberWorldReviewVerified=true;
   const send=res.send;res.send=function(body){if(typeof body==='string'&&/<(?:html|body|main|div)\b/i.test(body)){
    body=(req.path.startsWith('/advertise/rubber-world-demo')?body:presentation(body)).replace(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi,(form,attrs,inside)=>/method=["']?post/i.test(attrs)?'<fieldset disabled style="border:0;padding:0">'+inside+'</fieldset><p>View-only demonstration.</p>':form);
    body=body.replace(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi,(link,before,href,after,label)=>{
     if(!href.startsWith('/'))return link;
     const path=href.split(/[?#]/)[0];
     if(routeAllowed(path,org)||['/logout','/dashboard','/org-dashboard'].includes(path))return link;
     return '<span title="View-only demo" style="color:#87949e">'+label+'</span>';
    });
    const banner=`<div style="padding:14px 24px;background:#edf3f9;color:#23374d;font:14px system-ui"><strong>Rubber World Magazine · Vivid demonstration</strong> · View-only · Sample rates and simulated activity<br>${nav}</div>`;
    body=/<body[^>]*>/i.test(body)?body.replace(/<body[^>]*>/i,m=>m+banner):banner+body;
   }return send.call(this,body);};
   const aiDemo=require('./rubber-world-ai-demo').render(req.path,org);if(aiDemo)return res.send(aiDemo);
   next();
  }catch(e){console.error('RUBBER WORLD REVIEW GUARD:',e.message);res.status(503).send('Demo review is temporarily unavailable.');}
 });
}
module.exports={register,isDemo,reportScope,validToken,routeAllowed,presentation,EXPIRES};
