"use strict";

const esc = value => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function validateProfile(input = {}) {
  const allowedGoals = ["revenue","conversions","leads","traffic","awareness"];
  const allowedModes = ["observe","recommend","approval","autopilot"];
  const goal = String(input.goal || "").trim().toLowerCase();
  const desiredMode = String(input.desired_mode || "observe").trim().toLowerCase();
  const monthlyBudget = num(input.monthly_budget);
  const maxAutoChangePct = num(input.max_auto_change_pct);
  const channels = (Array.isArray(input.approved_channels) ? input.approved_channels : [input.approved_channels])
    .flatMap(value => String(value || "").split(",")).map(value => value.trim().toLowerCase()).filter(Boolean);
  const errors = [];
  if (goal && !allowedGoals.includes(goal)) errors.push("Select a valid primary goal.");
  if (!allowedModes.includes(desiredMode)) errors.push("Select a valid AI operating mode.");
  if (monthlyBudget < 0 || monthlyBudget > 100000000) errors.push("Monthly budget is outside the supported range.");
  if (maxAutoChangePct < 0 || maxAutoChangePct > 25) errors.push("Automatic changes must be capped between 0% and 25%.");
  return {valid:!errors.length,errors,value:{
    goal,monthlyBudget,targetGeography:String(input.target_geography||"").trim().slice(0,300),
    targetCustomer:String(input.target_customer||"").trim().slice(0,500),targetMetric:String(input.target_metric||"").trim().slice(0,80),
    targetValue:num(input.target_value),approvedOffers:String(input.approved_offers||"").trim().slice(0,1000),
    prohibitedActions:String(input.prohibited_actions||"").trim().slice(0,1000),channels:[...new Set(channels)],
    desiredMode,maxAutoChangePct,approvalRequired:input.approval_required === "on" || input.approval_required === true
  }};
}

