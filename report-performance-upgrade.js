"use strict";
const crypto=require("node:crypto");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const paths=new Set(["/reports","/reports-qr","/reports-campaign","/reports-location"]);
function reportReturn(value){
  try{
    if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//"))return "/reports";
    const u=new URL(value,"https://vivid.invalid");
    if(u.origin!=="https://vivid.invalid"||!paths.has(u.pathname))return "/reports";
    const out=new URLSearchParams();
    for(const key of ["start_date","end_date"]){const v=u.searchParams.get(key);if(/^\d{4}-\d{2}-\d{2}$/.test(v||""))out.set(key,v);}
    const status=u.searchParams.get("status");
    if(["active","archived","all"].includes(status))out.set("status",status);
    return u.pathname+(out.size?"?"+out:"");
  }catch{return "/reports";}
}
async function load({q,req}){
  const user=req.session?.user;
  if(!user||["super_admin","admin","platform"].includes(user.role))return {rows:[]};
  const hfhsScope=await require("./hfhs-demo-setup-scope").reportScope(q,user);
  let rows=(await q(`
    SELECT DISTINCT qr.id AS qr_id,qr.name AS qr_name,qr.space_id AS location_id,
      s.name AS location_name,qc.campaign_id,spp.status
    FROM sponsorship_performance_plans spp
    JOIN qr_codes qr ON qr.id=spp.qr_id
    JOIN spaces s ON s.id=qr.space_id
    JOIN organization_advertising_requests ar ON ar.created_qr_id=qr.id AND ar.status='Approved'
    LEFT JOIN users owner ON owner.id=ar.created_vivid_user_id
    LEFT JOIN qr_campaigns qc ON qc.qr_id=qr.id
    WHERE spp.plan='basic' AND spp.status IN ('active','upgrade_requested')
      AND (ar.created_vivid_user_id=$1 OR ar.created_vivid_user_id=$2 OR owner.advertiser_customer_id=$2)
    ORDER BY qr.id,qc.campaign_id
  `,[Number(user.login_user_id||user.id),Number(user.id)])).rows;
  rows=require("./hfhs-demo-setup-scope").scopedRows(rows,hfhsScope,"qrIds","qr_id");
  if(rows.length)req.session.sponsorshipPerformanceCsrf||=crypto.randomBytes(32).toString("hex");
  return {rows,hfhsScope,hideUpgrade:Boolean(hfhsScope),csrf:req.session.sponsorshipPerformanceCsrf,returnTo:reportReturn(req.originalUrl)};
}
function render(state,key,id){
  if(state.hideUpgrade)return "";
  const rows=[...new Map((state.rows||[]).filter(r=>Number(r[key])===Number(id)).map(r=>[r.qr_id,r])).values()];
  return rows.map(r=>`<div style="margin-top:10px;font-size:13px;white-space:normal;text-align:left">
    ${key!=="qr_id"?`<div>${esc(r.qr_name)} · ${esc(r.location_name)}</div>`:""}
    ${r.status==="upgrade_requested"?'<strong>Upgrade requested</strong><div>We’ll contact you to complete activation.</div>':`<form method="post" action="/admin/sponsorship-performance/upgrade">
      <input type="hidden" name="csrf" value="${esc(state.csrf)}">
      <input type="hidden" name="qr_id" value="${Number(r.qr_id)}">
      <input type="hidden" name="return_to" value="${esc(state.returnTo)}">
      <button class="btn" style="margin-top:6px;white-space:normal" type="submit">Request Vivid Performance — $35/month</button>
    </form>`}
  </div>`).join("");
}
function intro(state){return !state.hideUpgrade && state.rows?.length?'<p style="margin:16px 0">Basic includes scans; other performance metrics show a dash until upgraded. <strong>Vivid Performance — $35/month per placement</strong> adds website activity, conversions, revenue, ROI and campaign scheduling. Request an upgrade beside your placement below.</p>':"";}
// Mixed aggregates containing a Basic placement must not expose that placement's
// paid metrics. Performance-only rows and platform administrators remain unchanged.
function restricted(state,key,id){return (state.rows||[]).some(r=>Number(r[key])===Number(id));}
function maskRow(state,key,id,scanIndex,html){
  if(!restricted(state,key,id))return html;
  let index=0;
  return html.replace(/<td\b[^>]*>[\s\S]*?<\/td>/g,cell=>{
    if(index++<=scanIndex)return cell;
    return '<td style="text-align:center;" aria-label="Available with Vivid Performance">—</td>';
  });
}
function filterWebsiteReport(report,state){
  if(state.hfhsScope){
    const filter=(rows,key)=>require("./hfhs-demo-setup-scope").scopedRows(rows,state.hfhsScope,"campaignIds",key);
    const rows=filter(report.rows,'campaign_id');
    report={...report,rows,pages:filter(report.pages,'campaign_id'),campaigns:filter(report.campaigns,'id'),total:rows.reduce((n,r)=>n+Number(r.visits),0)};
  }
  const denied=new Set((state.rows||[]).map(r=>Number(r.campaign_id)).filter(n=>n>0));
  if(!denied.size)return report;
  const rows=report.rows.filter(r=>!denied.has(Number(r.campaign_id)));
  const pages=report.pages.filter(r=>!denied.has(Number(r.campaign_id)));
  const campaigns=report.campaigns.filter(r=>!denied.has(Number(r.id)));
  return {...report,rows,pages,campaigns,basicMetricsHidden:report.campaigns.some(r=>denied.has(Number(r.id))),total:rows.reduce((n,r)=>n+Number(r.visits),0)};
}
module.exports={load,render,intro,reportReturn,restricted,maskRow,filterWebsiteReport};
