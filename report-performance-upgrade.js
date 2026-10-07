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
    return u.pathname+(out.size?"?"+out:"");
  }catch{return "/reports";}
}
async function load({q,req}){
  const user=req.session?.user;
  if(!user||["super_admin","admin","platform"].includes(user.role))return {rows:[]};
  const rows=(await q(`
    SELECT DISTINCT qr.id AS qr_id,qr.name AS qr_name,qr.space_id AS location_id,
      s.name AS location_name,qc.campaign_id,spp.status
    FROM sponsorship_performance_plans spp
    JOIN qr_codes qr ON qr.id=spp.qr_id
    JOIN spaces s ON s.id=qr.space_id
    JOIN organization_advertising_requests ar ON ar.created_qr_id=qr.id AND ar.status='Approved'
    LEFT JOIN users owner ON owner.id=ar.created_vivid_user_id
    LEFT JOIN qr_campaigns qc ON qc.qr_id=qr.id AND COALESCE(qc.is_active,true)=true
    WHERE spp.plan='basic' AND spp.status IN ('active','upgrade_requested')
      AND (ar.created_vivid_user_id=$1 OR ar.created_vivid_user_id=$2 OR owner.advertiser_customer_id=$2)
    ORDER BY qr.id,qc.campaign_id
  `,[Number(user.login_user_id||user.id),Number(user.id)])).rows;
  if(rows.length)req.session.sponsorshipPerformanceCsrf||=crypto.randomBytes(32).toString("hex");
  return {rows,csrf:req.session.sponsorshipPerformanceCsrf,returnTo:reportReturn(req.originalUrl)};
}
function render(state,key,id){
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
function intro(state){return state.rows?.length?'<p style="margin:16px 0">Basic includes scan reporting. <strong>Vivid Performance — $35/month per placement</strong> adds website activity, conversions, revenue, ROI and campaign scheduling. Request an upgrade beside your placement below.</p>':"";}
module.exports={load,render,intro,reportReturn};