function scoreReadiness(facts = {}, profile = {}) {
  const campaigns=num(facts.campaigns),costCampaigns=num(facts.cost_campaigns),scans=num(facts.scans),conversions=num(facts.conversions);
  const revenue=num(facts.conversion_value),destinations=num(facts.destinations),days=facts.latest_event_at ? Math.max(0,(Date.now()-new Date(facts.latest_event_at).getTime())/86400000) : Infinity;
  const evidence=[];
  const add=(key,label,weight,earned,proof,fix,href="")=>evidence.push({key,label,weight,earned:Math.round(Math.max(0,Math.min(weight,earned))),proof,fix,href});
  add("instructions","Operating instructions",20,
    (profile.goal?5:0)+(profile.monthlyBudget>0?5:0)+(profile.targetCustomer?3:0)+(profile.targetGeography?2:0)+(profile.channels?.length?3:0)+(profile.targetMetric?2:0),
    profile.goal?`${profile.goal} goal · $${num(profile.monthlyBudget).toLocaleString()} monthly ceiling`:"No complete AI operating brief is saved.",
    "Define the goal, audience, budget and approved channels.");
  add("measurement","Revenue-grade measurement",30,
    (campaigns?Math.min(10,10*costCampaigns/campaigns):0)+(conversions>0?10:0)+(revenue>0?10:0),
    `${costCampaigns}/${campaigns} campaigns have cost · ${conversions} conversions · $${revenue.toLocaleString()} attributed value`,
    conversions?"Add reliable conversion value and fill remaining campaign costs.":"Instrument a real conversion and assign its value.");
  add("volume","Decision sample",20,Math.min(8,scans/100*8)+Math.min(12,conversions/20*12),
    `${scans} scans and ${conversions} conversions available for learning.`,"Collect at least 100 scans and 20 verified conversions.");
  add("freshness","Freshness",10,days<=7?10:days<=30?7:days<=90?3:0,
    Number.isFinite(days)?`Latest evidence is ${Math.floor(days)} day${Math.floor(days)===1?"":"s"} old.`:"No measured activity is available.",
    "Run a current tracked campaign so Vivid learns from recent behavior.");
  add("destinations","Execution foundation",10,destinations>0?10:0,
    destinations?`${destinations} active campaign destination${destinations===1?" is":"s are"} configured.`:"No active destination is configured.",
    "Add a measurable campaign destination.");
  add("guardrails","Autonomy controls",10,
    (profile.desiredMode?2:0)+(profile.approvalRequired?3:0)+(profile.prohibitedActions?2:0)+(profile.maxAutoChangePct>0&&profile.maxAutoChangePct<=25?3:0),
    profile.approvalRequired?`Approval required · automatic change cap ${num(profile.maxAutoChangePct)}%.`:"Approval and automatic-change limits are incomplete.",
    "Require approval and set a maximum automatic change percentage.");
  const score=evidence.reduce((sum,item)=>sum+item.earned,0);
  const critical={instructions:!!profile.goal&&profile.monthlyBudget>0,campaigns:campaigns>0,measurement:conversions>0&&revenue>0,fresh:days<=30,sample:conversions>=20&&scans>=100,guardrails:!!profile.approvalRequired&&profile.maxAutoChangePct>0&&profile.maxAutoChangePct<=25};
  let level="Not Ready",mode="Observe",explanation="Vivid is missing the minimum instructions or campaign evidence needed to learn safely.";
  if(critical.instructions&&critical.campaigns){level="Learning";mode="Observe";explanation="Vivid can measure and learn, but should not make performance claims yet.";}
  if(score>=60&&critical.measurement&&["recommend","approval","autopilot"].includes(profile.desiredMode)){level="Recommendation Ready";mode="Recommend";explanation="Vivid can explain evidence-backed recommendations, with no automatic changes.";}
  if(score>=75&&critical.measurement&&critical.fresh&&profile.approvalRequired&&["approval","autopilot"].includes(profile.desiredMode)){level="Approval Mode Ready";mode="Execute after approval";explanation="Vivid can prepare actions, but an authorized person must approve every change.";}
  if(score>=85&&Object.values(critical).every(Boolean)&&profile.channels?.length&&profile.desiredMode==="autopilot"){level="Autopilot Ready";mode="Bounded Autopilot";explanation="Vivid may act only inside the saved budget, channel and change limits, with a complete audit trail.";}
  const nextProof=evidence.filter(item=>item.earned<item.weight).sort((a,b)=>(b.weight-b.earned)-(a.weight-a.earned))[0]||null;
  return {score,level,mode,explanation,evidence,nextProof,critical};
}

