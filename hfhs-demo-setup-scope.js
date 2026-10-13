"use strict";
// Presentation scope for Mike's dedicated HFHS advertiser demo. Does not grant access.
async function filterSetup(q,user,results){
  if(user?.ccpsReview)return require("./ccps-review-access").filterSetup(q,user,results);
  if(String(user.role).toLowerCase()!=="customer" || String(user.email).trim().toLowerCase()!=="michaelandrewdevoe@gmail.com")return;
  const allowed=await q(`SELECT ar.location_id,ar.created_qr_id AS qr_id,ar.created_campaign_id AS campaign_id
    FROM organization_advertising_requests ar
    JOIN organizations o ON o.id=ar.organization_id AND o.slug='henry-ford-health-demo'
    JOIN spaces s ON s.id=ar.location_id AND s.organization_id=o.id AND COALESCE(s.is_archived,false)=false
    JOIN qr_codes qr ON qr.id=ar.created_qr_id AND qr.space_id=s.id AND COALESCE(qr.is_archived,false)=false
    JOIN campaigns c ON c.id=ar.created_campaign_id AND c.organization_id=o.id AND COALESCE(c.is_archived,false)=false
    JOIN qr_campaigns qc ON qc.qr_id=qr.id AND qc.campaign_id=c.id AND COALESCE(qc.is_active,true)=true
    WHERE ar.created_vivid_user_id=$1 AND LOWER(TRIM(ar.status))='approved' AND ar.setup_status IS DISTINCT FROM 'Demo Archived'`,[user.id]);
  const locations=new Set(allowed.rows.map(r=>Number(r.location_id)));
  const qrs=new Set(allowed.rows.map(r=>Number(r.qr_id)));
  const campaigns=new Set(allowed.rows.map(r=>Number(r.campaign_id)));
  const added=await require('./hfhs-review-access').extras(q);
  for(const row of added)(row.kind==='qr'?qrs:campaigns).add(Number(row.entity_id));
  const demoLocations=await q('SELECT id FROM spaces WHERE organization_id=39 AND COALESCE(is_archived,false)=false');
  for(const row of demoLocations.rows)locations.add(Number(row.id));
  const pairs=new Set(allowed.rows.map(r=>`${r.qr_id}:${r.campaign_id}`));
  for(const key of ['locations','qrs','campaigns','archivedCampaigns','relationships','assignments','schedules']){
    const result=results[key];
    result.rows=result.rows.filter(r=>key==='locations'?locations.has(Number(r.id)):
      key==='qrs'?qrs.has(Number(r.id)):
      key==='campaigns'||key==='archivedCampaigns'?campaigns.has(Number(r.id)):
      (pairs.has(`${r.qr_id}:${r.campaign_id}`)||(qrs.has(Number(r.qr_id))&&campaigns.has(Number(r.campaign_id)))));
    result.rowCount=result.rows.length;
  }
}
function install(source){
  source=require("./hfhs-review-access").install(source);
  source=require("./ccps-review-access").install(source);
  const emailMarker='// CAMPAIGN_COLLABORATION_EMAIL_RETURN_V1';
  if(!source.includes(emailMarker)){
    source=source.replaceAll('getOrganizationScope});\napp.get("/my-setup",','getOrganizationScope,sendOrganizationNotification});\napp.get("/my-setup",');
    const orgReturn='/^\\/org-advertising-request\\/\\d+\\?organization_id=\\d+$/';
    if(source.split(orgReturn).length!==3)throw Error('Organization login return anchors missing');
    source=source.replaceAll(orgReturn,'/^\\/org-(?:advertising-request|campaign-help)\\/\\d+\\?organization_id=\\d+$/');
    const loginReturn='if (afterLoginReturn === "/admin/sponsorship-performance" ||';
    if(source.split(loginReturn).length!==2)throw Error('Sponsor login return anchor missing');
    source=source.replace(loginReturn,'if (/^\\/campaign-help\\/[1-9][0-9]*$/.test(afterLoginReturn) || afterLoginReturn === "/admin/sponsorship-performance" ||');
    source+='\n'+emailMarker+'\n';
  }
  const collaborationMarker='// SPONSOR_CAMPAIGN_COLLABORATION_V1';
  if(!source.includes(collaborationMarker)){
    const route='app.get("/my-setup",';
    if(source.split(route).length!==2)throw Error('Campaign collaboration setup route missing');
    source=source.replace(route,collaborationMarker+'\nrequire("./campaign-collaboration").register({app,q,page,orgPage,organizationNav,requireLogin,requireOrganizationPermission,getOrganizationScope,sendOrganizationNotification});\n'+route);
    const edit='<a href="/admin/edit-campaign/${c.id}">Edit</a>';
    const a=source.indexOf(route),b=source.indexOf('\napp.',a+1);let part=source.slice(a,b);
    if(part.split(edit).length!==2)throw Error('Campaign collaboration edit link missing');
    part=part.replace(edit,edit+' &nbsp;|&nbsp; <a href="/campaign-help?campaign_id=${c.id}">Campaign Builder / Request Help</a>');
    source=source.slice(0,a)+part+source.slice(b);
  }

  source=showCampaignButtons(archiveUnderStatus(compactCampaignActions(source)));
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
  if(user?.ccpsReview)return require("./ccps-review-access").reportScope(q,user);
  if(require("./rubber-world-review").isDemo(user))return require("./rubber-world-review").reportScope(q,user);
  if(!isHfhsDemo(user))return null;
  const result=await q(`SELECT DISTINCT ar.location_id,ar.created_qr_id AS qr_id,ar.created_campaign_id AS campaign_id
    FROM organization_advertising_requests ar
    JOIN organizations o ON o.id=ar.organization_id AND o.slug='henry-ford-health-demo'
    JOIN spaces s ON s.id=ar.location_id AND s.organization_id=o.id
    JOIN organization_opportunities oo ON oo.id=ar.opportunity_id AND oo.organization_id=o.id AND oo.space_id=s.id
    JOIN qr_codes qr ON qr.id=ar.created_qr_id AND qr.space_id=s.id
    JOIN campaigns c ON c.id=ar.created_campaign_id AND c.organization_id=o.id
    WHERE ar.created_vivid_user_id=$1 AND LOWER(TRIM(ar.status))='approved' AND ar.setup_status IS DISTINCT FROM 'Demo Archived'
      AND s.name NOT IN ('Fundraising & Signature Events','Trade Shows & Conferences','CME & Medical Education',
        'Community Health Activations','Sports & Strategic Partnerships')`,[user.id]);
  const ids=key=>[...new Set(result.rows.map(r=>Number(r[key])).filter(n=>Number.isSafeInteger(n)&&n>0))];
  const scope={campaignIds:ids('campaign_id'),qrIds:ids('qr_id'),locationIds:ids('location_id')};
  for(const row of await require('./hfhs-review-access').extras(q))scope[row.kind==='qr'?'qrIds':'campaignIds'].push(Number(row.entity_id));
  return scope;
}
function scopedRows(rows,scope,type,key){
  if(!scope)return rows;
  const allowed=new Set(scope[type]);return rows.filter(r=>allowed.has(Number(r[key])));
}
module.exports={filterSetup,install,isHfhsDemo,reportScope,scopedRows};

