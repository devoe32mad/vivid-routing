'use strict';
module.exports=function requestLocationCards(rows,org,escapeHtml){
 const link=(href,label,count)=>`<a href="${escapeHtml(href)}" style="display:flex;justify-content:space-between;gap:16px;color:#176b3a;text-decoration:none;padding:7px 0"><span>${label}</span><strong>${Number(count||0)}</strong></a>`;
 return rows.map(location=>{
  const id=Number(location.location_id),requests=`/org-advertising-requests?organization_id=${Number(org)}&location_id=${id}`;
  const inventory=`/org-marketplace?organization_id=${Number(org)}&location_id=${id}&status=Available`;
  return `<article class="marketplace-card" style="display:flex;flex-direction:column;padding:22px;border:1px solid #dce5dd;border-radius:18px;background:white;color:#173f2a">
  <h2 style="font-size:20px;line-height:1.3;margin:0 0 18px;padding-bottom:17px;border-bottom:1px solid #e7eee7">${escapeHtml(location.location_name||'Unnamed Location')}</h2>
  ${link(inventory,'Available Opportunities',location.available_opportunities)}
  ${['Pending','Approved','Rejected','Closed'].map(status=>link(requests+'&status='+status,status,location[status.toLowerCase()+'_requests'])).join('')}
  <div style="border-top:1px solid #e7eee7;margin-top:18px;padding-top:12px">${link(requests,'Total Requests',location.total_requests)}</div>
  <div style="display:flex;gap:14px;flex-wrap:wrap;padding-top:20px;margin-top:auto;font-weight:700"><a style="color:#176b3a" href="${escapeHtml(inventory)}">View Available →</a><a style="color:#176b3a" href="${escapeHtml(requests)}">Open Requests →</a></div></article>`;
 }).join('')||'<div class="marketplace-card">No active locations were found.</div>';
};