function renderReadinessCenter({title="AI Readiness Center",profile={},readiness,action,backHref="",saved=false}) {
  const channelSet=new Set(profile.channels||[]); const colors=readiness.level==="Autopilot Ready"?["#166534","#dcfce7"]:readiness.level.includes("Ready")?["#1d4ed8","#dbeafe"]:["#92400e","#fef3c7"];
  const field=(label,name,value,type="text",extra="")=>`<label style="display:grid;gap:6px;font-weight:800;color:#19324d;">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra} style="padding:11px;border:1px solid #cbd5e1;border-radius:9px;font:inherit;"></label>`;
  return `<main style="max-width:1180px;margin:0 auto;padding:28px 22px 55px;font-family:Arial,sans-serif;color:#102b50;">
  <section style="background:linear-gradient(135deg,#071b33,#1559c7);color:#fff;border-radius:20px;padding:26px;box-shadow:0 18px 40px rgba(15,52,96,.18);"><div style="font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#bfdbfe;">Vivid Evidence Passport</div><h1 style="margin:7px 0;">${esc(title)}</h1><p style="margin:0;max-width:820px;color:#dbeafe;line-height:1.55;">Vivid does not unlock AI actions from a score alone. It verifies the evidence, confidence boundary and operating limits required for each level of autonomy.</p></section>
  ${saved?'<div style="margin-top:16px;padding:12px 15px;background:#dcfce7;color:#166534;border-radius:10px;font-weight:800;">Operating instructions saved and readiness recalculated.</div>':""}
  <section style="display:grid;grid-template-columns:220px 1fr;gap:20px;margin-top:20px;align-items:stretch;"><div style="border-radius:18px;background:${colors[1]};padding:22px;text-align:center;border:1px solid ${colors[0]}33;"><div style="font-size:58px;font-weight:900;color:${colors[0]};">${readiness.score}</div><div style="font-size:12px;font-weight:900;text-transform:uppercase;color:${colors[0]};">Readiness / 100</div></div><div style="border-radius:18px;background:#fff;padding:22px;border:1px solid #dbe5f0;"><div style="display:inline-block;padding:7px 11px;border-radius:999px;background:${colors[1]};color:${colors[0]};font-weight:900;">${esc(readiness.level)}</div><h2 style="margin:13px 0 6px;">Permitted action: ${esc(readiness.mode)}</h2><p style="margin:0;color:#52667e;line-height:1.5;">${esc(readiness.explanation)}</p>${readiness.nextProof?`<div style="margin-top:15px;padding:13px;border-left:4px solid #f59e0b;background:#fffbeb;"><strong>Next Best Proof:</strong> ${esc(readiness.nextProof.fix)}</div>`:""}</div></section>
  <h2 style="margin:26px 0 12px;">Evidence Passport</h2><section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(285px,1fr));gap:13px;">${readiness.evidence.map(item=>`<article style="border:1px solid #dbe5f0;border-radius:14px;background:#fff;padding:17px;"><div style="display:flex;justify-content:space-between;gap:12px;"><strong>${esc(item.label)}</strong><strong style="color:#1559c7;">${item.earned}/${item.weight}</strong></div><div style="height:7px;background:#e8eef8;border-radius:99px;margin:11px 0;overflow:hidden;"><div style="height:100%;width:${item.weight?item.earned/item.weight*100:0}%;background:#1559c7;"></div></div><p style="font-size:13px;color:#52667e;line-height:1.45;margin:0;">${esc(item.proof)}</p>${item.earned<item.weight?`<p style="font-size:12px;color:#8a5a00;margin:9px 0 0;"><strong>To improve:</strong> ${esc(item.fix)}</p>`:""}</article>`).join("")}</section>
  <section style="margin-top:26px;border:1px solid #dbe5f0;border-radius:18px;background:#f8fbff;padding:22px;"><h2 style="margin-top:0;">AI Operating Contract</h2><p style="color:#52667e;">These instructions define what Vivid is allowed to optimize. Saving them does not activate Autopilot.</p><form method="post" action="${esc(action)}" style="display:grid;gap:14px;"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:13px;"><label style="display:grid;gap:6px;font-weight:800;">Primary goal<select name="goal" style="padding:11px;border:1px solid #cbd5e1;border-radius:9px;"><option value="">Select goal</option>${["revenue","conversions","leads","traffic","awareness"].map(v=>`<option value="${v}" ${profile.goal===v?"selected":""}>${v[0].toUpperCase()+v.slice(1)}</option>`).join("")}</select></label>${field("Monthly budget ceiling","monthly_budget",profile.monthlyBudget||"","number",'min="0" step="1"')}${field("Target metric","target_metric",profile.targetMetric||"")}${field("Target value","target_value",profile.targetValue||"","number",'min="0" step="0.01"')}${field("Target geography","target_geography",profile.targetGeography||"")}${field("Target customer","target_customer",profile.targetCustomer||"")}</div><div><strong>Approved channels</strong><div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;">${["vivid","google_ads","meta","email","square"].map(v=>`<label><input type="checkbox" name="approved_channels" value="${v}" ${channelSet.has(v)?"checked":""}> ${v.replaceAll("_"," ")}</label>`).join("")}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:13px;"><label style="display:grid;gap:6px;font-weight:800;">Approved offers<textarea name="approved_offers" rows="3" style="padding:11px;border:1px solid #cbd5e1;border-radius:9px;">${esc(profile.approvedOffers||"")}</textarea></label><label style="display:grid;gap:6px;font-weight:800;">Prohibited actions<textarea name="prohibited_actions" rows="3" style="padding:11px;border:1px solid #cbd5e1;border-radius:9px;">${esc(profile.prohibitedActions||"")}</textarea></label></div><div style="display:flex;gap:20px;align-items:end;flex-wrap:wrap;"><label style="display:grid;gap:6px;font-weight:800;">Requested operating mode<select name="desired_mode" style="padding:11px;border:1px solid #cbd5e1;border-radius:9px;">${["observe","recommend","approval","autopilot"].map(v=>`<option value="${v}" ${profile.desiredMode===v?"selected":""}>${v}</option>`).join("")}</select></label>${field("Maximum automatic change %","max_auto_change_pct",profile.maxAutoChangePct||"","number",'min="0" max="25" step="1"')}<label style="font-weight:800;padding-bottom:11px;"><input type="checkbox" name="approval_required" ${profile.approvalRequired?"checked":""}> Require human approval</label></div><button style="justify-self:start;border:0;border-radius:10px;background:#1559c7;color:#fff;padding:12px 17px;font-weight:900;cursor:pointer;">Save Operating Contract</button></form></section>${backHref?`<a href="${esc(backHref)}" style="display:inline-block;margin-top:18px;color:#1559c7;font-weight:800;">← Back</a>`:""}</main>`;
}

