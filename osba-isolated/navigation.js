const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function completeNavigation(html,path,query,organizationNav){
 if(typeof html!=='string'||!/<body\b/i.test(html)||/data-osba-navigation/.test(html))return html;
 let nav='';
 if(path.startsWith('/org-')&&!/position\s*:\s*sticky/.test(html)){
  const active={'/org-locations':'locations','/org-marketplace':'marketplace','/org-advertisers':'advertisers','/org-advertising-requests':'advertising-requests','/org-contracts':'contracts','/org-renewals':'renewals','/org-revenue-pipeline':'pipeline','/org-performance':'performance','/org-export':'reports'}[path]||'';
  const params=new URLSearchParams({organization_id:'900001'});
  for(const key of ['from','to','start_date','end_date','location_id'])if(query[key])params.set(key,String(query[key]));
  nav=organizationNav({organizationId:900001,organizationName:'Ohio School Boards Association — Vivid Demo',activePage:active,queryString:params.toString()});
 }else if(['/my-setup','/reports','/reports-qr','/reports-location','/reports-campaign','/admin/reports'].includes(path)){
  const params=new URLSearchParams();
  for(const key of ['from','to','start_date','end_date'])if(query[key])params.set(key,String(query[key]));
  const items=[['My Setup','/my-setup'],['Reports','/reports'],['QR Reports','/reports-qr'],['Location Reports','/reports-location'],['Campaign Reports','/reports-campaign'],['Export Center','/admin/reports']];
  nav='<nav aria-label="Advertiser navigation" style="position:sticky;top:0;z-index:100;display:flex;flex-wrap:wrap;gap:8px;padding:14px 20px;background:white;border-bottom:1px solid #dfe7df">'+items.map(([label,href])=>'<a '+(path===href?'aria-current="page" ':'')+'href="'+href+(params.size?'?'+escape(params.toString()):'')+'" style="display:inline-block;padding:10px 13px;border-radius:8px;background:'+(path===href?'#123d25':'#2f7d46')+';color:white;text-decoration:none;font:bold 14px Arial">'+label+'</a>').join('')+'</nav>';
 }
 return nav?html.replace(/<body\b[^>]*>/i,tag=>tag+'<div data-osba-navigation="true">'+nav+'</div>'):html;
}
