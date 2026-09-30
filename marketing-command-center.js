"use strict";
const {adaptationRecommendations,renderAdaptation}=require("./campaign-adaptation");
const {renderProjection}=require("./conservative-projection");
const {buildPlatforms,platformCard,platformLogo,renderPlatformDetail,platformStyle,dashboardHref}=require("./marketing-platform-dashboard");
const {googleRecommendations,tiktokRecommendations,crossPlatformRecommendations,websiteTrafficRecommendations,campaignRecommendations}=require("./marketing-performance-insights");
const {externalRecommendations}=require("./comparative-intelligence");
const CONNECTORS = [
  ["vivid","Vivid placements","Physical + marketplace","QR engagement and recorded campaign conversions.","Available"],
  ["square","Square","Sales evidence","Matched purchases and refund-adjusted revenue.","Existing integration"],
  ["google_ads","Google Ads","Paid media","Search, display and YouTube campaign reporting.","Setup foundation only"],
  ["meta","Meta · Facebook + Instagram","Paid media","Campaign costs, delivery and reported outcomes.","Available when configured"],
  ["linkedin","LinkedIn Ads","Paid media","Business audience and campaign reporting.","Available when configured"],
  ["tiktok","TikTok Ads","Short-form video advertising","Campaign delivery, video engagement, spend and reported outcomes.","Next integration"],
  ["youtube","YouTube Analytics","Video and content","Organic views, watch time, retention and subscriber activity. Paid YouTube campaigns remain in Google Ads.","Planned"],
  ["pinterest","Pinterest","Visual discovery and shopping","Organic content, ad performance, outbound clicks and shopping outcomes.","Planned"],
  ["reddit","Reddit Ads","Community advertising","Campaign delivery, community engagement and reported conversions.","Planned"],
  ["snapchat","Snapchat Ads","Short-form and AR advertising","Campaign delivery, video engagement, attribution and reported outcomes.","Planned"],
  ["chatgpt_ads","ChatGPT Ads","AI-native advertising","Campaign delivery, clicks, conversions and reporting through OpenAI advertising.","Planned"],
  ["threads","Threads","Social content","Organic and paid reporting when supported through Meta's production APIs.","Future evaluation"],
  ["shopify","Shopify","Sales evidence","Online orders, refunds and purchase outcomes.","Planned"],
  ["email","Mailchimp / Klaviyo","Email","Email engagement and reported outcomes.","Planned"],
  ["calls","Call tracking","Leads","Campaign-specific calls and qualified leads.","Planned"],
  ["crm","HubSpot / Salesforce","Sales outcomes","Connect qualified leads to closed sales.","Planned"],
  ["physical","Billboards, print, Valpak + events","Physical media","Record costs and measure QR, offer-code and sales evidence. Provider imports are future work.","Measurement planning"]
].map(([id,name,category,purpose,stage])=>({id,name,category,purpose,stage}));
const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
function dateRange(query={}, now=new Date()) {
  const {from,to}=require("./reporting-date-range").reportingDateRange(query,now);
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
    if(n(c.clicks)>0 && n(c.conversions)===0)items.push({title:`Check the conversion path: ${name}`,reason:`${n(c.clicks)} intent actions and no recorded conversions in this period. Validate tracking, the offer and checkout before changing budget.`,href,confidence:n(c.clicks)>=10?"Medium":"Low",evidence:[`Customer evidence · ${n(c.clicks)} intent actions · 0 conversions`],limitation:"This pattern does not identify the cause or prove that the campaign is ineffective."});
    else if(n(c.scans)>0 && n(c.clicks)===0)items.push({title:`Test the call to action: ${name}`,reason:`${n(c.scans)} scans and no recorded intent actions. Review the destination and try one clearer offer.`,href,confidence:n(c.scans)>=20?"Medium":"Low",evidence:[`Customer evidence · ${n(c.scans)} scans · 0 intent actions`],limitation:"A scan does not confirm that the visitor saw or understood the destination offer."});
    else if(n(c.conversions)>0)items.push({title:`Review the offer that converted: ${name}`,reason:`${n(c.conversions)} recorded conversions. Inspect the original offer and placement before preparing a repeat test; this does not establish incremental lift.`,href,confidence:n(c.conversions)>=3?"Medium":"Low",evidence:[`Customer evidence · ${n(c.conversions)} recorded conversions`],limitation:"Recorded conversions can be correlated with the campaign without proving incremental lift."});
    if(items.length===5)break;
  }
  if(!items.length)items.push({title:"Build a measured baseline",reason:"Choose a goal, confirm tracking and collect outcomes before allocating budget by performance.",href:scope.kind==="enterprise"?`/org-ai-readiness/advertiser/${scope.advertiserId}?organization_id=${scope.orgId}`:"/admin/ai-readiness",confidence:"Low",evidence:["Customer evidence · insufficient measured outcomes"],limitation:"No performance conclusion is available until tracking produces a usable baseline."});
  return items;
}
function intelligenceRecommendations(campaigns,benchmark,scope) {
  const total=summarize(campaigns),items=[];
  if(benchmark?.available){
    const insight=benchmark.aiInterpretation;
    items.push({source:"Vivid benchmark",signal:"Anonymous comparison",title:"Prioritize your largest measured opportunity",reason:insight.recommendation,href:scope.kind==="enterprise"?`/org-ai-readiness/advertiser/${scope.advertiserId}?organization_id=${scope.orgId}`:"/admin/ai-readiness",confidence:benchmark.confidence,evidence:[`Anonymous Vivid cohort · ${benchmark.organizationCount} organizations · ${benchmark.campaignCount} campaigns`,`Your opportunity metric · ${String(insight.opportunityMetric).replace(/([A-Z])/g," $1").toLowerCase()} · ${insight.opportunityPercentile}th percentile`],limitation:benchmark.privacy});
  }
  for(const item of externalRecommendations({engagement:total.clicks,conversions:total.conversions}))items.push({source:"External guidance",signal:"Official best practice",title:item.title,reason:item.text,href:item.source.url,external:true,confidence:"Reference",evidence:[`${item.source.publisher} · ${item.source.title}`,`Source reviewed ${item.source.reviewedOn}`],limitation:"General guidance is not a prediction of results for this customer."});
  return items;
}
function groupedMoney(rows,key) {
  const groups=new Map();
  for(const row of rows||[])groups.set(row.currency_code,(groups.get(row.currency_code)||0)+n(row[key]));
  return [...groups].map(([code,value])=>`${(key==="cost_micros"?value/1e6:value).toLocaleString("en-US",{maximumFractionDigits:2})} ${code}`).join(" · ")||"—";
}
function groupedRoas(rows) {
  const groups=new Map();
  for(const row of rows||[]){
    const code=row.currency_code||"USD",group=groups.get(code)||{spend:0,value:0};
    group.spend+=n(row.cost_micros)/1e6;
    group.value+=n(row.reported_value);
    groups.set(code,group);
  }
  return [...groups].map(([code,group])=>group.spend?`${(group.value/group.spend).toLocaleString("en-US",{maximumFractionDigits:2})}x ${code}`:`— ${code}`).join(" · ")||"—";
}
const validMargin=value=>value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=100;
function groupedEstimatedRoi(rows,marginPct) {
  if(!validMargin(marginPct))return rows.some(r=>n(r.cost_micros)>0)?"Add margin below":"—";
  const groups=new Map();
  for(const row of rows){const code=row.currency_code||"USD",group=groups.get(code)||{spend:0,value:0};group.spend+=n(row.cost_micros)/1e6;group.value+=n(row.reported_value);groups.set(code,group);}
  return [...groups].map(([code,group])=>group.spend?`${(100*((group.value*Number(marginPct)/100)-group.spend)/group.spend).toLocaleString("en-US",{maximumFractionDigits:2})}% ${code}`:`— ${code}`).join(" · ")||"—";
}
function renderEconomicsSetup(economics,csrf) {
  const configured=validMargin(economics?.gross_margin_pct),value=configured?Number(economics.gross_margin_pct):"";
  return `<section class="mcc-economics" id="business-economics"><div><h2>Estimate advertising ROI</h2><p>Of every $100 in sales, approximately how much remains after delivering the product or service?</p>${configured?`<small>Vivid currently uses a ${value}% margin. Estimated ROI uses platform-reported revenue and is not verified profit.</small>`:`<small>If you are unsure, Vivid will continue showing ROAS without estimating ROI.</small>`}</div><form method="post" action="/admin/marketing-command-center/economics"><input type="hidden" name="csrf" value="${esc(csrf||"")}"><label>$ remaining from each $100 sale<input type="number" name="gross_margin_pct" min="0" max="100" step="0.1" value="${esc(value)}" placeholder="Example: 40" required></label><button name="action" value="save">${configured?"Update margin":"Save margin"}</button><button class="mcc-secondary" name="action" value="unknown" formnovalidate>I'm not sure</button></form></section>`;
}
function renderCommandCenter({title,scope,range,campaigns,squareStatus,economics=null,economicsCsrf="",googleEvidence=null,googleEnabled=false,googleAutoSync=true,metaEvidence=null,metaEnabled=false,metaAutoSync=true,linkedinEvidence=null,linkedinEnabled=false,linkedinAutoSync=true,tiktokEvidence=null,tiktokEnabled=false,tiktokAutoSync=true,redditEvidence=null,redditEnabled=false,redditAutoSync=true,pinterestEvidence=null,pinterestEnabled=false,pinterestAutoSync=true,youtubeEvidence=null,youtubeEnabled=false,youtubeAutoSync=true,analyticsEvidence=null,analyticsEnabled=false,analyticsAutoSync=true,searchConsoleEvidence=null,searchConsoleEnabled=false,searchConsoleAutoSync=true,benchmark=null,platform="",campaign="",aiVisible=false}) {
  const recs=recommendations(campaigns,scope);
  recs.push(...intelligenceRecommendations(campaigns,benchmark,scope));
  const platforms=buildPlatforms({scope,range,campaigns,squareStatus,economics,googleEvidence,googleEnabled,googleAutoSync,metaEvidence,metaEnabled,metaAutoSync,linkedinEvidence,linkedinEnabled,linkedinAutoSync,tiktokEvidence,tiktokEnabled,tiktokAutoSync,redditEvidence,redditEnabled,redditAutoSync,pinterestEvidence,pinterestEnabled,pinterestAutoSync,youtubeEvidence,youtubeEnabled,youtubeAutoSync,analyticsEvidence,analyticsEnabled,analyticsAutoSync,searchConsoleEvidence,searchConsoleEnabled,searchConsoleAutoSync});
  const paidMediaActive=platform==="paid_media",active=paidMediaActive?{id:"paid_media",name:"Paid media",heading:"Paid media performance"}:platforms.find(p=>p.id===platform),selected=active?.rows?.find(r=>r.key===campaign);
  if(scope.kind==="advertiser" && googleEvidence)recs.push(...googleRecommendations(googleEvidence,range));
  if(scope.kind==="advertiser" && tiktokEvidence)recs.push(...tiktokRecommendations(tiktokEvidence,range));
  const paidSources=[
    {id:"google_ads",name:"Google Ads",evidence:googleEvidence,href:id=>`/admin/connectors/google-ads/${Number(id)}`},
    {id:"meta",name:"Meta Ads",evidence:metaEvidence,href:id=>`/admin/connectors/meta-ads/${Number(id)}`},
    {id:"linkedin",name:"LinkedIn Ads",evidence:linkedinEvidence,href:id=>`/admin/connectors/linkedin-ads/${Number(id)}`},
    {id:"tiktok",name:"TikTok Ads",evidence:tiktokEvidence,href:id=>`/admin/connectors/tiktok-ads/${Number(id)}`},
    {id:"reddit",name:"Reddit Ads",evidence:redditEvidence,href:id=>`/admin/connectors/reddit-ads/${Number(id)}`},
    {id:"pinterest",name:"Pinterest Ads",evidence:pinterestEvidence,href:id=>`/admin/connectors/pinterest-ads/${Number(id)}`}
  ];
  if(scope.kind==="advertiser")recs.unshift(...adaptationRecommendations(paidSources,range,new Date(),economics));
  if(scope.kind==="advertiser")recs.push(...crossPlatformRecommendations(paidSources,range),...campaignRecommendations(paidSources,range,new Date(),economics));
  if(scope.kind==="advertiser"&&analyticsEvidence)recs.push(...websiteTrafficRecommendations(analyticsEvidence,range));
  const rankedRecs=recs.sort((a,b)=>({High:3,Medium:2,Low:1}[b.priority]||0)-({High:3,Medium:2,Low:1}[a.priority]||0));
  const relevantRecs=(active&&!paidMediaActive?rankedRecs.filter(r=>(r.relatedPlatforms||[]).includes(active.id)||(r.source||"Vivid")===(active.id==="google_ads"?"Google Ads":active.name)):rankedRecs).slice(0,12);
  const passport=scope.kind==="enterprise"?`/org-ai-readiness/advertiser/${scope.advertiserId}?organization_id=${scope.orgId}`:"/admin/ai-readiness";
  const approval=scope.kind==="enterprise"?`/org-ai-approval-center?organization_id=${scope.orgId}`:"/admin/ai-approval-center";
  const googleRows=googleEvidence?.rows||[],metaRows=metaEvidence?.rows||[],linkedinRows=linkedinEvidence?.rows||[],tiktokRows=tiktokEvidence?.rows||[],redditRows=redditEvidence?.rows||[],pinterestRows=pinterestEvidence?.rows||[],adRows=[...googleRows,...metaRows,...linkedinRows,...tiktokRows,...redditRows,...pinterestRows];
  const returnRows=[
    ...googleRows.map(r=>({...r,reported_value:n(r.conversion_value)})),
    ...metaRows.map(r=>({...r,reported_value:n(r.purchase_value)})),
    ...linkedinRows.map(r=>({...r,reported_value:n(r.conversion_value)})),
    ...tiktokRows.map(r=>({...r,reported_value:n(r.conversion_value)})),
    ...redditRows.map(r=>({...r,reported_value:n(r.conversion_value)})),
    ...pinterestRows.map(r=>({...r,reported_value:n(r.conversion_value_micros)/1e6}))
  ];
  const adImpressions=adRows.reduce((s,r)=>s+n(r.impressions),0),adClicks=adRows.reduce((s,r)=>s+n(r.clicks),0);
  const hasAdData=adRows.length>0;
  const summaryGroups=[
    {title:"Paid media",question:"Did people see and click your ads?",target:"paid_media",cta:"View paid media performance",available:scope.kind==="advertiser"&&scope.privateAdsAllowed!==false,metrics:[
      ["Impressions",hasAdData?adImpressions.toLocaleString("en-US"):"—"],
      ["Clicks",hasAdData?adClicks.toLocaleString("en-US"):"—"],
      ["Spend",groupedMoney(adRows,"cost_micros")],
      ["Click-through rate",hasAdData&&adImpressions?(100*adClicks/adImpressions).toLocaleString("en-US",{maximumFractionDigits:2})+"%":"—"],
      ["Platform-reported value",groupedMoney(returnRows,"reported_value")],
      ["Reported ROAS",groupedRoas(returnRows)],
      [validMargin(economics?.gross_margin_pct)?"Estimated ROI":"ROI",groupedEstimatedRoi(returnRows,economics?.gross_margin_pct)]],
      note:"Connected ad platforms · reported revenue may overlap · currencies remain separate"}
  ].filter(group=>group.available);
  const roadmap=CONNECTORS.filter(c=>!['vivid','square','google_ads','meta','linkedin'].includes(c.id)&&!platforms.some(p=>p.id===c.id));
  const setupPlatforms=scope.kind==="advertiser"&&scope.privateAdsAllowed!==false?platforms.filter(p=>["google_ads","meta","linkedin","tiktok","reddit","pinterest","youtube","ga4"].includes(p.id)&&!(p.accountCount||p.available)):[];
  const marketingPlatforms=platforms.filter(p=>p.id!=="square").sort((a,b)=>(a.id==="ga4"?-1:0)-(b.id==="ga4"?-1:0));
  const websitePlatform=marketingPlatforms.find(p=>p.id==="ga4"),aiTrafficPlatform=marketingPlatforms.find(p=>p.id==="ai_traffic"),organicPlatform=marketingPlatforms.find(p=>p.id==="organic"),lowerMarketingPlatforms=marketingPlatforms.filter(p=>!["ga4","ai_traffic","organic","youtube"].includes(p.id));
  const paidMediaPlatforms=platforms.filter(p=>["google_ads","meta","linkedin","tiktok","reddit","pinterest"].includes(p.id));
  return `<style>
.mcc{max-width:1240px;margin:28px auto;padding:0 20px 40px;color:#122b49;font:15px/1.5 system-ui,sans-serif}.mcc h1{font-size:32px;margin:8px 0}.mcc h2{margin:26px 0 12px}.mcc h3{margin:5px 0 10px}.mcc a{color:#165ca8;font-weight:700}.mcc-hero{background:#102b50;color:white;padding:28px;border-radius:18px}.mcc-hero a{color:#cce5ff}.mcc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.mcc-card{background:white;border:1px solid #d9e2ed;padding:18px;border-radius:14px}.mcc-card p,.mcc small{color:#53677c}.mcc-status{display:inline-block;background:#eef3fa;padding:4px 8px;border-radius:8px;font-size:12px;font-weight:700}.mcc-number{display:block;font-size:26px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.mcc form{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:18px 0}.mcc input,.mcc button{font:inherit;padding:8px;border:1px solid #b7c8da;border-radius:7px}.mcc button{background:#102b50;color:white}.mcc label{display:grid}.mcc-scroll{overflow:auto}.mcc table{width:100%;border-collapse:collapse;background:white}.mcc th,.mcc td{text-align:left;padding:12px;border-bottom:1px solid #d9e2ed;white-space:nowrap}.mcc summary{cursor:pointer}.mcc-nav{display:flex;gap:18px;flex-wrap:wrap}.mcc-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.mcc-summary-card{display:block;text-decoration:none;min-width:0}.mcc-summary-card h3{font-size:20px}.mcc-summary-card>p{margin:0 0 18px}.mcc-summary-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.mcc-summary-metrics small{display:block}.mcc-summary-metrics strong{display:block;font-size:24px;margin-top:3px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.mcc-summary-note{display:block;margin-top:18px;font-size:11px}.mcc-coverage{font-size:13px;color:#53677c}@media(max-width:760px){.mcc-summary{grid-template-columns:1fr}}@media(max-width:600px){.mcc{padding:0 12px}.mcc-hero{padding:20px}.mcc h1{font-size:26px}.mcc-number{font-size:22px}.mcc-summary .mcc-card{padding:14px}.mcc-summary-metrics strong{font-size:21px}}
.mcc-summary-card{display:flex;flex-direction:column}.mcc-summary-cta{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:18px;border-top:1px solid #e8edf3;font-weight:700}
.mcc-setup{margin:18px 0;padding:18px;background:#f5f8fc;border:1px solid #d9e2ed;border-radius:14px}.mcc-setup h2{margin:0 0 4px;font-size:20px}.mcc-setup>p{margin:0 0 14px;color:#53677c}.mcc-setup-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.mcc-setup-item{display:grid;grid-template-columns:36px 1fr;gap:3px 10px;align-items:center;padding:12px;background:white;border:1px solid #d9e2ed;border-radius:10px;text-decoration:none;min-width:0}.mcc-setup-item .mcc-platform-logo{grid-row:1/4;width:36px;height:36px}.mcc-setup-item .mcc-platform-logo svg{width:30px;height:30px}.mcc-setup-item span{font-size:12px;color:#53677c}.mcc-setup-item b{font-size:12px}.mcc-roadmap-title{display:flex;align-items:center;gap:12px;margin-bottom:12px}.mcc-roadmap-title h3{margin:2px 0}@media(max-width:600px){.mcc-setup-grid{grid-template-columns:1fr}}
.mcc-economics{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center;margin:18px 0;padding:18px;background:#f8fbff;border:1px solid #c9d9ec;border-radius:14px}.mcc-economics h2{margin:0 0 4px;font-size:20px}.mcc-economics p{margin:0 0 5px}.mcc-economics form{margin:0}.mcc-economics input{width:160px}.mcc-economics .mcc-secondary{background:#fff;color:#102b50}@media(max-width:800px){.mcc-economics{grid-template-columns:1fr}.mcc-economics input{width:100%}}
.mcc-rec-meta{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.mcc-confidence{font-size:12px;font-weight:800;color:#3155a6}.mcc-evidence{margin:10px 0;padding-left:18px;color:#46556b}.mcc-evidence li{margin:4px 0}.mcc-limit{display:block;margin:10px 0;padding-top:9px;border-top:1px solid #e8edf3}.mcc-rec-link{display:inline-block;margin-top:4px}
${platformStyle}</style><main class="mcc">
${active?`<nav class="mcc-breadcrumb" aria-label="Breadcrumb"><a href="${esc(dashboardHref(scope,range))}">All platforms</a><span>/</span>${selected?`<a href="${esc(dashboardHref(scope,range,active.id))}">${esc(active.name)}</a><span>/</span><span>${esc(selected.name)}</span>`:`<span>${esc(active.name)}</span>`}</nav>`:""}
<section class="mcc-hero"><small style="color:#cce5ff">VIVID · MARKETING COMMAND CENTER</small><h1>${esc(active?(active.heading||active.name+" campaigns"):title)}</h1><p>${active?(paidMediaActive?"Every connected advertising platform in one view. Open a platform to inspect its campaigns and supporting evidence.":active.id==="ga4"?"Where visitors came from, whether they engaged, the actions they took and the revenue GA4 reported.":active.id==="organic"?"Unpaid content performance, followed from each platform to the website evidence we can support.":"Platform totals, campaign results and supporting evidence."):"All your connected platforms. One view of reach, engagement and outcomes."}</p><nav class="mcc-nav"><a href="${active?esc(dashboardHref(scope,range)):"#platform-dashboards"}">All platforms</a>${aiVisible?`<a href="${passport}">Evidence Passport</a><a href="${approval}">Approval Center</a>`:""}<a href="/build-my-campaign">Build a campaign</a></nav></section>
${!active&&setupPlatforms.length?`<section class="mcc-setup" aria-labelledby="connection-setup"><h2 id="connection-setup">Connect another platform</h2><p>Connected platforms load automatically whenever you sign in. Authorization is only required once unless a provider later asks you to renew access.</p><div class="mcc-setup-grid">${setupPlatforms.map(p=>`<a class="mcc-setup-item" href="${esc(p.manageHref||dashboardHref(scope,range,p.id))}">${platformLogo(p.id,p.name)}<strong>${esc(p.name)}</strong><span>${esc(p.status)}</span><b>Connect platform →</b></a>`).join("")}</div></section>`:""}
${scope.kind==="advertiser"?`<section class="mcc-panel"><strong>Viewing: ${esc(scope.accountName||"Your account")} · Account ${scope.userId}</strong>${scope.accountSelection?`<form method="get"><label>View account<select name="account">${scope.accounts.map(a=>`<option value="${Number(a.id)}" ${Number(a.id)===scope.userId?"selected":""}>${esc(a.name)} · ${Number(a.id)}</option>`).join("")}</select></label><input type="hidden" name="from" value="${range.from}"><input type="hidden" name="to" value="${range.to}"><button>View account</button></form>`:""}${scope.privateAdsAllowed===false?"<p>Viewing this advertiser’s shared Vivid campaigns and reporting. Switch to your own account to manage private platform connections.</p>":""}</section>`:""}
<form method="get">${scope.accountSelection?`<input type="hidden" name="account" value="${scope.userId}">`:""}${scope.kind==="enterprise"?`<input type="hidden" name="organization_id" value="${scope.orgId}">`:""}${active?`<input type="hidden" name="platform" value="${active.id}">`:""}${campaign?`<input type="hidden" name="campaign" value="${esc(campaign)}">`:""}<label>From<input type="date" name="from" value="${range.from}" required></label><label>To<input type="date" name="to" value="${range.to}" required></label><button>Update period</button></form>
<p class="mcc-coverage">${scope.kind==="enterprise"?"Only this advertiser’s campaigns shared with your organization. Private advertising accounts and sales-system data are excluded.":"Campaigns and reports for the account shown above. Vivid dates use UTC; connected platforms use each account’s timezone."}</p>
${scope.kind==="advertiser"&&scope.privateAdsAllowed!==false&&(!active||paidMediaActive||["google_ads","meta","linkedin","tiktok","reddit","pinterest"].includes(active.id))?renderEconomicsSetup(economics,economicsCsrf):""}
${paidMediaActive?`<h2>Paid media platforms</h2><p>Totals for every paid platform in the selected period. Open a platform to see its campaigns, reporting and source evidence.</p><section class="mcc-platform-grid">${paidMediaPlatforms.map(p=>platformCard(p,scope,range)).join("")}</section>`:active?renderPlatformDetail(active,scope,range,campaign):`<h2>Performance snapshot</h2><p>Website, AI-referred, paid-media and organic-content activity at a glance. AI and organic website visits are already included in Website Performance totals.</p><section class="mcc-platform-grid mcc-snapshot-grid" aria-label="Executive performance snapshot">${websitePlatform?platformCard(websitePlatform,scope,range):""}${aiTrafficPlatform?platformCard(aiTrafficPlatform,scope,range):""}${summaryGroups.map(group=>`<a class="mcc-card mcc-summary-card" href="${esc(dashboardHref(scope,range,group.target))}"><h3>${esc(group.title)}</h3><p>${esc(group.question)}</p><div class="mcc-summary-metrics">${group.metrics.map(([label,value])=>`<span><small>${esc(label)}</small><strong>${esc(value)}</strong></span>`).join("")}</div><small class="mcc-summary-note">${esc(group.note)}</small><span class="mcc-summary-cta">${esc(group.cta)} <span aria-hidden="true">→</span></span></a>`).join("")}${organicPlatform?platformCard(organicPlatform,scope,range):""}</section>
<p class="mcc-coverage"><strong>How to read this:</strong> Reported ROAS divides platform-reported conversion value by ad spend. Values can include assigned lead values and can overlap across platforms. ${validMargin(economics?.gross_margin_pct)?`Estimated ROI applies the customer-provided ${Number(economics.gross_margin_pct)}% margin to reported value, subtracts ad spend, then divides by ad spend. This is a value-based scenario, not verified profit; it is meaningful only when reported values represent sales.`:"Vivid does not estimate ROI until the customer supplies a margin."} Vivid-recorded outcomes remain separate. A dash means reporting data is unavailable; it does not mean zero activity. POS and sales verification are preserved outside this marketing-platform view.</p>
<h2 id="platform-dashboards">Your platforms</h2><p>Totals across each marketing platform's campaigns for the selected period. Open a platform, then select a campaign.</p><section class="mcc-platform-grid">${lowerMarketingPlatforms.map(p=>platformCard(p,scope,range)).join("")}</section>`}
${aiVisible?`<h2>AI performance recommendations</h2><p>Ranked actions based on paid-media delivery, website behavior, recorded outcomes, privacy-safe Vivid benchmarks and reviewed external guidance.</p><section class="mcc-grid">${relevantRecs.map(r=>`<article class="mcc-card"><span class="mcc-status">${esc(r.priority?r.priority+" priority · ":"")}${esc(r.source||"Vivid")} · ${esc(r.signal||"For review")}</span><div class="mcc-rec-meta"><span class="mcc-confidence">${esc(r.confidence||"Evidence-based")} confidence</span></div><h3>${esc(r.title)}</h3><p>${esc(r.reason)}</p>${r.evidence?.length?`<strong>Why Vivid suggested this</strong><ul class="mcc-evidence">${r.evidence.map(e=>`<li>${esc(e)}</li>`).join("")}</ul>`:""}${renderAdaptation(r.adaptation)}${renderProjection(r.projection)}${r.action?`<p><strong>Recommended next step:</strong> ${esc(r.action)}</p>`:""}${r.limitation?`<small class="mcc-limit"><strong>Important:</strong> ${esc(r.limitation)}</small>`:""}<a class="mcc-rec-link" href="${esc(r.href)}"${r.external?' target="_blank" rel="noopener noreferrer"':""}>${r.external?"Open official source":"Inspect supporting evidence"} →</a></article>`).join("")||'<article class="mcc-card"><h3>Collect a baseline</h3><p>Recommendations appear when this platform has enough reporting evidence.</p></article>'}</section><p class="mcc-coverage">Recommendations refresh from saved evidence when you open this dashboard. Anonymous comparisons appear only after privacy and reliability thresholds are met. No campaign, bid, budget or spending change is made without review and approval.</p>`:""}
${!active?`<details class="mcc-roadmap"><summary>More platforms · planned integrations</summary><p>These platforms are not connected and contribute no metrics above.</p><section class="mcc-grid">${roadmap.map(c=>`<article class="mcc-card"><div class="mcc-roadmap-title">${platformLogo(c.id,c.name)}<div><small>${esc(c.category)}</small><h3>${esc(c.name)}</h3></div></div><span class="mcc-status">${esc(c.stage)}</span><p>${esc(c.purpose)}</p></article>`).join("")}</section></details>`:""}</main>`;
}
module.exports={CONNECTORS,dateRange,summarize,recommendations,intelligenceRecommendations,renderCommandCenter};