function renderAdvertiserPortfolio(items=[],organizationId){
  const escHref=value=>esc(value);
  return `<section style="margin:26px auto 0;max-width:1180px;padding:0 22px;font-family:Arial,sans-serif;color:#102b50;"><div style="display:flex;justify-content:space-between;gap:15px;align-items:end;flex-wrap:wrap;"><div><div style="font-size:12px;font-weight:900;color:#1559c7;text-transform:uppercase;letter-spacing:.08em;">Enterprise Autonomy Portfolio</div><h2 style="margin:5px 0;">Advertiser Evidence Passports</h2><p style="margin:0;color:#52667e;">Each advertiser has an isolated evidence boundary and operating contract. Portfolio status never combines one advertiser's permission with another's performance.</p></div><div style="font-weight:900;color:#1559c7;">${items.length} advertiser${items.length===1?"":"s"}</div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:13px;margin-top:16px;">${items.length?items.map(item=>`<a href="${escHref(`/org-ai-readiness/advertiser/${item.id}?organization_id=${organizationId}`)}" style="display:block;text-decoration:none;color:inherit;border:1px solid #dbe5f0;border-radius:15px;background:#fff;padding:17px;box-shadow:0 7px 20px rgba(15,52,96,.06);"><div style="display:flex;justify-content:space-between;gap:12px;align-items:start;"><strong>${esc(item.name)}</strong><span style="font-size:22px;font-weight:900;color:#1559c7;">${item.readiness.score}</span></div><div style="font-size:12px;font-weight:900;color:#52667e;margin-top:5px;">${esc(item.readiness.level)} · ${esc(item.readiness.mode)}</div><div style="margin-top:11px;padding-top:10px;border-top:1px solid #edf2f7;font-size:12px;color:#8a5a00;"><strong>Next:</strong> ${esc(item.readiness.nextProof?.fix||"Evidence requirements complete.")}</div></a>`).join(""):'<div style="padding:18px;border:1px solid #dbe5f0;border-radius:14px;background:#fff;color:#52667e;">No active advertisers are available yet.</div>'}</div></section>`;
}

module.exports={validateProfile,scoreReadiness,renderReadinessCenter,renderAdvertiserPortfolio};
