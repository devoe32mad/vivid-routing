"use strict";
// Presentation scope for Mike's dedicated HFHS advertiser demo. Does not grant access.
async function filterSetup(q,user,results){
  if(String(user.role).toLowerCase()!=="customer" || String(user.email).trim().toLowerCase()!=="michaelandrewdevoe@gmail.com")return;
  const allowed=await q(`SELECT ar.location_id,ar.created_qr_id AS qr_id,ar.created_campaign_id AS campaign_id
    FROM organization_advertising_requests ar
    JOIN organizations o ON o.id=ar.organization_id AND o.slug='henry-ford-health-demo'
    JOIN spaces s ON s.id=ar.location_id AND s.organization_id=o.id AND COALESCE(s.is_archived,false)=false
    JOIN qr_codes qr ON qr.id=ar.created_qr_id AND qr.space_id=s.id AND COALESCE(qr.is_archived,false)=false
    JOIN campaigns c ON c.id=ar.created_campaign_id AND c.organization_id=o.id AND COALESCE(c.is_archived,false)=false
    JOIN qr_campaigns qc ON qc.qr_id=qr.id AND qc.campaign_id=c.id AND COALESCE(qc.is_active,true)=true
    WHERE ar.created_vivid_user_id=$1 AND LOWER(TRIM(ar.status))='approved'`,[user.id]);
  const locations=new Set(allowed.rows.map(r=>Number(r.location_id)));
  const qrs=new Set(allowed.rows.map(r=>Number(r.qr_id)));
  const campaigns=new Set(allowed.rows.map(r=>Number(r.campaign_id)));
  const pairs=new Set(allowed.rows.map(r=>`${r.qr_id}:${r.campaign_id}`));
  for(const key of ['locations','qrs','campaigns','archivedCampaigns','relationships','assignments','schedules']){
    const result=results[key];
    result.rows=result.rows.filter(r=>key==='locations'?locations.has(Number(r.id)):
      key==='qrs'?qrs.has(Number(r.id)):
      key==='campaigns'||key==='archivedCampaigns'?campaigns.has(Number(r.id)):
      pairs.has(`${r.qr_id}:${r.campaign_id}`));
    result.rowCount=result.rows.length;
  }
}
function install(source){
  const marker='// HFHS_DEMO_SETUP_SCOPE_V1';
  if(source.includes(marker))return source;
  const start=source.indexOf('app.get("/my-setup",');
  const anchor='    const hasLocations = locations.rows.length > 0;';
  const pos=source.indexOf(anchor,start);
  if(start<0 || pos<0)throw new Error('HFHS setup scope anchor missing');
  return source.slice(0,pos)+`${marker}\n    await require("./hfhs-demo-setup-scope").filterSetup(q,currentUser,{locations,qrs,campaigns,archivedCampaigns,relationships,assignments,schedules});\n`+source.slice(pos);
}
function isHfhsDemo(user){
  return String(user?.role).toLowerCase()==="customer" && String(user?.email||"").trim().toLowerCase()==="michaelandrewdevoe@gmail.com";
}
async function reportScope(q,user){
  if(!isHfhsDemo(user))return null;
  const result=await q(`SELECT DISTINCT ar.location_id,ar.created_qr_id AS qr_id,ar.created_campaign_id AS campaign_id
    FROM organization_advertising_requests ar
    JOIN organizations o ON o.id=ar.organization_id AND o.slug='henry-ford-health-demo'
    JOIN spaces s ON s.id=ar.location_id AND s.organization_id=o.id
    JOIN organization_opportunities oo ON oo.id=ar.opportunity_id AND oo.organization_id=o.id AND oo.space_id=s.id
    JOIN qr_codes qr ON qr.id=ar.created_qr_id AND qr.space_id=s.id
    JOIN campaigns c ON c.id=ar.created_campaign_id AND c.organization_id=o.id
    WHERE ar.created_vivid_user_id=$1 AND LOWER(TRIM(ar.status))='approved'
      AND s.name NOT IN ('Fundraising & Signature Events','Trade Shows & Conferences','CME & Medical Education',
        'Community Health Activations','Sports & Strategic Partnerships')`,[user.id]);
  const ids=key=>[...new Set(result.rows.map(r=>Number(r[key])).filter(n=>Number.isSafeInteger(n)&&n>0))];
  return {campaignIds:ids('campaign_id'),qrIds:ids('qr_id'),locationIds:ids('location_id')};
}
function scopedRows(rows,scope,type,key){
  if(!scope)return rows;
  const allowed=new Set(scope[type]);return rows.filter(r=>allowed.has(Number(r[key])));
}
module.exports={filterSetup,install,isHfhsDemo,reportScope,scopedRows};
