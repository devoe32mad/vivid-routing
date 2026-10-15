'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {EMAIL,SLUG}=require('./mca-demo-seed');
const home=f=>`/org-organization/${f.organizationId}?organization_id=${f.organizationId}`;
async function prepare(q,f){
 await q("UPDATE organization_programs SET audience_scope='location' WHERE organization_id=$1",[f.organizationId]);
 await q(`UPDATE organizations SET public_logo_url='https://masonacademy.com/pics/header_logo.png' WHERE id=$1`,[f.organizationId]);
 for(const name of ['Alex Morgan — Demo','Jordan Lee — Demo'])await q(`INSERT INTO organization_sales_reps(organization_id,dataset,name) VALUES($1,'live',$2) ON CONFLICT DO NOTHING`,[f.organizationId,name]);
 const reps=(await q('SELECT id FROM organization_sales_reps WHERE organization_id=$1 ORDER BY id',[f.organizationId])).rows;
 const ops=(await q('SELECT id FROM organization_opportunities WHERE organization_id=$1 ORDER BY id',[f.organizationId])).rows;
 for(let i=0;i<ops.length;i++)await q(`INSERT INTO organization_responsibility(organization_id,dataset,root_kind,root_id,rep_id,updated_by) VALUES($1,'live','opportunity',$2,$3,'MCA isolated demo seed') ON CONFLICT DO NOTHING`,[f.organizationId,ops[i].id,reps[i%reps.length].id]);
 await q(`UPDATE campaigns SET end_date='2027-10-17',is_test=true WHERE organization_id=$1`,[f.organizationId]);
 await q(`UPDATE organization_opportunities SET price=NULL WHERE organization_id=$1 AND category='Unverified concept'`,[f.organizationId]);
}
function register(app,{q,organizationNav,fixture:f}){
 app.use('/assets/mca-isolated',require('express').static(path.join(__dirname,'assets/mca-isolated')));
 app.get('/health',(_req,res)=>res.json({ok:true,isolated:true}));
 app.get('/review/:token',(req,res)=>{
  const expected=crypto.createHash('sha256').update(process.env.MCA_REVIEW_TOKEN).digest(),actual=crypto.createHash('sha256').update(req.params.token).digest();
  if(!crypto.timingSafeEqual(expected,actual))return res.status(404).send('Review link not found.');
  req.session.regenerate(e=>{if(e)return res.sendStatus(500);req.session.mcaReview=true;req.session.mcaPortal='organization';req.session.save(e=>e?res.sendStatus(500):res.redirect(home(f)));});
 });
 app.use((req,res,next)=>{
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  if(!req.session.mcaReview)return res.status(401).send('<h1>MCA private demo</h1><p>Open your Vivid review invitation to continue.</p>');
  if(req.path==='/demo/portal'){
   if(!['organization','marketplace','advertiser'].includes(req.query.view))return res.sendStatus(400);
   req.session.mcaPortal=req.query.view;return req.session.save(e=>e?res.sendStatus(500):res.redirect(req.query.view==='organization'?home(f):req.query.view==='marketplace'?'/advertise/'+SLUG:'/my-setup'));
  }
  if(req.path==='/'||req.path==='/platform-login'||req.path==='/org-login'||req.path==='/login')return res.redirect(home(f));
  // No external effects, user administration or production maintenance.
  if(/(?:send.*email|test-email|password|reset|billing|payment|square|connector|oauth|init-db|delete-user)/i.test(req.path))return res.status(403).send('External integrations are disabled in this isolated demo.');
  for(const key of ['organization_id','organizationId','org_id'])if((req.query[key]&&Number(req.query[key])!==f.organizationId)||(req.body?.[key]&&Number(req.body[key])!==f.organizationId))return res.status(403).send('Demo organization only.');
  const orgPath=req.path.match(/^\/org-organization\/(\d+)/);if(orgPath&&+orgPath[1]!==f.organizationId)return res.sendStatus(403);
  req.session.responsibilityCsrf ||= crypto.randomBytes(24).toString('hex');
  req.session.orgUser={id:f.ownerId,email:EMAIL,organization_id:f.organizationId,organization_name:'Mason Classical Academy — Vivid Demo',organization_role:'organization_admin'};
  req.session.user={id:f.ownerId,login_user_id:f.ownerId,customer_id:f.ownerId,role:'customer',name:'MCA Demo Reviewer',email:EMAIL};
  // Native organization routes expect only the organization identity.
  if(req.path.startsWith('/org-'))delete req.session.user;
  const send=res.send;
  res.send=function(body){
   if(typeof body==='string'&&/<(?:html|body)\b/i.test(body)){
    const banner=`<aside class="mca-review"><strong>MCA · Vivid demonstration</strong><span>Fictional sponsors and simulated activity · No payments or emails sent</span><nav><a href="/demo/portal?view=organization">Organization portal</a><a href="/demo/portal?view=marketplace">Marketplace</a><a href="/demo/portal?view=advertiser">Advertiser portal</a></nav></aside>`;
    const style=`<style>.mca-review{padding:12px 24px;background:#ecf5ef;border-bottom:1px solid #c7decf;font:14px Arial,sans-serif;color:#17452c;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.mca-review nav{display:flex;gap:16px;flex-wrap:wrap}.mca-review a{color:#155c33;font-weight:bold}*{box-sizing:border-box}img{max-width:100%}body{overflow-wrap:anywhere}@media(max-width:700px){.mca-org-nav{position:static!important}.mca-org-nav>div>div:last-child{flex-wrap:nowrap!important;overflow-x:auto;max-width:100%;padding-bottom:6px}.mca-org-nav a{flex:0 0 auto}body{margin:0!important}main{padding:16px!important}h1{font-size:26px!important}.mca-review{padding:12px}table{display:block;overflow-x:auto}input,select,textarea{max-width:100%}[style*="min-width:300px"]{min-width:0!important}[style*="min-width:280px"]{min-width:0!important}[style*="padding:16px 40px"]{padding:12px!important}}</style>`;
    body=body.replace(/<div(\s+style="[^"]*position:sticky;[^"]*")>/gi,'<div class="mca-org-nav"$1>');
    body=body.replace(/<head>/i,'<head><meta name="viewport" content="width=device-width,initial-scale=1">'+style).replace(/<body([^>]*)>/i,'<body$1>'+banner);
    if(req.path.startsWith('/advertise/'))body=body.replace(/<span[^>]*class="marketplace-status"[^>]*>[\s\S]*?<\/span>/g,'').replace(/\$0(?:\.00)?\s*(?:Per Year|Contact School)?/g,'Contact school');
   }
   return send.call(this,body);
  };
  next();
 });
 app.get('/demo/layout-check',(req,res)=>{const views={overview:home(f),marketplace:'/advertise/'+SLUG,advertiser:'/my-setup',inventory:'/org-marketplace?organization_id='+f.organizationId};const src=views[req.query.view]||views.overview;res.send('<!doctype html><html><head><title>MCA mobile layout check</title><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body style=\"margin:0;background:#dce5df;font:14px Arial\"><p style=\"margin:12px\">390px mobile layout check · '+Object.keys(views).map(v=>'<a style=\"margin-right:14px\" href=\"/demo/layout-check?view='+v+'\">'+v+'</a>').join('')+'</p><iframe title=\"Mobile preview\" style=\"display:block;width:390px;height:844px;border:1px solid #a5b8ab;background:white;margin:12px auto\" src=\"'+src+'\"></iframe></body></html>');});
 require('./mca-demo-journey').register(app,{q,f,organizationNav});
}
module.exports={register,prepare};
