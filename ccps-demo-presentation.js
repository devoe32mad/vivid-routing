'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(q,path){
 if(!(/^\/advertise\/ccps(?:\/|$)/.test(path)||['/org-organization/13','/org-locations','/org-marketplace'].includes(path)))return [];
 return (await q(`SELECT DISTINCT ON (s.id) s.id AS location_id,s.name,oo.id AS photo_id
 FROM spaces s JOIN organization_opportunities oo ON oo.space_id=s.id AND oo.organization_id=s.organization_id
 WHERE s.organization_id=13 AND COALESCE(s.is_archived,false)=false
 AND COALESCE(oo.is_active,true)=true AND oo.photo_data IS NOT NULL
 ORDER BY s.id,oo.display_order,oo.id`)).rows;
}
function render(body,schools,path){
 if(path==='/org-marketplace'){
  for(const [from,to] of [
   ['Manage inventory by event type, actual event, and sponsorship opportunity.','Manage inventory by program, school, and sponsorship opportunity.'],
   ['Choose a type of event to manage its events and sponsorship inventory.','Choose a program to manage its schools and sponsorship inventory.'],
   ['Choose an actual event to manage the sponsorship opportunities inside it.','Choose a school to manage its sponsorship opportunities.'],
   ['>Event Types<','>Programs<'],['>Event Type<','>Program<'],['>Actual Event<','>School<'],['View Events →','View Schools →']
  ])body=body.split(from).join(to);
  body=body.replace(/(>\d+) event(s?)( · )/g,'$1 school$2$3');
 }

 // Use the uploaded sponsorship artwork already associated with each school.
 // Never borrow another organization's images or replace opportunity-specific artwork.
 body=body.replace('event signage, a golf hole sign, an exhibit booth, a program ad or a handout','school fence banners, gym signage, scoreboards, printed programs or handouts').replace('not required to sponsor this event','not required to sponsor this school');
 for(const school of (path?.includes('/opportunity/')?[]:schools)){
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
async function available(q){
 const rows=(await q(`SELECT s.id,s.name,COUNT(*)::int AS spots,
 CASE WHEN COUNT(DISTINCT oo.program_id)=1 THEN MIN(oo.program_id) END AS program_id,
 COALESCE(SUM(COALESCE(oo.price,oo.annual_price,0)),0)::numeric AS value
 FROM organization_opportunities oo JOIN spaces s ON s.id=oo.space_id AND s.organization_id=oo.organization_id
 WHERE oo.organization_id=13 AND COALESCE(s.is_archived,false)=false
 AND COALESCE(oo.is_active,true)=true AND LOWER(COALESCE(oo.status,''))='available'
 AND (oo.available_from IS NULL OR oo.available_from<=CURRENT_DATE)
 AND (oo.available_until IS NULL OR oo.available_until>=CURRENT_DATE)
 GROUP BY s.id,s.name ORDER BY s.name`)).rows;
 const money=v=>Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
 return `<!doctype html><html><head><title>CCPS Available Advertising</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f4f7f5;color:#24382c;font:16px system-ui}main{max-width:1080px;margin:32px auto;padding:20px}a{color:#176b3a}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}.school{display:block;background:white;border:1px solid #dbe5dd;border-radius:16px;padding:24px;text-decoration:none;color:inherit}.value{font-size:30px;font-weight:700}.muted{color:#65776b}</style></head><body><main><a href="/org-organization/13?organization_id=13">← Back to Overview</a><h1>Available Advertising</h1><p class="muted">Current CCPS sponsorship inventory by school.</p><p><strong>${rows.reduce((n,r)=>n+Number(r.spots),0)} available spots · ${money(rows.reduce((n,r)=>n+Number(r.value),0))} available sponsorship value</strong></p><div class="grid">${rows.map(r=>`<a class="school" href="/org-marketplace?organization_id=13&location_id=${Number(r.id)}&status=Available${r.program_id?'&program_id='+Number(r.program_id):''}"><h2>${esc(r.name)}</h2><p>${Number(r.spots)} available sponsorships</p><div class="value">${money(r.value)}</div><p class="muted">Available sponsorship value</p><strong>View available inventory →</strong></a>`).join('')||'<p>No sponsorships are currently available.</p>'}</div></main></body></html>`;
}
module.exports.available=available;
