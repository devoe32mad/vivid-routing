'use strict';
// Add contract-backed placements only inside the verified CCPS preview.
async function reconcile(q, {organizationId, advertiserId, locationIds, qrResult, locationResult}) {
 const {rows}=await q(`SELECT c.id AS contract_id,c.contract_name,c.total_contract_value,
 qr.id,qr.name,qr.is_active,s.id AS location_id,s.name AS location_name,s.location
 FROM contracts c JOIN organization_advertising_requests ar ON ar.id=c.advertising_request_id
 JOIN qr_codes qr ON qr.id=ar.created_qr_id
 JOIN spaces s ON s.id=c.location_id AND s.organization_id=c.organization_id
 WHERE c.organization_id=$1 AND c.advertiser_id=$2 AND s.id=ANY($3::int[])
 AND COALESCE(s.is_archived,false)=false AND COALESCE(qr.is_archived,false)=false
 AND LOWER(COALESCE(c.status,'active')) NOT IN ('cancelled','inactive','closed lost')
 ORDER BY c.id`,[organizationId,advertiserId,locationIds]);
 for(const row of rows){
  const placement={...row,placement_value:row.total_contract_value};
  const existing=qrResult.rows.find(qr=>Number(qr.id)===Number(row.id));
  if(existing)Object.assign(existing,placement);else qrResult.rows.push(placement);
  if(!locationResult.rows.some(s=>Number(s.id)===Number(row.location_id)))locationResult.rows.push({id:row.location_id,name:row.location_name,location:row.location,campaigns:0});
 }
 for(const location of locationResult.rows)location.qr_placements=new Set(qrResult.rows.filter(qr=>Number(qr.location_id)===Number(location.id)).map(qr=>qr.id)).size;
}
function install(source){
 const marker='// CCPS_ADVERTISER_DETAIL_V1';if(source.includes(marker))return source;
 const start=source.indexOf('  "/org-advertiser/:advertiserKey",');
 const end=source.indexOf('  "/org-advertiser/:advertiserKey/relationship/edit",',start);
 if(start<0||end<0)throw Error('CCPS advertiser route missing');
 let part=source.slice(start,end);
 const replace=(a,b)=>{if(part.split(a).length!==2)throw Error('CCPS advertiser anchor missing: '+a.slice(0,70));part=part.replace(a,b);};
 replace('    LIMIT 1\n  `,\n  [\n    organizationId,\n    relationship.id || null', '    ${req.ccpsReviewVerified ? "" : "LIMIT 1"}\n  `,\n  [\n    organizationId,\n    relationship.id || null');
 replace('      const locationCards =',`      ${marker}
      if(req.ccpsReviewVerified)await require('./ccps-advertiser-detail').reconcile(q,{organizationId,advertiserId:relationship.id,locationIds:contractLocationIds,qrResult,locationResult});
      const locationCards =`);
 replace('href="/org-qr/${qr.id}?organization_id=', 'href="/${req.ccpsReviewVerified && qr.contract_id ? "org-contract/"+qr.contract_id : "org-qr/"+qr.id}?organization_id=');
 replace('              Open QR →','              ${req.ccpsReviewVerified && qr.contract_id ? "Open Contract →" : "Open QR →"}');
 replace('  currentContract\n    ? `','  currentContract\n    ? (req.ccpsReviewVerified ? `<div class="card"><strong>Total Sponsorship: ${money(currentContractResult.rows.reduce((sum, c) => sum + Number(c.total_contract_value || 0), 0))}</strong> · ${currentContractResult.rows.length} contracts</div>` : "") + (req.ccpsReviewVerified ? currentContractResult.rows : [currentContract]).map(currentContract => `');
 replace('              Contract & Renewal','              ${req.ccpsReviewVerified ? "Contracts & Renewals" : "Contract & Renewal"}');
 replace('    `\n    : `\n      <div\n        class="card"\n        style="margin:0 0 30px;"','    `).join("")\n    : `\n      <div\n        class="card"\n        style="margin:0 0 30px;"');
 return source.slice(0,start)+part+source.slice(end);
}
module.exports={reconcile,install};
