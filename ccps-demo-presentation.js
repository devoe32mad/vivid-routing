'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(q,path){
 if(!(/^\/advertise\/ccps(?:\/|$)/.test(path)||['/org-organization/13','/org-locations'].includes(path)))return [];
 return (await q(`SELECT DISTINCT ON (s.id) s.id AS location_id,s.name,oo.id AS photo_id
 FROM spaces s JOIN organization_opportunities oo ON oo.space_id=s.id AND oo.organization_id=s.organization_id
 WHERE s.organization_id=13 AND COALESCE(s.is_archived,false)=false
 AND COALESCE(oo.is_active,true)=true AND oo.photo_data IS NOT NULL
 ORDER BY s.id,oo.display_order,oo.id`)).rows;
}
function render(body,schools){
 // Use the uploaded sponsorship artwork already associated with each school.
 // Never borrow another organization's images or replace opportunity-specific artwork.
 for(const school of schools){
  const name=esc(school.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp('(<(?:h[123]|div)\\b[^>]*>\\s*'+name+'\\s*</(?:h[123]|div)>)');
  const photo=`<img class="ccps-school-photo" src="/org-opportunity/${Number(school.photo_id)}/photo?ccps_demo=2" alt="${esc(school.name)} sponsorship illustration" style="display:block;width:100%;max-width:760px;height:200px;object-fit:cover;object-position:center;border-radius:12px;margin:0 auto 16px" >`;
  body=body.replace(pattern,photo+'$1');
 }
 // A new version avoids retaining failed image responses from the earlier demo guard.
 body=body.replace(/(src=["']\/org-opportunity\/\d+\/photo)(["'])/g,'$1?ccps_demo=2$2');
 return body;
}
module.exports={load,render};