function compactCampaignActions(source){
  const marker='// COMPACT_CAMPAIGN_ACTIONS_V1';
  if(source.includes(marker))return source;
  const start=source.indexOf('app.get("/my-setup",'),end=source.indexOf('\napp.',start+1);
  let part=source.slice(start,end);
  const anchor='<td>\n  <a href="/admin/view-campaign/${c.id}">View</a>';
  const a=part.indexOf(anchor),b=part.indexOf('</td>',a);
  if(a<0||b<0)throw Error('Campaign action cell missing');
  const cell=part.slice(a,b);
  const links=cell.match(/<a\b[\s\S]*?<\/a>/g)||[];
  if(links.length!==5)throw Error('Expected five campaign actions');
  const view=links.find(l=>l.includes('/admin/view-campaign/'));
  const edit=links.find(l=>l.includes('/admin/edit-campaign/'));
  const help=links.find(l=>l.includes('/campaign-help?'))?.replace('Campaign Builder / Request Help','Request help');
  const visits=links.find(l=>l.includes('/website-pages'));
  const archive=links.find(l=>l.includes('/admin/archive-campaign/'));
  if(!view||!edit||!help||!visits||!archive)throw Error('Campaign action link missing');
  const replacement='<td style="min-width:110px;vertical-align:middle;">'+
    '<div style="display:flex;justify-content:center;gap:14px;white-space:nowrap;">'+view+edit+'</div>'+
    '<details style="margin-top:9px;text-align:left;display:inline-block;">'+
    '<summary style="cursor:pointer;color:#52657b;font-size:13px;font-weight:600;">More</summary>'+
    '<div style="display:flex;flex-direction:column;gap:10px;padding:12px 0 4px;font-size:13px;white-space:nowrap;">'+help+visits+archive+'</div></details>';
  part=part.slice(0,a)+replacement+part.slice(b);
  return source.slice(0,start)+part+source.slice(end)+'\n'+marker+'\n';
}

