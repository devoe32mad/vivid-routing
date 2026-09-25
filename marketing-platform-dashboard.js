"use strict";
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=value=>Number.isFinite(Number(value))?Number(value):0;
const number=value=>n(value).toLocaleString("en-US",{maximumFractionDigits:2});
const currency=(value,code)=>`${number(value)} ${code}`;
const total=(rows,key)=>rows.reduce((s,r)=>s+n(r[key]),0);
const rate=(a,b,suffix="%")=>b?number(100*a/b)+suffix:"—";
const timestamp=value=>value&&Number.isFinite(new Date(value).getTime())?new Date(value).toISOString().replace("T"," ").replace(/\.\d+Z$/," UTC"):"Not yet";
function dashboardHref(scope,range,platform="",campaign="") {
  const root=scope.kind==="enterprise"?`/org-marketing-command-center/advertiser/${scope.advertiserId}`:"/admin/marketing-command-center";
  const params=new URLSearchParams({from:range.from,to:range.to});
  if(scope.kind==="enterprise")params.set("organization_id",scope.orgId);
  if(scope.accountSelection)params.set("account",scope.userId);
  if(platform)params.set("platform",platform);
  if(campaign)params.set("campaign",campaign);
  return root+"?"+params;
}
const sourceHref=(id,scope)=>scope.kind==="enterprise"?`/org-campaign/${Number(id)}?organization_id=${scope.orgId}`:`/admin/view-campaign/${Number(id)}`;
function googleMoney(rows,key) {
  const groups=new Map();
  for(const r of rows)groups.set(r.currency_code,(groups.get(r.currency_code)||0)+n(r[key]));
  return [...groups].map(([code,value])=>currency(key==="cost_micros"?value/1e6:value,code)).join(" · ")||"—";
}
function googleMetrics(rows) {
  const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");
  return [["Impressions",rows.length?number(impressions):"—"],["Clicks",rows.length?number(clicks):"—"],["Reported conversions",rows.length?number(total(rows,"conversions")):"—"],["Spend",googleMoney(rows,"cost_micros")],["Click-through rate",rate(clicks,impressions)],["Reported value",googleMoney(rows,"conversion_value")]];
}
function metaMetrics(rows) {
  const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");
  return [["Impressions",rows.length?number(impressions):"—"],["Clicks",rows.length?number(clicks):"—"],["Link clicks",rows.length?number(total(rows,"link_clicks")):"—"],["Spend",googleMoney(rows,"cost_micros")],["Click-through rate",rate(clicks,impressions)],["Reported purchases",rows.length?number(total(rows,"purchases")):"—"],["Reported leads",rows.length?number(total(rows,"leads")):"—"],["Reported purchase value",googleMoney(rows,"purchase_value")]];
}
function linkedinMetrics(rows) {
  const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");
  return [["Impressions",rows.length?number(impressions):"—"],["Clicks",rows.length?number(clicks):"—"],["Landing-page clicks",rows.length?number(total(rows,"link_clicks")):"—"],["Spend",googleMoney(rows,"cost_micros")],["Click-through rate",rate(clicks,impressions)],["Reported conversions",rows.length?number(total(rows,"conversions")):"—"],["Reported leads",rows.length?number(total(rows,"leads")):"—"],["Reported conversion value",googleMoney(rows,"conversion_value")]];
}
function analyticsMetrics(rows) {
  const sessions=total(rows,"sessions"),engaged=total(rows,"engaged_sessions");
  return [["Visited · website sessions",rows.length?number(sessions):"—"],["Visitors",rows.length?number(total(rows,"users")):"—"],["Engaged · meaningful visits",rows.length?number(engaged):"—"],["Engagement rate",rate(engaged,sessions)],["Acted · key actions",rows.length?number(total(rows,"key_events")):"—"],["Purchased · GA4-reported revenue",rows.length?currency(total(rows,"revenue"),"USD"):"—"]];
}
const titleCase=value=>String(value||"").replace(/^https?:\/\//,"").replace(/^www\./,"").split(/[._-]/).filter(Boolean).map(v=>v.charAt(0).toUpperCase()+v.slice(1)).join(" ");
function analyticsSourceLabel(source,medium){
  source=String(source||"").trim();medium=String(medium||"").trim();
  if(source==="(direct)"||medium==="(none)")return "Direct visits";
  if(source==="(not set)"||medium==="(not set)"||source==="(data not available)")return "Unidentified traffic";
  const name=titleCase(source)||"Unknown";
  if(medium==="cpc")return name+" Ads";
  if(["paid-social","paid_social","paid"].includes(medium))return name+" paid traffic";
  if(medium==="organic")return ["google","bing"].includes(source.toLowerCase())?name+" organic search":"Organic "+name;
  if(medium==="organic_social")return "Organic "+name;
  if(medium==="email")return name+" email";
  if(medium==="ai-assistant"||medium==="referral")return name+" referrals";
  return name+(medium?" · "+titleCase(medium):"");
}
function buildPlatforms({scope,range,campaigns,squareStatus,googleEvidence,googleEnabled,googleAutoSync=true,metaEvidence,metaEnabled=false,metaAutoSync=true,linkedinEvidence,linkedinEnabled=false,linkedinAutoSync=true,analyticsEvidence,analyticsEnabled=false,analyticsAutoSync=true}) {
  const square=typeof squareStatus==="object"&&squareStatus?squareStatus:{label:squareStatus};
  const vividMetrics=rows=>[["Scans",number(total(rows,"scans"))],["Intent actions",number(total(rows,"clicks"))],["Recorded conversions",number(total(rows,"conversions"))],["Recorded value · USD",currency(total(rows,"conversion_value"),"USD")]];
  const squareMetrics=rows=>[["Matched purchases",number(total(rows,"square_conversions"))],["Matched net value",currency(total(rows,"square_value"),"USD")]];
  const matched=campaigns.filter(c=>n(c.square_conversions)>0);
  const platforms=[{
    id:"vivid",name:"Vivid",mark:"V",category:"Placements & engagement",status:"Live campaign records",available:true,
    campaignCount:campaigns.length,countLabel:"campaigns",freshness:"Updated when you open this dashboard",metrics:vividMetrics(campaigns),
    note:"Intent includes offer, map and destination actions. Recorded conversions include matched Square purchases; they are not added again. Dates use UTC.",
    columns:["Scans","Intent actions","Recorded conversions","Recorded value · USD"],
    rows:campaigns.map(c=>({key:String(c.id),name:c.name,context:`Campaign ${c.id}`,cells:vividMetrics([c]).map(m=>m[1]),metrics:vividMetrics([c]),href:sourceHref(c.id,scope),action:"Open campaign workspace"}))
  },{
    id:"square",name:"Square",mark:"S",category:"Campaign-attributed sales",status:square.label||"Not connected",available:Boolean(square.connected)||matched.length>0||scope.kind==="enterprise",
    campaignCount:matched.length,countLabel:"matched campaigns",freshness:square.connected?`Last sync: ${timestamp(square.lastSuccess)}`:"Based on recorded campaign conversions",metrics:[...(square.totals===null?[["Collected","—"],["Refunded","—"],["Net collected","—"]]:Array.isArray(square.totals)?[
      ["Completed payments",number(total(square.totals,"payments"))],
      ...["gross","refunded","net"].map((key,i)=>[["Collected","Refunded","Net collected"][i],square.totals.map(t=>currency(t[key]/100,t.currency)).join(" · ")||"—"])
    ]:[]),...squareMetrics(matched)],
    note:"Collected and net collected cover all imported completed Square payments in the selected period, including tax and tips. They are not added to Vivid revenue. Campaign results below cover only attributed purchases. Completed USD purchases matched to Vivid campaigns, with refunds reflected in net value. This is a subset of Vivid conversions, not all merchant sales. Scans, intent and impressions are not Square metrics. Dates use UTC.",
    columns:["Matched purchases","Matched net value · USD"],
    rows:matched.map(c=>({key:String(c.id),name:c.name,context:`Campaign ${c.id}`,cells:squareMetrics([c]).map(m=>m[1]),metrics:squareMetrics([c]),href:scope.kind==="advertiser"?`/integrations/square/production/customers/${scope.userId}/sales?${new URLSearchParams({from:range.from,to:range.to,campaign:String(c.id)})}`:sourceHref(c.id,scope),action:scope.kind==="advertiser"?"View matched payments & refunds":"Open shared campaign"})),
    manageHref:scope.kind==="advertiser"?`/integrations/square/production/customers/${scope.userId}${square.connected?"/sales":""}`:"",manageLabel:square.connected?"All merchant transactions":"Connect Square"
  }];
  if(scope.kind==="advertiser" && scope.privateAdsAllowed!==false) {
    const connections=googleEvidence?.connections||[],raw=googleEvidence?.rows||[];
    // A campaign can have more than one name/status across imported days. Its
    // identity is account + campaign ID, not the display name.
    const grouped=new Map();
    for(const r of raw){const key=`${r.connection_id}:${r.campaign_id}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);}
    const inventory=new Map((googleEvidence?.campaigns||[]).map(r=>[`${r.connection_id}:${r.campaign_id}`,r]));
    for(const key of inventory.keys())if(!grouped.has(key))grouped.set(key,[]);
    const attention=connections.some(c=>c.status==="attention_required"||c.last_error);
    const stale=connections.some(c=>!c.last_synced_at||Date.now()-new Date(c.last_synced_at)>2*3600000);
    platforms.push({id:"google_ads",name:"Google Ads",mark:"G",category:"Paid search & media",available:connections.length>0,
      status:!googleEnabled?"Awaiting application setup":!connections.length?"Ready to connect":attention?"Sync needs attention":!googleAutoSync?"Automatic sync disabled":stale?"Awaiting fresh reports":"Automatic hourly sync",
      campaignCount:grouped.size,countLabel:"known campaigns",accountCount:connections.length,
      freshness:connections.length?connections.map(c=>`${c.account_name}: ${timestamp(c.last_synced_at)}`).join(" · "):"No account connected",metrics:googleMetrics(raw),
      note:"Campaign names and statuses reflect the latest sync, regardless of the selected reporting dates. Campaigns without imported results show dashes. Totals cover all connected Google accounts and imported campaign results in this period. Currencies stay separate. Conversions and value are Google's reported actions, not verified sales. Scans and intent are not provided. Dates follow each account's timezone; missing reports are not zero activity.",
      columns:["Channel","Status","Impressions","Clicks","CTR","Avg. CPC","Spend","Reported conversions","Reported value"],
      rows:[...grouped].map(([key,rows])=>{const r={...rows[0],...inventory.get(key)},c=connections.find(c=>String(c.id)===String(r.connection_id));const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");return {key,name:r.campaign_name,context:`${c?.account_name||"Google account"} · ${r.campaign_id}${rows.length?"":" · No reporting data for this period"}`,metrics:googleMetrics(rows),cells:[r.channel||"—",r.campaign_status||"Not reported",rows.length?number(impressions):"—",rows.length?number(clicks):"—",rate(clicks,impressions),clicks?currency(total(rows,"cost_micros")/1e6/clicks,r.currency_code):"—",googleMoney(rows,"cost_micros"),rows.length?number(total(rows,"conversions")):"—",googleMoney(rows,"conversion_value")],href:`/admin/connectors/google-ads/${Number(r.connection_id)}?${new URLSearchParams(range)}`,action:"Account sync & import history",daily:(googleEvidence?.daily||[]).filter(d=>String(d.connection_id)===String(r.connection_id)&&String(d.campaign_id)===String(r.campaign_id)),timezone:c?.account_timezone};}),
      manageHref:"/admin/connectors/google-ads",manageLabel:connections.length?"Manage Google accounts":"Connect Google Ads"});
    const metaConnections=metaEvidence?.connections||[],metaRaw=metaEvidence?.rows||[],metaGrouped=new Map();
    for(const r of metaRaw){const key=`${r.connection_id}:${r.campaign_id}`;if(!metaGrouped.has(key))metaGrouped.set(key,[]);metaGrouped.get(key).push(r);}
    const metaAttention=metaConnections.some(c=>c.status==="attention_required"||c.last_error);
    const metaStale=metaConnections.some(c=>!c.last_synced_at||Date.now()-new Date(c.last_synced_at)>2*3600000);
    platforms.push({id:"meta",name:"Meta Ads",mark:"M",category:"Facebook & Instagram paid media",available:metaConnections.length>0,
      status:!metaEnabled?"Awaiting application setup":!metaConnections.length?"Ready to connect":metaAttention?"Sync needs attention":!metaAutoSync?"Automatic sync disabled":metaStale?"Awaiting fresh reports":"Automatic hourly sync",
      campaignCount:metaGrouped.size,countLabel:"campaigns with reporting",accountCount:metaConnections.length,
      freshness:metaConnections.length?metaConnections.map(c=>`${c.account_name}: ${timestamp(c.last_synced_at)}`).join(" · "):"No account connected",metrics:metaMetrics(metaRaw),
      note:"Totals cover all connected Meta ad accounts and imported Facebook and Instagram campaign results in this period. Currencies stay separate. Purchases, leads and value are Meta-reported actions, not verified Vivid sales, and can overlap other platforms. Dates follow each ad account’s timezone; missing reports are not zero activity.",
      columns:["Objective","Impressions","Clicks","Link clicks","CTR","Avg. CPC","Spend","Reported purchases","Reported leads","Reported purchase value"],
      rows:[...metaGrouped].map(([key,rows])=>{const r=rows[0],c=metaConnections.find(c=>String(c.id)===String(r.connection_id));const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");return {key,name:r.campaign_name,context:`${c?.account_name||"Meta account"} · ${r.campaign_id}`,metrics:metaMetrics(rows),cells:[r.objective||"Not reported",number(impressions),number(clicks),number(total(rows,"link_clicks")),rate(clicks,impressions),clicks?currency(total(rows,"cost_micros")/1e6/clicks,r.currency_code):"—",googleMoney(rows,"cost_micros"),number(total(rows,"purchases")),number(total(rows,"leads")),googleMoney(rows,"purchase_value")],href:`/admin/connectors/meta-ads/${Number(r.connection_id)}?${new URLSearchParams(range)}`,action:"Account sync & import history",daily:(metaEvidence?.daily||[]).filter(d=>String(d.connection_id)===String(r.connection_id)&&String(d.campaign_id)===String(r.campaign_id)),dailyKind:"meta",timezone:c?.account_timezone};}),
      manageHref:"/admin/connectors/meta-ads",manageLabel:metaConnections.length?"Manage Meta accounts":"Connect Meta Ads"});
  }
  if(scope.kind==="advertiser") {
    const linkedinConnections=linkedinEvidence?.connections||[],linkedinRaw=linkedinEvidence?.rows||[],linkedinGrouped=new Map();
    for(const r of linkedinRaw){const key=`${r.connection_id}:${r.campaign_id}`;if(!linkedinGrouped.has(key))linkedinGrouped.set(key,[]);linkedinGrouped.get(key).push(r);}
    const linkedinAttention=linkedinConnections.some(c=>c.status==="attention_required"||c.last_error);
    const linkedinStale=linkedinConnections.some(c=>!c.last_synced_at||Date.now()-new Date(c.last_synced_at)>2*3600000);
    platforms.push({id:"linkedin",name:"LinkedIn Ads",mark:"in",category:"Professional paid media",available:linkedinConnections.length>0,
      status:!linkedinConnections.length&&!linkedinEnabled?"Awaiting application setup":!linkedinConnections.length?"Ready to connect":linkedinAttention?"Sync needs attention":!linkedinAutoSync?"Automatic sync disabled":linkedinStale?"Awaiting fresh reports":"Automatic hourly sync",
      campaignCount:linkedinGrouped.size,countLabel:"campaigns with reporting",accountCount:linkedinConnections.length,
      freshness:linkedinConnections.length?linkedinConnections.map(c=>`${c.account_name}: ${timestamp(c.last_synced_at)}`).join(" · "):"No account connected",metrics:linkedinMetrics(linkedinRaw),
      note:"Totals cover connected LinkedIn ad accounts and imported campaign results. Currencies stay separate. Conversions, leads and value are LinkedIn-reported outcomes, not verified Vivid sales. Missing reports are not zero activity.",
      columns:["Impressions","Clicks","Landing-page clicks","CTR","Avg. CPC","Spend","Reported conversions","Reported leads","Reported conversion value"],
      rows:[...linkedinGrouped].map(([key,rows])=>{const r=rows[0],c=linkedinConnections.find(c=>String(c.id)===String(r.connection_id));const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");return {key,name:r.campaign_name,context:`${c?.account_name||"LinkedIn account"} · ${r.campaign_id}`,metrics:linkedinMetrics(rows),cells:[number(impressions),number(clicks),number(total(rows,"link_clicks")),rate(clicks,impressions),clicks?currency(total(rows,"cost_micros")/1e6/clicks,r.currency_code):"—",googleMoney(rows,"cost_micros"),number(total(rows,"conversions")),number(total(rows,"leads")),googleMoney(rows,"conversion_value")],href:`/admin/connectors/linkedin-ads/${Number(r.connection_id)}?${new URLSearchParams(range)}`,action:"Account sync & import history"};}),
      manageHref:scope.privateAdsAllowed!==false?"/admin/connectors/linkedin-ads":"",manageLabel:linkedinConnections.length?"Manage LinkedIn accounts":"Connect LinkedIn Ads"});
  }
  if(scope.kind==="advertiser"&&scope.privateAdsAllowed!==false&&(analyticsEnabled||(analyticsEvidence?.connections||[]).length)){
    const connections=analyticsEvidence?.connections||[],raw=analyticsEvidence?.rows||[],grouped=new Map();
    for(const r of raw){const key=`${r.connection_id}:${r.source}:${r.medium}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);}
    const attention=connections.some(c=>c.status==="attention_required"||c.last_error),stale=connections.some(c=>!c.last_synced_at||Date.now()-new Date(c.last_synced_at)>2*3600000);
    platforms.push({id:"ga4",name:"Website Traffic & Engagement",heading:"Website Traffic & Engagement",mark:"W",category:"What visitors did after arriving",available:connections.length>0,
      status:!analyticsEnabled?"Awaiting application setup":!connections.length?"Ready to connect":attention?"Sync needs attention":!analyticsAutoSync?"Automatic sync disabled":stale?"Awaiting fresh reports":"Automatic hourly sync",
      campaignCount:grouped.size,countLabel:"traffic sources",accountCount:connections.length,
      freshness:connections.length?connections.map(c=>`${c.property_name}: ${timestamp(c.last_synced_at)}`).join(" · "):"No property connected",metrics:analyticsMetrics(raw),
      note:"Website Traffic & Engagement shows what happened after people reached the website: visits, meaningful engagement, key actions and GA4-reported revenue. Open a source for the original GA4 evidence. Revenue is not verified Vivid or POS revenue and is never added to verified sales.",
      columns:["Traffic source","Visited","Visitors","Engaged","Engagement rate","Website events","Acted","Purchased · GA4 revenue"],
      rows:[...grouped].map(([key,rows])=>{const r=rows[0],c=connections.find(c=>String(c.id)===String(r.connection_id)),sessions=total(rows,"sessions"),engaged=total(rows,"engaged_sessions");return {key,name:analyticsSourceLabel(r.source,r.medium),context:`${c?.property_name||"GA4 property"} · Original GA4 source: ${r.source||"(direct)"} / ${r.medium||"(none)"}`,metrics:analyticsMetrics(rows),cells:[analyticsSourceLabel(r.source,r.medium),number(sessions),number(total(rows,"users")),number(engaged),rate(engaged,sessions),number(total(rows,"event_count")),number(total(rows,"key_events")),currency(total(rows,"revenue"),"USD")],href:`/admin/connectors/google-analytics/${Number(r.connection_id)}?${new URLSearchParams(range)}`,action:"View source evidence"};}),
      viewLabel:"View website traffic sources",
      manageHref:"/admin/connectors/google-analytics",manageLabel:connections.length?"Manage Analytics properties":"Connect Google Analytics"});
  }
  return platforms;
}
const metricsHtml=metrics=>`<dl class="mcc-metrics">${metrics.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>`;
function platformCard(p,scope,range) {
  return `<article class="mcc-platform" data-platform="${p.id}"><header><span class="mcc-platform-mark" aria-hidden="true">${p.mark}</span><div><small>${esc(p.category)}</small><h3>${esc(p.name)}</h3></div></header><span class="mcc-status">${esc(p.status)}</span><p class="mcc-count">${p.campaignCount} ${esc(p.countLabel)}${p.accountCount!==undefined?` · ${p.accountCount} accounts`:""}</p>${metricsHtml(p.available?p.metrics:p.metrics.map(([label])=>[label,"—"]))}<p class="mcc-freshness">${esc(p.freshness)}</p><footer>${p.available?`<a class="mcc-primary" href="${esc(dashboardHref(scope,range,p.id))}">${esc(p.viewLabel||`View ${p.name} campaigns`)} <span aria-hidden="true">→</span></a>`:p.manageHref&&p.status!=="Awaiting application setup"&&p.status!=="Not enabled"?`<a href="${esc(p.manageHref)}">${esc(p.manageLabel)} →</a>`:"<span>Reporting not connected</span>"}</footer></article>`;
}
function renderPlatformDetail(p,scope,range,campaignKey="") {
  const selected=campaignKey?p.rows.find(r=>r.key===campaignKey):null;
  if(campaignKey&&!selected)return `<section class="mcc-panel"><h2>Campaign not found in this period</h2><p>Choose another period or return to the platform's campaigns.</p><a href="${esc(dashboardHref(scope,range,p.id))}">All ${esc(p.name)} campaigns</a></section>`;
  const rows=selected?[selected]:p.rows;
  return `<section class="mcc-panel"><div class="mcc-section-heading"><div><small>${esc(p.category)}</small><h2>${esc(selected?.name||p.name+" overview")}</h2><p>${esc(selected?.context||`${p.campaignCount} ${p.countLabel} · ${p.status}`)}</p></div>${p.manageHref?`<a href="${esc(p.manageHref)}">${esc(p.manageLabel)}</a>`:""}</div>${metricsHtml(selected?.metrics||p.metrics)}<p class="mcc-freshness">${esc(p.freshness)}</p><p>${esc(p.note)}</p></section>
  <section class="mcc-panel" id="campaign-evidence"><div class="mcc-section-heading"><h2>${selected?"Campaign results":"All campaigns"}</h2><span>${esc(range.from)} – ${esc(range.to)}</span></div><div class="mcc-scroll"><table><thead><tr><th>Campaign</th>${p.columns.map(label=>`<th>${esc(label)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr><td><a href="${esc(dashboardHref(scope,range,p.id,r.key))}">${esc(r.name)}</a><small class="mcc-row-context">${esc(r.context)}</small></td>${r.cells.map(value=>`<td>${esc(value)}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${p.columns.length+1}">No ${p.id==="square"?"matched campaign purchases":p.id==="google_ads"?"imported campaign reporting rows":"campaign records"} in this period.</td></tr>`}</tbody></table></div>${selected?`<p><a href="${esc(selected.href)}">${esc(selected.action)} →</a></p>`:"<p>Select a campaign to inspect its results and supporting details.</p>"}</section>
  ${selected?.daily?selected.dailyKind==="meta"?`<section class="mcc-panel"><h2>Daily performance</h2><p>${esc(selected.timezone)} · Meta-reported results</p><div class="mcc-scroll"><table><thead><tr><th>Date</th><th>Impressions</th><th>Clicks</th><th>Link clicks</th><th>Spend</th><th>Reported purchases</th><th>Reported leads</th><th>Reported purchase value</th></tr></thead><tbody>${selected.daily.map(d=>`<tr><td>${esc(d.date)}</td><td>${number(d.impressions)}</td><td>${number(d.clicks)}</td><td>${number(d.link_clicks)}</td><td>${esc(currency(n(d.cost_micros)/1e6,d.currency_code))}</td><td>${number(d.purchases)}</td><td>${number(d.leads)}</td><td>${esc(currency(n(d.purchase_value),d.currency_code))}</td></tr>`).join("")||'<tr><td colspan="8">No daily reporting rows available.</td></tr>'}</tbody></table></div></section>`:`<section class="mcc-panel"><h2>Daily performance</h2><p>${esc(selected.timezone)} · Google-reported results</p><div class="mcc-scroll"><table><thead><tr><th>Date</th><th>Impressions</th><th>Clicks</th><th>Spend</th><th>Reported conversions</th><th>Reported value</th></tr></thead><tbody>${selected.daily.map(d=>`<tr><td>${esc(d.date)}</td><td>${number(d.impressions)}</td><td>${number(d.clicks)}</td><td>${esc(currency(n(d.cost_micros)/1e6,d.currency_code))}</td><td>${number(d.conversions)}</td><td>${esc(currency(n(d.conversion_value),d.currency_code))}</td></tr>`).join("")||'<tr><td colspan="6">No daily reporting rows available.</td></tr>'}</tbody></table></div></section>`:""}`;
}
const platformStyle=`
.mcc-platform-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.mcc-platform,.mcc-panel{background:#fff;border:1px solid #d9e2ed;border-radius:16px;padding:24px;min-width:0}.mcc-platform{display:flex;flex-direction:column;box-shadow:0 4px 18px #102b5006}.mcc-platform header{display:flex;gap:12px;align-items:center;margin-bottom:18px}.mcc-platform header h3{margin:2px 0;font-size:22px}.mcc-platform-mark{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#eaf2ff;color:#164d93;font-size:23px;font-weight:750;flex-shrink:0}.mcc-platform .mcc-status{align-self:flex-start}.mcc-count{font-size:13px;color:#53677c}.mcc-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 16px;margin:22px 0}.mcc-metrics>div{min-width:0}.mcc-metrics dt{font-size:12px;color:#53677c;margin-bottom:5px}.mcc-metrics dd{margin:0;font-weight:700;font-size:24px;line-height:1.25;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.mcc-freshness{font-size:12px;color:#53677c;overflow-wrap:anywhere}.mcc-platform footer{margin-top:auto;padding-top:18px;border-top:1px solid #e8edf3}.mcc-primary{display:flex;justify-content:space-between;align-items:center;gap:8px;text-decoration:none}.mcc-panel{margin:22px 0}.mcc-panel>.mcc-metrics{grid-template-columns:repeat(3,minmax(0,1fr));padding:20px 0;border-top:1px solid #e8edf3;border-bottom:1px solid #e8edf3}.mcc-section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.mcc-section-heading h2{margin:0}.mcc-row-context{display:block;font-size:11px;margin-top:4px}.mcc-breadcrumb{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 16px}.mcc a:focus-visible,.mcc summary:focus-visible{outline:3px solid #3275c6;outline-offset:4px}.mcc-roadmap{margin-top:32px;padding:22px;border:1px solid #d9e2ed;border-radius:14px}.mcc-roadmap>.mcc-grid{margin-top:20px}@media(max-width:1000px){.mcc-platform-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.mcc-platform-grid{grid-template-columns:1fr}.mcc-platform,.mcc-panel{padding:18px}.mcc-panel>.mcc-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.mcc-metrics dd{font-size:22px}}`;
module.exports={buildPlatforms,platformCard,renderPlatformDetail,platformStyle,dashboardHref,googleMetrics,metaMetrics,linkedinMetrics,analyticsMetrics,analyticsSourceLabel};
