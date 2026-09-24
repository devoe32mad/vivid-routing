"use strict";
const {buildPlatforms,platformCard,renderPlatformDetail,platformStyle,dashboardHref}=require("./marketing-platform-dashboard");
const {googleRecommendations}=require("./marketing-performance-insights");
const CONNECTORS = [
  ["vivid","Vivid placements","Physical + marketplace","QR engagement and recorded campaign conversions.","Available"],
  ["square","Square","Sales evidence","Matched purchases and refund-adjusted revenue.","Existing integration"],
  ["google_ads","Google Ads","Paid media","Search, display and YouTube campaign reporting.","Setup foundation only"],
  ["meta","Meta · Facebook + Instagram","Paid media","Campaign costs, delivery and reported outcomes.","Planned"],
  ["linkedin","LinkedIn Ads","Paid media","Business audience and campaign reporting.","Planned"],
  ["ga4","Google Analytics 4","Website","Website visits, engagement and key events.","Planned"],
  ["search_console","Google Search Console","Organic search","Search queries, impressions, clicks and pages.","Planned"],
  ["shopify","Shopify","Sales evidence","Online orders, refunds and purchase outcomes.","Planned"],
  ["email","Mailchimp / Klaviyo","Email","Email engagement and reported outcomes.","Planned"],
  ["calls","Call tracking","Leads","Campaign-specific calls and qualified leads.","Planned"],
  ["crm","HubSpot / Salesforce","Sales outcomes","Connect qualified leads to closed sales.","Planned"],
  ["physical","Billboards, print, Valpak + events","Physical media","Record costs and measure QR, offer-code and sales evidence. Provider imports are future work.","Measurement planning"]
].map(([id,name,category,purpose,stage])=>({id,name,category,purpose,stage}));
const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = value => n(value).toLocaleString("en-US",{style:"currency",currency:"USD"});
function dateRange(query={}, now=new Date()) {
  const from=query.from || new Date(now.getTime()-29*86400000).toISOString().slice(0,10), to=query.to || now.toISOString().slice(0,10);
  const valid=x=>typeof x==="string" && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0,10)===x;
  if(!valid(from)||!valid(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000) throw Error("Choose a valid date range of up to 367 days.");
  return {from,to};
}
function sourceHref(id,scope) {
  return scope.kind==="enterprise" ? `/org-campaign/${Number(id)}?organization_id=${scope.orgId}` : `/admin/view-campaign/${Number(id)}`;
}
function summarize(campaigns) {
  return campaigns.reduce((sum,c)=>{for(const key of Object.keys(sum))sum[key]+=n(c[key]);return sum;},
    {scans:0,clicks:0,conversions:0,conversion_value:0,square_conversions:0,square_value:0});
}
function recommendations(campaigns,scope) {
  const items=[];
  for(const c of campaigns){
    const href=sourceHref(c.id,scope),name=String(c.name);
    if(n(c.clicks)>0 && n(c.conversions)===0)items.push({title:`Check the conversion path: ${name}`,reason:`${n(c.clicks)} intent actions and no recorded conversions in this period. Validate tracking, the offer and checkout before changing budget.`,href});
    else if(n(c.scans)>0 && n(c.clicks)===0)items.push({title:`Test the call to action: ${name}`,reason:`${n(c.scans)} scans and no recorded intent actions. Review the destination and try one clearer offer.`,href});
    else if(n(c.conversions)>0)items.push({title:`Review the offer that converted: ${name}`,reason:`${n(c.conversions)} recorded conversions. Inspect the original offer and placement before preparing a repeat test; this does not establish incremental lift.`,href});
    if(items.length===5)break;
  }
  if(!items.length)items.push({title:"Build a measured baseline",reason:"Choose a goal, confirm tracking and collect outcomes before allocating budget by performance.",href:scope.kind==="enterprise"?`/org-ai-readiness/advertiser/${scope.advertiserId}?organization_id=${scope.orgId}`:"/admin/ai-readiness"});
  return items;
}
function renderCommandCenter({title,scope,range,campaigns,squareStatus,googleEvidence=null,googleEnabled=false,googleAutoSync=true,platform="",campaign="",aiVisible=false}) {
  const totals=summarize(campaigns),recs=recommendations(campaigns,scope);
  const platforms=buildPlatforms({scope,range,campaigns,squareStatus,googleEvidence,googleEnabled,googleAutoSync});
  const active=platforms.find(p=>p.id===platform),selected=active?.rows.find(r=>r.key===campaign);
  if(scope.kind==="advertiser" && googleEvidence)recs.push(...googleRecommendations(googleEvidence,range));
  if(totals.square_conversions>0)recs.push({title:"Review placements with verified Square payments",reason:`${totals.square_conversions} matched payment conversions and ${money(totals.square_value)} recorded net value in this period. Inspect the offers and placements producing purchases before preparing another test. Profit and ROI also require campaign costs.`,href:dashboardHref(scope,range,"square"),source:"Square"});
  const relevantRecs=active?recs.filter(r=>(r.source||"Vivid")===(active.id==="google_ads"?"Google Ads":active.name)):recs;
  const passport=scope.kind==="enterprise"?`/org-ai-readiness/advertiser/${scope.advertiserId}?organization_id=${scope.orgId}`:"/admin/ai-readiness";
  const approval=scope.kind==="enterprise"?`/org-ai-approval-center?organization_id=${scope.orgId}`:"/admin/ai-approval-center";
  const google=platforms.find(p=>p.id==="google_ads"),gm=google?.metrics||[];
  const squareAvailable=platforms.find(p=>p.id==="square")?.available;
  const metrics=[
    ["Scans",totals.scans,"Vivid placements","vivid"],
    ["Intent actions",totals.clicks,"Offers, maps & destination actions","vivid"],
    ["Ad impressions",gm[0]?.[1]||"—","Google Ads · imported reports","google_ads"],
    ["Ad clicks",gm[1]?.[1]||"—","Google Ads · imported reports","google_ads"],
    ["Ad spend",gm[3]?.[1]||"—","Google Ads · currencies kept separate","google_ads"],
    ["Ad click-through rate",gm[4]?.[1]||"—","Total clicks / total impressions","google_ads"],
    ["Recorded conversions",totals.conversions,"Vivid · includes matched Square purchases","vivid"],
    ["Recorded conversion value · USD",money(totals.conversion_value),"Vivid · includes matched Square value","vivid"],
    ["Verified matched purchases",squareAvailable?totals.square_conversions:"—","Square · subset of recorded conversions","square"],
    ["Verified matched net value · USD",squareAvailable?money(totals.square_value):"—","Square · completed refunds deducted","square"],
    ["Platform-reported conversions",gm[2]?.[1]||"—","Google Ads · may overlap recorded outcomes","google_ads"],
    ["Platform-reported value",gm[5]?.[1]||"—","Google Ads · not verified revenue","google_ads"]
  ].filter(m=>scope.kind==="advertiser"||m[3]!=="google_ads");
  const roadmap=CONNECTORS.filter(c=>!['vivid','square','google_ads'].includes(c.id));
  return `<style>
.mcc{max-width:1240px;margin:28px auto;padding:0 20px 40px;color:#122b49;font:15px/1.5 system-ui,sans-serif}.mcc h1{font-size:32px;margin:8px 0}.mcc h2{margin:26px 0 12px}.mcc h3{margin:5px 0 10px}.mcc a{color:#165ca8;font-weight:700}.mcc-hero{background:#102b50;color:white;padding:28px;border-radius:18px}.mcc-hero a{color:#cce5ff}.mcc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.mcc-card{background:white;border:1px solid #d9e2ed;padding:18px;border-radius:14px}.mcc-card p,.mcc small{color:#53677c}.mcc-status{display:inline-block;background:#eef3fa;padding:4px 8px;border-radius:8px;font-size:12px;font-weight:700}.mcc-number{display:block;font-size:26px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.mcc form{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:18px 0}.mcc input,.mcc button{font:inherit;padding:8px;border:1px solid #b7c8da;border-radius:7px}.mcc button{background:#102b50;color:white}.mcc label{display:grid}.mcc-scroll{overflow:auto}.mcc table{width:100%;border-collapse:collapse;background:white}.mcc th,.mcc td{text-align:left;padding:12px;border-bottom:1px solid #d9e2ed;white-space:nowrap}.mcc summary{cursor:pointer}.mcc-nav{display:flex;gap:18px;flex-wrap:wrap}.mcc-summary{grid-template-columns:repeat(4,minmax(0,1fr))}.mcc-summary .mcc-card{text-decoration:none;min-width:0}.mcc-summary .mcc-card>small:last-child{display:block;font-size:11px;margin-top:10px}.mcc-coverage{font-size:13px;color:#53677c}@media(max-width:900px){.mcc-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.mcc{padding:0 12px}.mcc-hero{padding:20px}.mcc h1{font-size:26px}.mcc-number{font-size:22px}.mcc-summary .mcc-card{padding:14px}}
${platformStyle}</style><main class="mcc">
${active?`<nav class="mcc-breadcrumb" aria-label="Breadcrumb"><a href="${esc(dashboardHref(scope,range))}">All platforms</a><span>/</span>${selected?`<a href="${esc(dashboardHref(scope,range,active.id))}">${esc(active.name)}</a><span>/</span><span>${esc(selected.name)}</span>`:`<span>${esc(active.name)}</span>`}</nav>`:""}
<section class="mcc-hero"><small style="color:#cce5ff">VIVID · MARKETING COMMAND CENTER</small><h1>${esc(active?active.name+" campaigns":title)}</h1><p>${active?"Platform totals, campaign results and supporting evidence.":"All your connected platforms. One view of reach, engagement and outcomes."}</p><nav class="mcc-nav"><a href="${active?esc(dashboardHref(scope,range)):"#platform-dashboards"}">All platforms</a>${aiVisible?`<a href="${passport}">Evidence Passport</a><a href="${approval}">Approval Center</a>`:""}<a href="/build-my-campaign">Build a campaign</a></nav></section>
<form method="get">${scope.kind==="enterprise"?`<input type="hidden" name="organization_id" value="${scope.orgId}">`:""}${active?`<input type="hidden" name="platform" value="${active.id}">`:""}${campaign?`<input type="hidden" name="campaign" value="${esc(campaign)}">`:""}<label>From<input type="date" name="from" value="${range.from}" required></label><label>To<input type="date" name="to" value="${range.to}" required></label><button>Update period</button></form>
<p class="mcc-coverage">${scope.kind==="enterprise"?"Only this advertiser’s campaigns shared with your organization. Private advertising accounts and merchant sales are excluded.":"All campaigns owned by your signed-in account and reports from your connected platforms. Vivid and Square dates use UTC; Google dates use each account’s timezone."}</p>
${scope.kind==="advertiser"?`<p class="mcc-coverage"><strong>Viewing account:</strong> ${esc(scope.accountName||"Signed-in account")}${scope.accountEmail?` · ${esc(scope.accountEmail)}`:""} · Account ${esc(scope.userId)}. Connections saved under another account will not appear here.</p>`:""}
${active?renderPlatformDetail(active,scope,range,campaign):`<h2>Across your platforms</h2><section class="mcc-grid mcc-summary" aria-label="All-platform totals">${metrics.map(([label,value,context,target])=>`<a class="mcc-card" href="${esc(dashboardHref(scope,range,target))}"><small>${label}</small><strong class="mcc-number">${esc(value)}</strong><small>${context}</small></a>`).join("")}</section>
<p class="mcc-coverage"><strong>Revenue accounting:</strong> Square matched purchases and value are included in Vivid recorded outcomes and are not added again. Google-reported conversions and value remain separate. No combined revenue or conversion total is inferred across overlapping platforms. A dash means no reporting data is available.</p>
<h2 id="platform-dashboards">Your platforms</h2><p>Totals across each platform's campaigns for the selected period. Open a platform, then select a campaign.</p><section class="mcc-platform-grid">${platforms.map(p=>platformCard(p,scope,range)).join("")}</section>`}
${aiVisible?`<h2>Automatic recommendations</h2><section class="mcc-grid">${relevantRecs.map(r=>`<article class="mcc-card"><span class="mcc-status">${esc(r.source||"Vivid")} · ${esc(r.signal||"For review")}</span><h3>${esc(r.title)}</h3><p>${esc(r.reason)}</p><a href="${esc(r.href)}">Inspect supporting evidence →</a></article>`).join("")||'<article class="mcc-card"><h3>Collect a baseline</h3><p>Recommendations appear when this platform has enough reporting evidence.</p></article>'}</section><p class="mcc-coverage">Suggestions update from saved evidence when you open the dashboard. Clicks and reported conversions alone do not establish revenue or ROI. No campaign or spending changes are made here.</p>`:""}
${!active?`<details class="mcc-roadmap"><summary>More platforms · planned integrations</summary><p>These platforms are not connected and contribute no metrics above.</p><section class="mcc-grid">${roadmap.map(c=>`<article class="mcc-card"><small>${esc(c.category)}</small><h3>${esc(c.name)}</h3><span class="mcc-status">${esc(c.stage)}</span><p>${esc(c.purpose)}</p></article>`).join("")}</section></details>`:""}</main>`;
}
module.exports={CONNECTORS,dateRange,summarize,recommendations,renderCommandCenter};