function archiveUnderStatus(source){
  const marker='// CAMPAIGN_ARCHIVE_UNDER_STATUS_V1';
  if(source.includes(marker))return source;
  const start=source.indexOf('app.get("/my-setup",'),end=source.indexOf('\napp.',start+1);
  let part=source.slice(start,end);
  const re=/<a href="\/admin\/archive-campaign\/\$\{c.id\}"[\s\S]*?<\/a>/g;
  const links=part.match(re)||[];
  if(links.length!==1)throw Error('Campaign archive link missing or ambiguous');
  part=part.replace(re,'');
  const status=part.indexOf('c.is_archived\n      ?');
  const close=part.indexOf('</td>',status);
  if(status<0||close<0)throw Error('Campaign status cell missing');
  const archive=links[0].replace('style="color:red;"','style="color:#b91c1c;font-size:12px;font-weight:500;"');
  part=part.slice(0,close)+'<div style="margin-top:9px;white-space:nowrap;">'+archive+'</div>\n'+part.slice(close);
  return source.slice(0,start)+part+source.slice(end)+'\n'+marker+'\n';
}

function showCampaignButtons(source){
  const marker='// VISIBLE_CAMPAIGN_BUTTONS_V1';
  if(source.includes(marker))return source;
  const start=source.indexOf('app.get("/my-setup",'),end=source.indexOf('\napp.',start+1);
  let part=source.slice(start,end);
  const a=part.indexOf('<td style="min-width:110px;vertical-align:middle;">'),b=part.indexOf('</td>',a);
  if(a<0||b<0)throw Error('Compact campaign action cell missing');
  const links=part.slice(a,b).match(/<a\b[\s\S]*?<\/a>/g)||[];
  if(links.length!==4)throw Error('Expected four campaign actions');
  const buttons=links.map(link=>link.replace('<a href=','<a style="display:block;padding:7px 8px;border:1px solid #dbe4ef;border-radius:7px;background:#f5f8fc;color:#245ab8;text-decoration:none;font-size:12px;font-weight:600;line-height:1.25;white-space:nowrap;" href=')).join('');
  part=part.slice(0,a)+'<td style="min-width:175px;vertical-align:middle;"><div style="display:grid;grid-template-columns:repeat(2,max-content);justify-content:center;gap:7px;">'+buttons+'</div>'+part.slice(b);
  return source.slice(0,start)+part+source.slice(end)+'\n'+marker+'\n';
}
