'use strict';
// Complete navigation only inside an already verified demo session.
let organizationNav;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function configure(renderer){organizationNav=renderer;}
function attach(req,res){
 const demo=req.hfhsReviewVerified?'hfhs':req.ccpsReviewVerified?'ccps':req.rubberWorldReviewVerified?'rubber-world':null;
 if(!demo||req.demoNavigationAttached||req.method!=='GET')return;
 req.demoNavigationAttached=true;
 const send=res.send;
 res.send=function(body){
  if(typeof body!=='string'||!/<body\b/i.test(body)||/data-demo-portal-navigation/.test(body))return send.call(this,body);
  let nav='';
  if(req.path.startsWith('/org-')&&!/position\s*:\s*sticky/.test(body)&&organizationNav){
   const organizationId=demo==='hfhs'?39:demo==='ccps'?13:Number(req.session.rubberWorldReview.org);
   const organizationName=demo==='hfhs'?'Henry Ford Health System':demo==='ccps'?'CCPS':'Rubber World Magazine';
   const query=new URLSearchParams({organization_id:String(organizationId)});
   for(const key of ['from','to','start_date','end_date','location_id'])if(req.query[key])query.set(key,String(req.query[key]));
   const active={'/org-locations':'locations','/org-advertisers':'advertisers','/org-marketplace':'marketplace','/org-advertising-requests':'advertising-requests','/org-export':'reports'}[req.path]||'';
   nav=organizationNav({organizationId,organizationName,activePage:active,queryString:query.toString(),showAdministration:false});
   if(demo==='ccps')nav=nav.replace(/Sales Reps/g,'School Contacts').replace(/Sales Rep Report/g,'School Responsibility Report');
   if(demo==='rubber-world')nav=nav.replace(/Locations/g,'Issues / Editions').replace(/Programs/g,'Channels');
  }else if(['/my-setup','/reports','/reports-qr','/reports-location','/reports-campaign','/admin/reports'].includes(req.path)){
   const query=new URLSearchParams();
   for(const key of ['start_date','end_date','from','to'])if(req.query[key])query.set(key,String(req.query[key]));
   const items=[['My Setup','/my-setup'],['Reports','/reports'],['QR Reports','/reports-qr'],[demo==='rubber-world'?'Issue / Edition Reports':'Location Reports','/reports-location'],['Campaign Reports','/reports-campaign'],['Export Center','/admin/reports']];
   nav='<nav aria-label="Advertiser navigation" style="position:sticky;top:0;z-index:100;display:flex;flex-wrap:wrap;gap:8px;padding:14px 20px;background:white;border-bottom:1px solid #dfe7df">'+items.map(([label,path])=>'<a '+(req.path===path?'aria-current="page" ':'')+'href="'+path+(query.size?'?'+escape(query.toString()):'')+'" style="display:inline-block;padding:10px 13px;border-radius:8px;background:'+(req.path===path?'#123d25':'#2f7d46')+';color:white;text-decoration:none;font:bold 14px Arial">'+label+'</a>').join('')+'</nav>';
  }
  if(nav)body=body.replace(/<body\b[^>]*>/i,tag=>tag+'<div data-demo-portal-navigation="'+demo+'">'+nav+'</div>');
  return send.call(this,body);
 };
}
module.exports={configure,attach};
