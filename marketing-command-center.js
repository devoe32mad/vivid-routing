"use strict";
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
function renderCommandCenter({title,scope,range,campaigns,squareStatus}) {
  const totals=summarize(campaigns),recs=recommendations(campaigns,scope);
  const passport=scope.kind==="enterprise"?`/org-ai-readiness/advertiser/${scope.advertiserId}?organization_id=${scope.orgId}`:"/admin/ai-readiness";
  const approval=scope.kind==="enterprise"?`/org-ai-approval-center?organization_id=${scope.orgId}`:"/admin/ai-approval-center";
  const cards=CONNECTORS.map(c=>{
    let detail=c.stage,href="";
    if(c.id==="vivid"){detail=campaigns.length?"Campaign records available":"No campaign records";href="#campaign-evidence";}
    if(c.id==="square"){detail=squareStatus;if(scope.kind==="advertiser" && squareStatus!=="Not enabled")href=`/integrations/square/production/customers/${scope.userId}`;}
    if(c.id==="google_ads" && scope.kind==="enterprise")href=`/org-connectors/google-ads/advertiser/${scope.advertiserId}?organization_id=${scope.orgId}`;
    return `<article class="mcc-card"><small>${esc(c.category)}</small><h3>${esc(c.name)}</h3><span class="mcc-status">${esc(detail)}</span><p>${esc(c.purpose)}</p>${href?`<a href="${esc(href)}">${c.id==="google_ads"?"View setup":c.id==="square"?"Review Square":"View evidence"} →</a>`:`<details><summary>What's needed?</summary><p>${c.id==="google_ads"?"Account authorization and reporting sync still need implementation.":"This source is on the connector roadmap. No account data is being imported here."}</p></details>`}</article>`;
  }).join("");
  return `<style>
.mcc{max-width:1180px;margin:28px auto;padding:0 20px 40px;color:#122b49;font:15px/1.5 system-ui,sans-serif}.mcc h1{font-size:32px;margin:8px 0}.mcc h2{margin:26px 0 12px}.mcc h3{margin:5px 0 10px}.mcc a{color:#165ca8;font-weight:700}.mcc-hero{background:#102b50;color:white;padding:28px;border-radius:18px}.mcc-hero a{color:#cce5ff}.mcc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.mcc-card{background:white;border:1px solid #d9e2ed;padding:18px;border-radius:14px}.mcc-card p,.mcc small{color:#53677c}.mcc-status{display:inline-block;background:#eef3fa;padding:4px 8px;border-radius:8px;font-size:12px;font-weight:700}.mcc-number{display:block;font-size:28px}.mcc form{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:18px 0}.mcc input,.mcc button{font:inherit;padding:8px;border:1px solid #b7c8da;border-radius:7px}.mcc button{background:#102b50;color:white}.mcc label{display:grid}.mcc-scroll{overflow:auto}.mcc table{width:100%;border-collapse:collapse;background:white}.mcc th,.mcc td{text-align:left;padding:12px;border-bottom:1px solid #d9e2ed;white-space:nowrap}.mcc summary{cursor:pointer}.mcc-nav{display:flex;gap:18px;flex-wrap:wrap}@media(max-width:600px){.mcc{padding:0 12px}.mcc-hero{padding:20px}.mcc h1{font-size:26px}}
</style><main class="mcc"><section class="mcc-hero"><small style="color:#cce5ff">VIVID · MARKETING COMMAND CENTER</small><h1>${esc(title)}</h1><p>Your campaign evidence, next actions and connector roadmap in one place.</p><nav class="mcc-nav"><a href="${passport}">Evidence Passport</a><a href="${approval}">Approval Center</a><a href="/build-my-campaign">Build a campaign</a></nav></section>
<form method="get">${scope.kind==="enterprise"?`<input type="hidden" name="organization_id" value="${scope.orgId}">`:""}<label>From (UTC)<input type="date" name="from" value="${range.from}" required></label><label>To (UTC)<input type="date" name="to" value="${range.to}" required></label><button>Update period</button></form>
<p>${scope.kind==="enterprise"?"This view includes only this advertiser’s campaigns assigned to your organization. Unrelated advertising accounts and merchant sales are private.":"This view uses campaigns owned by your signed-in advertiser account."}</p>
<section class="mcc-grid">${[["Vivid scans",totals.scans],["Intent actions",totals.clicks],["Recorded conversions",totals.conversions],["Recorded conversion value · USD",money(totals.conversion_value)]].map(([label,value])=>`<a class="mcc-card" href="#campaign-evidence" style="text-decoration:none"><small>${label}</small><strong class="mcc-number">${esc(value)}</strong></a>`).join("")}</section>
<p><strong>Revenue accounting:</strong> Recorded conversions include matched Square events already imported into Vivid. The Square subset is ${totals.square_conversions} conversions / ${money(totals.square_value)} and is not added again. These are recorded outcomes, not a complete cross-channel revenue total. CAC and ROI require comparable costs and verified customer outcomes.</p>
<h2>Recommended next actions</h2><section class="mcc-grid">${recs.map(r=>`<article class="mcc-card"><span class="mcc-status">For review</span><h3>${esc(r.title)}</h3><p>${esc(r.reason)}</p><a href="${esc(r.href)}">Inspect supporting evidence →</a></article>`).join("")}</section>
<p>These suggestions use Vivid campaign records for the selected period. Channel, vertical and budget recommendations will need connected evidence; no campaign or spending action is performed here.</p>
<h2 id="campaign-evidence">Campaign evidence</h2><div class="mcc-scroll"><table><thead><tr><th>Campaign</th><th>Scans</th><th>Intent</th><th>Conversions</th><th>Recorded value · USD</th></tr></thead><tbody>${campaigns.length?campaigns.map(c=>`<tr><td><a href="${sourceHref(c.id,scope)}">${esc(c.name)}</a></td><td>${n(c.scans)}</td><td>${n(c.clicks)}</td><td>${n(c.conversions)}</td><td>${money(c.conversion_value)}</td></tr>`).join(""):'<tr><td colspan="5">No campaigns available in this account.</td></tr>'}</tbody></table></div>
<h2>Channels & connections</h2><section class="mcc-grid">${cards}</section></main>`;
}
module.exports={CONNECTORS,dateRange,summarize,recommendations,renderCommandCenter};
