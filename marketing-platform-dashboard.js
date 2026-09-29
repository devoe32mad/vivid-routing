"use strict";
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=value=>Number.isFinite(Number(value))?Number(value):0;
const number=value=>n(value).toLocaleString("en-US",{maximumFractionDigits:2});
const currency=(value,code)=>`${number(value)} ${code}`;
const total=(rows,key)=>rows.reduce((s,r)=>s+n(r[key]),0);
const rate=(a,b,suffix="%")=>b?number(100*a/b)+suffix:"—";
const timestamp=value=>value&&Number.isFinite(new Date(value).getTime())?new Date(value).toISOString().replace("T"," ").replace(/\.\d+Z$/," UTC"):"Not yet";
function platformLogo(id,label="") {
  const title=esc(label||id),common=`viewBox="0 0 48 48" role="img" aria-label="${title}"`;
  const logos={
    vivid:`<svg ${common}><circle cx="24" cy="10" r="7" fill="#f4b400"/><circle cx="35" cy="20" r="7" fill="#34a853"/><circle cx="31" cy="34" r="7" fill="#8e44ad"/><circle cx="17" cy="34" r="7" fill="#4285f4"/><circle cx="12" cy="20" r="7" fill="#ea4335"/></svg>`,
    square:`<svg ${common}><rect x="5" y="5" width="38" height="38" rx="8" fill="#111"/><rect x="14" y="14" width="20" height="20" rx="4" fill="#fff"/><rect x="19" y="19" width="10" height="10" rx="2" fill="#111"/></svg>`,
    google_ads:`<svg ${common}><path d="M18 7h9l16 29a6 6 0 0 1-10 6L18 15a6 6 0 0 1 0-8Z" fill="#4285f4"/><path d="M18 7a6 6 0 0 1 5 9L10 40a6 6 0 1 1-10-6L18 7Z" fill="#34a853"/><circle cx="38" cy="37" r="7" fill="#fbbc04"/></svg>`,
    meta:`<svg ${common}><path d="M5 31c3-12 7-18 12-18 7 0 11 20 16 20 4 0 7-6 10-15-1-4-3-6-6-6-5 0-9 7-13 15-4 8-7 13-12 13-7 0-10-5-7-9Z" fill="none" stroke="#1877f2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    linkedin:`<svg ${common}><rect x="4" y="4" width="40" height="40" rx="5" fill="#0a66c2"/><circle cx="14" cy="16" r="3" fill="#fff"/><path d="M11 21h6v17h-6zm10 0h6v2.5c2-4 11-4 11 5.5v9h-6v-8c0-4-5-4-5 0v8h-6Z" fill="#fff"/></svg>`,
    tiktok:`<svg ${common}><path d="M28 7c2 7 6 10 12 10v7c-4 0-8-1-12-4v13c0 9-10 13-17 8-8-6-4-19 6-20 1 0 2 0 4 1v7c-5-2-8 4-5 7 3 3 7 1 7-3V7Z" fill="#111"/><path d="M30 7c1 4 4 7 8 9" fill="none" stroke="#25f4ee" stroke-width="3"/><path d="M14 40c-6-4-4-14 3-16" fill="none" stroke="#fe2c55" stroke-width="3"/></svg>`,
    youtube:`<svg ${common}><rect x="3" y="10" width="42" height="28" rx="8" fill="#f00"/><path d="m20 17 13 7-13 7Z" fill="#fff"/></svg>`,
    reddit:`<svg ${common}><circle cx="24" cy="25" r="19" fill="#ff4500"/><path d="m29 10 2-6 7 2" fill="none" stroke="#ff4500" stroke-width="2.5" stroke-linecap="round"/><circle cx="39" cy="7" r="3" fill="#ff4500"/><ellipse cx="24" cy="26" rx="13" ry="10" fill="#fff"/><circle cx="19" cy="24" r="2" fill="#ff4500"/><circle cx="29" cy="24" r="2" fill="#ff4500"/><path d="M18 30c3 3 9 3 12 0" fill="none" stroke="#ff4500" stroke-width="2" stroke-linecap="round"/></svg>`,
    ga4:`<svg ${common}><rect x="6" y="26" width="9" height="16" rx="4.5" fill="#f9ab00"/><rect x="20" y="15" width="9" height="27" rx="4.5" fill="#e37400"/><circle cx="37" cy="35" r="7" fill="#e37400"/></svg>`,
    pinterest:`<svg ${common}><circle cx="24" cy="24" r="21" fill="#e60023"/><path d="M22 35c2-6 3-10 4-15 1-4-5-5-6 0-1 4 1 6 1 6-5-3-3-14 5-14 7 0 10 5 9 11-1 8-9 11-13 7l-2 8Z" fill="#fff"/></svg>`,
    snapchat:`<svg ${common}><rect x="3" y="3" width="42" height="42" rx="10" fill="#fffc00"/><path d="M24 11c-6 0-8 5-8 10 0 2-1 4-4 6 2 2 4 2 5 3 1 3 3 5 7 5s6-2 7-5c1-1 3-1 5-3-3-2-4-4-4-6 0-5-2-10-8-10Z" fill="#fff" stroke="#111" stroke-width="1.8"/></svg>`,
    threads:`<svg ${common}><circle cx="24" cy="24" r="21" fill="#111"/><path d="M31 19c-2-6-14-7-16 1-2 9 13 9 17 3 3 9-2 14-8 14-10 0-15-10-11-19 5-11 22-10 25 2" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
    search_console:`<svg ${common}><path d="M9 10h30a4 4 0 0 1 4 4v25H5V14a4 4 0 0 1 4-4Z" fill="#4285f4"/><path d="M15 6h18v8H15Z" fill="#a8c7fa"/><circle cx="22" cy="25" r="7" fill="#fff"/><path d="m27 30 7 7" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`,
    shopify:`<svg ${common}><path d="m9 14 30-5 4 33-36-3Z" fill="#95bf47"/><path d="M17 16c1-8 11-11 14-3" fill="none" stroke="#5e8e3e" stroke-width="3"/><path d="M30 18c-7-3-13 0-12 5 1 6 11 4 10 9-1 3-6 3-10 1" fill="none" stroke="#fff" stroke-width="4"/></svg>`
  };
  return `<span class="mcc-platform-logo">${logos[id]||`<span class="mcc-platform-fallback" aria-label="${title}">${esc(String(label||id).slice(0,2))}</span>`}</span>`;
}
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
function returnMetrics(rows,valueKey,{valueMicros=false}={}) {
  if(!rows.length)return [["Reported ROAS","—"],["ROI","—"]];
  const groups=new Map();
  for(const row of rows){
    const code=row.currency_code||"USD",group=groups.get(code)||{spend:0,value:0};
    group.spend+=n(row.cost_micros)/1e6;
    group.value+=n(row[valueKey])/(valueMicros?1e6:1);
    groups.set(code,group);
  }
  const roas=[...groups].map(([code,group])=>group.spend?`${number(group.value/group.spend)}x ${code}`:`— ${code}`).join(" · ")||"—";
  const hasSpend=[...groups.values()].some(group=>group.spend>0);
  return [["Reported ROAS",roas],["ROI",hasSpend?"Add margin/cost data":"—"]];
}
function googleMetrics(rows) {
  const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");
  return [["Impressions",rows.length?number(impressions):"—"],["Clicks",rows.length?number(clicks):"—"],["Reported conversions",rows.length?number(total(rows,"conversions")):"—"],["Spend",googleMoney(rows,"cost_micros")],["Click-through rate",rate(clicks,impressions)],["Reported value",googleMoney(rows,"conversion_value")],...returnMetrics(rows,"conversion_value")];
}
function metaMetrics(rows) {
  const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");
  return [["Impressions",rows.length?number(impressions):"—"],["Clicks",rows.length?number(clicks):"—"],["Link clicks",rows.length?number(total(rows,"link_clicks")):"—"],["Spend",googleMoney(rows,"cost_micros")],["Click-through rate",rate(clicks,impressions)],["Reported purchases",rows.length?number(total(rows,"purchases")):"—"],["Reported leads",rows.length?number(total(rows,"leads")):"—"],["Reported purchase value",googleMoney(rows,"purchase_value")],...returnMetrics(rows,"purchase_value")];
}
function linkedinMetrics(rows) {
  const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");
  return [["Impressions",rows.length?number(impressions):"—"],["Clicks",rows.length?number(clicks):"—"],["Landing-page clicks",rows.length?number(total(rows,"link_clicks")):"—"],["Spend",googleMoney(rows,"cost_micros")],["Click-through rate",rate(clicks,impressions)],["Reported conversions",rows.length?number(total(rows,"conversions")):"—"],["Reported leads",rows.length?number(total(rows,"leads")):"—"],["Reported conversion value",googleMoney(rows,"conversion_value")],...returnMetrics(rows,"conversion_value")];
}
function tiktokMetrics(rows) {
  const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");
  return [["Impressions",rows.length?number(impressions):"—"],["Clicks",rows.length?number(clicks):"—"],["Video plays",rows.length?number(total(rows,"video_views")):"—"],["6-second views",rows.length?number(total(rows,"video_views_6s")):"—"],["Spend",googleMoney(rows,"cost_micros")],["Click-through rate",rate(clicks,impressions)],["Reported conversions",rows.length?number(total(rows,"conversions")):"—"],["Reported conversion value",googleMoney(rows,"conversion_value")],...returnMetrics(rows,"conversion_value")];
}
function redditMetrics(rows) {
  const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");
  return [["Impressions",rows.length?number(impressions):"—"],["Clicks",rows.length?number(clicks):"—"],["Spend",googleMoney(rows,"cost_micros")],["Click-through rate",rate(clicks,impressions)],["Reported conversions",rows.length?number(total(rows,"conversions")):"—"],["Reported leads",rows.length?number(total(rows,"leads")):"—"],["Reported conversion value",googleMoney(rows,"conversion_value")],...returnMetrics(rows,"conversion_value")];
}
function pinterestMetrics(rows) {
  const clicks=total(rows,"clicks"),impressions=total(rows,"impressions");
  const values=new Map();for(const r of rows)values.set(r.currency_code,(values.get(r.currency_code)||0)+n(r.conversion_value_micros));
  const conversionValue=[...values].map(([code,value])=>currency(value/1e6,code)).join(" · ")||"—";
  return [["Impressions",rows.length?number(impressions):"—"],["Pin clicks",rows.length?number(clicks):"—"],["Outbound clicks",rows.length?number(total(rows,"outbound_clicks")):"—"],["Spend",googleMoney(rows,"cost_micros")],["Click-through rate",rate(clicks,impressions)],["Reported conversions",rows.length?number(total(rows,"conversions")):"—"],["Reported conversion value",conversionValue],...returnMetrics(rows,"conversion_value_micros",{valueMicros:true})];
}
function youtubeMetrics(rows){return [["Views",rows.length?number(total(rows,"views")):"—"],["Watch time",rows.length?number(total(rows,"watch_minutes"))+" min":"—"],["Likes",rows.length?number(total(rows,"likes")):"—"],["Comments",rows.length?number(total(rows,"comments")):"—"],["Shares",rows.length?number(total(rows,"shares")):"—"],["Subscribers gained",rows.length?number(total(rows,"subscribers_gained")):"—"]];}
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
function buildPlatforms({scope,range,campaigns,squareStatus,googleEvidence,googleEnabled,googleAutoSync=true,metaEvidence,metaEnabled=false,metaAutoSync=true,linkedinEvidence,linkedinEnabled=false,linkedinAutoSync=true,tiktokEvidence,tiktokEnabled=false,tiktokAutoSync=true,redditEvidence,redditEnabled=false,redditAutoSync=true,pinterestEvidence,pinterestEnabled=false,pinterestAutoSync=true,youtubeEvidence,youtubeEnabled=false,youtubeAutoSync=true,analyticsEvidence,analyticsEnabled=false,analyticsAutoSync=true}) {
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
      columns:["Channel","Status","Impressions","Clicks","CTR","Avg. CPC","Spend","Reported conversions","Reported value","Reported ROAS","ROI"],
      rows:[...grouped].map(([key,rows])=>{const r={...rows[0],...inventory.get(key)},c=connections.find(c=>String(c.id)===String(r.connection_id));const clicks=total(rows,"clicks"),impressions=total(rows,"impressions"),returns=returnMetrics(rows,"conversion_value");return {key,name:r.campaign_name,context:`${c?.account_name||"Google account"} · ${r.campaign_id}${rows.length?"":" · No reporting data for this period"}`,metrics:googleMetrics(rows),cells:[r.channel||"—",r.campaign_status||"Not reported",rows.length?number(impressions):"—",rows.length?number(clicks):"—",rate(clicks,impressions),clicks?currency(total(rows,"cost_micros")/1e6/clicks,r.currency_code):"—",googleMoney(rows,"cost_micros"),rows.length?number(total(rows,"conversions")):"—",googleMoney(rows,"conversion_value"),returns[0][1],returns[1][1]],href:`/admin/connectors/google-ads/${Number(r.connection_id)}?${new URLSearchParams(range)}`,action:"Account sync & import history",daily:(googleEvidence?.daily||[]).filter(d=>String(d.connection_id)===String(r.connection_id)&&String(d.campaign_id)===String(r.campaign_id)),timezone:c?.account_timezone};}),
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
      columns:["Objective","Impressions","Clicks","Link clicks","CTR","Avg. CPC","Spend","Reported purchases","Reported leads","Reported purchase value","Reported ROAS","ROI"],
      rows:[...metaGrouped].map(([key,rows])=>{const r=rows[0],c=metaConnections.find(c=>String(c.id)===String(r.connection_id));const clicks=total(rows,"clicks"),impressions=total(rows,"impressions"),returns=returnMetrics(rows,"purchase_value");return {key,name:r.campaign_name,context:`${c?.account_name||"Meta account"} · ${r.campaign_id}`,metrics:metaMetrics(rows),cells:[r.objective||"Not reported",number(impressions),number(clicks),number(total(rows,"link_clicks")),rate(clicks,impressions),clicks?currency(total(rows,"cost_micros")/1e6/clicks,r.currency_code):"—",googleMoney(rows,"cost_micros"),number(total(rows,"purchases")),number(total(rows,"leads")),googleMoney(rows,"purchase_value"),returns[0][1],returns[1][1]],href:`/admin/connectors/meta-ads/${Number(r.connection_id)}?${new URLSearchParams(range)}`,action:"Account sync & import history",daily:(metaEvidence?.daily||[]).filter(d=>String(d.connection_id)===String(r.connection_id)&&String(d.campaign_id)===String(r.campaign_id)),dailyKind:"meta",timezone:c?.account_timezone};}),
      manageHref:"/admin/connectors/meta-ads",manageLabel:metaConnections.length?"Manage Meta accounts":"Connect Meta Ads"});
  }
  if(scope.kind==="advertiser") {
    const youtubeConnections=youtubeEvidence?.connections||[],youtubeRaw=youtubeEvidence?.rows||[],youtubeGrouped=new Map();
    const youtubeCanManage=scope.privateAdsAllowed!==false&&(!youtubeConnections.length||youtubeConnections.some(c=>Number(c.owner_user_id)===Number(scope.userId)));
    for(const r of youtubeRaw){const key=`${r.connection_id}:${r.video_id}`;if(!youtubeGrouped.has(key))youtubeGrouped.set(key,[]);youtubeGrouped.get(key).push(r);}
    const youtubeAttention=youtubeConnections.some(c=>c.status==="attention_required"||c.last_error),youtubeStale=youtubeConnections.some(c=>!c.last_synced_at||Date.now()-new Date(c.last_synced_at)>2*3600000);
    if(youtubeConnections.length||(scope.privateAdsAllowed!==false&&youtubeEnabled))platforms.push({id:"youtube",name:"YouTube Analytics",mark:"▶",category:"Organic video performance",available:youtubeConnections.length>0,status:!youtubeEnabled?"Awaiting application setup":!youtubeConnections.length?"Ready to connect":youtubeAttention?"Sync needs attention":!youtubeAutoSync?"Automatic sync disabled":youtubeStale?"Awaiting fresh reports":"Automatic hourly sync",campaignCount:youtubeGrouped.size,countLabel:"videos with activity",accountCount:youtubeConnections.length,freshness:youtubeConnections.length?youtubeConnections.map(c=>`${c.channel_name}: ${timestamp(c.last_synced_at)}`).join(" · "):"No channel connected",metrics:youtubeMetrics(youtubeRaw),note:"Organic YouTube views, watch time and engagement are kept separate from paid YouTube delivery in Google Ads. These signals do not establish sales or revenue.",columns:["Views","Watch minutes","Average view duration","Likes","Comments","Shares","Subscribers gained","Subscribers lost"],rows:[...youtubeGrouped].map(([key,rows])=>{const r=rows[0],c=youtubeConnections.find(c=>String(c.id)===String(r.connection_id));return{key,name:r.video_title,context:`${c?.channel_name||"YouTube channel"} · ${r.video_id}`,metrics:youtubeMetrics(rows),cells:[number(total(rows,"views")),number(total(rows,"watch_minutes")),number(r.average_view_seconds)+" sec",number(total(rows,"likes")),number(total(rows,"comments")),number(total(rows,"shares")),number(total(rows,"subscribers_gained")),number(total(rows,"subscribers_lost"))],href:youtubeCanManage?`/admin/connectors/youtube-analytics/${Number(r.connection_id)}?${new URLSearchParams(range)}`:"",action:"View channel evidence"};}),manageHref:youtubeCanManage?"/admin/connectors/youtube-analytics":"",manageLabel:youtubeConnections.length?"Manage YouTube channels":"Connect YouTube Analytics",viewLabel:"View YouTube videos"});
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
      columns:["Impressions","Clicks","Landing-page clicks","CTR","Avg. CPC","Spend","Reported conversions","Reported leads","Reported conversion value","Reported ROAS","ROI"],
      rows:[...linkedinGrouped].map(([key,rows])=>{const r=rows[0],c=linkedinConnections.find(c=>String(c.id)===String(r.connection_id));const clicks=total(rows,"clicks"),impressions=total(rows,"impressions"),returns=returnMetrics(rows,"conversion_value");return {key,name:r.campaign_name,context:`${c?.account_name||"LinkedIn account"} · ${r.campaign_id}`,metrics:linkedinMetrics(rows),cells:[number(impressions),number(clicks),number(total(rows,"link_clicks")),rate(clicks,impressions),clicks?currency(total(rows,"cost_micros")/1e6/clicks,r.currency_code):"—",googleMoney(rows,"cost_micros"),number(total(rows,"conversions")),number(total(rows,"leads")),googleMoney(rows,"conversion_value"),returns[0][1],returns[1][1]],href:`/admin/connectors/linkedin-ads/${Number(r.connection_id)}?${new URLSearchParams(range)}`,action:"Account sync & import history"};}),
      manageHref:scope.privateAdsAllowed!==false?"/admin/connectors/linkedin-ads":"",manageLabel:linkedinConnections.length?"Manage LinkedIn accounts":"Connect LinkedIn Ads"});
    const tiktokConnections=tiktokEvidence?.connections||[],tiktokRaw=tiktokEvidence?.rows||[],tiktokGrouped=new Map();
    for(const r of tiktokRaw){const key=`${r.connection_id}:${r.campaign_id}`;if(!tiktokGrouped.has(key))tiktokGrouped.set(key,[]);tiktokGrouped.get(key).push(r);}
    const tiktokAttention=tiktokConnections.some(c=>c.status==="attention_required"||c.last_error);
    const tiktokStale=tiktokConnections.some(c=>!c.last_synced_at||Date.now()-new Date(c.last_synced_at)>2*3600000);
    if(tiktokEnabled||tiktokConnections.length)platforms.push({id:"tiktok",name:"TikTok Ads",mark:"♪",category:"Short-form video advertising",available:tiktokConnections.length>0,
      status:!tiktokConnections.length&&!tiktokEnabled?"Awaiting application setup":!tiktokConnections.length?"Ready to connect":tiktokAttention?"Sync needs attention":!tiktokAutoSync?"Automatic sync disabled":tiktokStale?"Awaiting fresh reports":"Automatic hourly sync",
      campaignCount:tiktokGrouped.size,countLabel:"campaigns with reporting",accountCount:tiktokConnections.length,
      freshness:tiktokConnections.length?tiktokConnections.map(c=>`${c.account_name}: ${timestamp(c.last_synced_at)}`).join(" · "):"No account connected",metrics:tiktokMetrics(tiktokRaw),
      note:"Totals cover connected TikTok advertiser accounts and imported campaign results. Video views, conversions and value are TikTok-reported outcomes, not verified Vivid sales. Currencies stay separate; missing reports are not zero activity.",
      columns:["Objective","Impressions","Clicks","CTR","Avg. CPC","Spend","Video plays","2-second views","6-second views","Reported conversions","Reported conversion value","Reported ROAS","ROI"],
      rows:[...tiktokGrouped].map(([key,rows])=>{const r=rows[0],c=tiktokConnections.find(c=>String(c.id)===String(r.connection_id));const clicks=total(rows,"clicks"),impressions=total(rows,"impressions"),returns=returnMetrics(rows,"conversion_value");return {key,name:r.campaign_name,context:`${c?.account_name||"TikTok account"} · ${r.campaign_id}`,metrics:tiktokMetrics(rows),cells:[r.objective||"Not reported",number(impressions),number(clicks),rate(clicks,impressions),clicks?currency(total(rows,"cost_micros")/1e6/clicks,r.currency_code):"—",googleMoney(rows,"cost_micros"),number(total(rows,"video_views")),number(total(rows,"video_views_2s")),number(total(rows,"video_views_6s")),number(total(rows,"conversions")),googleMoney(rows,"conversion_value"),returns[0][1],returns[1][1]],href:`/admin/connectors/tiktok-ads/${Number(r.connection_id)}?${new URLSearchParams(range)}`,action:"Account sync & import history"};}),
      manageHref:scope.privateAdsAllowed!==false?"/admin/connectors/tiktok-ads":"",manageLabel:tiktokConnections.length?"Manage TikTok accounts":"Connect TikTok Ads"});
    const redditConnections=redditEvidence?.connections||[],redditRaw=redditEvidence?.rows||[],redditGrouped=new Map();
    for(const r of redditRaw){const key=`${r.connection_id}:${r.campaign_id}`;if(!redditGrouped.has(key))redditGrouped.set(key,[]);redditGrouped.get(key).push(r);}
    const redditAttention=redditConnections.some(c=>c.status==="attention_required"||c.last_error),redditStale=redditConnections.some(c=>!c.last_synced_at||Date.now()-new Date(c.last_synced_at)>2*3600000);
    if(redditEnabled||redditConnections.length)platforms.push({id:"reddit",name:"Reddit Ads",mark:"R",category:"Community advertising",available:redditConnections.length>0,
      status:!redditConnections.length&&!redditEnabled?"Awaiting application setup":!redditConnections.length?"Ready to connect":redditAttention?"Sync needs attention":!redditAutoSync?"Automatic sync disabled":redditStale?"Awaiting fresh reports":"Automatic hourly sync",
      campaignCount:redditGrouped.size,countLabel:"campaigns with reporting",accountCount:redditConnections.length,
      freshness:redditConnections.length?redditConnections.map(c=>`${c.account_name}: ${timestamp(c.last_synced_at)}`).join(" · "):"No account connected",metrics:redditMetrics(redditRaw),
      note:"Totals cover connected Reddit ad accounts and imported campaign results. Conversions, leads and value are Reddit-reported outcomes, not verified Vivid sales. Currencies stay separate; missing reports are not zero activity.",
      columns:["Impressions","Clicks","CTR","Avg. CPC","Spend","Reported conversions","Reported leads","Reported conversion value","Reported ROAS","ROI"],
      rows:[...redditGrouped].map(([key,rows])=>{const r=rows[0],c=redditConnections.find(c=>String(c.id)===String(r.connection_id)),clicks=total(rows,"clicks"),impressions=total(rows,"impressions"),returns=returnMetrics(rows,"conversion_value");return{key,name:r.campaign_name,context:`${c?.account_name||"Reddit account"} · ${r.campaign_id}`,metrics:redditMetrics(rows),cells:[number(impressions),number(clicks),rate(clicks,impressions),clicks?currency(total(rows,"cost_micros")/1e6/clicks,r.currency_code):"—",googleMoney(rows,"cost_micros"),number(total(rows,"conversions")),number(total(rows,"leads")),googleMoney(rows,"conversion_value"),returns[0][1],returns[1][1]],href:`/admin/connectors/reddit-ads/${Number(r.connection_id)}?${new URLSearchParams(range)}`,action:"Account sync & import history"};}),
      manageHref:scope.privateAdsAllowed!==false?"/admin/connectors/reddit-ads":"",manageLabel:redditConnections.length?"Manage Reddit accounts":"Connect Reddit Ads"});
    const pinterestConnections=pinterestEvidence?.connections||[],pinterestRaw=pinterestEvidence?.rows||[],pinterestGrouped=new Map();
    for(const r of pinterestRaw){const key=`${r.connection_id}:${r.campaign_id}`;if(!pinterestGrouped.has(key))pinterestGrouped.set(key,[]);pinterestGrouped.get(key).push(r);}
    const pinterestAttention=pinterestConnections.some(c=>c.status==="attention_required"||c.last_error),pinterestStale=pinterestConnections.some(c=>!c.last_synced_at||Date.now()-new Date(c.last_synced_at)>2*3600000);
    if(pinterestEnabled||pinterestConnections.length)platforms.push({id:"pinterest",name:"Pinterest Ads",mark:"P",category:"Visual discovery advertising",available:pinterestConnections.length>0,status:!pinterestConnections.length&&!pinterestEnabled?"Awaiting application setup":!pinterestConnections.length?"Ready to connect":pinterestAttention?"Sync needs attention":!pinterestAutoSync?"Automatic sync disabled":pinterestStale?"Awaiting fresh reports":"Automatic hourly sync",campaignCount:pinterestGrouped.size,countLabel:"campaigns with reporting",accountCount:pinterestConnections.length,freshness:pinterestConnections.length?pinterestConnections.map(c=>`${c.account_name}: ${timestamp(c.last_synced_at)}`).join(" · "):"No account connected",metrics:pinterestMetrics(pinterestRaw),note:"Totals cover connected Pinterest ad accounts and imported campaign results. Pin clicks, outbound clicks, conversions and value are Pinterest-reported outcomes, not verified Vivid sales. Currencies stay separate; missing reports are not zero activity.",columns:["Impressions","Pin clicks","Outbound clicks","CTR","Avg. CPC","Spend","Reported conversions","Reported conversion value","Reported ROAS","ROI"],rows:[...pinterestGrouped].map(([key,rows])=>{const r=rows[0],c=pinterestConnections.find(c=>String(c.id)===String(r.connection_id)),clicks=total(rows,"clicks"),impressions=total(rows,"impressions"),metrics=pinterestMetrics(rows);return{key,name:r.campaign_name,context:`${c?.account_name||"Pinterest account"} · ${r.campaign_id}`,metrics,cells:[number(impressions),number(clicks),number(total(rows,"outbound_clicks")),rate(clicks,impressions),clicks?currency(total(rows,"cost_micros")/1e6/clicks,r.currency_code):"—",googleMoney(rows,"cost_micros"),number(total(rows,"conversions")),metrics[6][1],metrics[7][1],metrics[8][1]],href:`/admin/connectors/pinterest-ads/${Number(r.connection_id)}?${new URLSearchParams(range)}`,action:"Account sync & import history"};}),manageHref:scope.privateAdsAllowed!==false?"/admin/connectors/pinterest-ads":"",manageLabel:pinterestConnections.length?"Manage Pinterest accounts":"Connect Pinterest Ads"});
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
  return `<article class="mcc-platform" data-platform="${p.id}"><header>${platformLogo(p.id,p.name)}<div><small>${esc(p.category)}</small><h3>${esc(p.name)}</h3></div></header><span class="mcc-status">${esc(p.status)}</span><p class="mcc-count">${p.campaignCount} ${esc(p.countLabel)}${p.accountCount!==undefined?` · ${p.accountCount} accounts`:""}</p>${metricsHtml(p.available?p.metrics:p.metrics.map(([label])=>[label,"—"]))}<p class="mcc-freshness">${esc(p.freshness)}</p><footer>${p.available?`<a class="mcc-primary" href="${esc(dashboardHref(scope,range,p.id))}">${esc(p.viewLabel||`View ${p.name} campaigns`)} <span aria-hidden="true">→</span></a>`:p.manageHref&&p.status!=="Awaiting application setup"&&p.status!=="Not enabled"?`<a href="${esc(p.manageHref)}">${esc(p.manageLabel)} →</a>`:"<span>Reporting not connected</span>"}</footer></article>`;
}
function renderPlatformDetail(p,scope,range,campaignKey="") {
  const selected=campaignKey?p.rows.find(r=>r.key===campaignKey):null;
  if(campaignKey&&!selected)return `<section class="mcc-panel"><h2>Campaign not found in this period</h2><p>Choose another period or return to the platform's campaigns.</p><a href="${esc(dashboardHref(scope,range,p.id))}">All ${esc(p.name)} campaigns</a></section>`;
  const rows=selected?[selected]:p.rows;
  return `<section class="mcc-panel"><div class="mcc-section-heading"><div><small>${esc(p.category)}</small><h2>${esc(selected?.name||p.name+" overview")}</h2><p>${esc(selected?.context||`${p.campaignCount} ${p.countLabel} · ${p.status}`)}</p></div>${p.manageHref?`<a href="${esc(p.manageHref)}">${esc(p.manageLabel)}</a>`:""}</div>${metricsHtml(selected?.metrics||p.metrics)}<p class="mcc-freshness">${esc(p.freshness)}</p><p>${esc(p.note)}</p></section>
  <section class="mcc-panel" id="campaign-evidence"><div class="mcc-section-heading"><h2>${selected?"Campaign results":"All campaigns"}</h2><span>${esc(range.from)} – ${esc(range.to)}</span></div><div class="mcc-scroll${p.id==="ga4"?" mcc-ga4-table":""}"><table><thead><tr><th>Campaign</th>${p.columns.map(label=>`<th>${esc(label)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr><td><a href="${esc(dashboardHref(scope,range,p.id,r.key))}">${esc(r.name)}</a><small class="mcc-row-context">${esc(r.context)}</small></td>${r.cells.map(value=>`<td>${esc(value)}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${p.columns.length+1}">No ${p.id==="square"?"matched campaign purchases":p.id==="google_ads"?"imported campaign reporting rows":"campaign records"} in this period.</td></tr>`}</tbody></table></div>${selected?.href?`<p><a href="${esc(selected.href)}">${esc(selected.action)} →</a></p>`:selected?"":"<p>Select a campaign to inspect its results and supporting details.</p>"}</section>
  ${selected?.daily?selected.dailyKind==="meta"?`<section class="mcc-panel"><h2>Daily performance</h2><p>${esc(selected.timezone)} · Meta-reported results</p><div class="mcc-scroll"><table><thead><tr><th>Date</th><th>Impressions</th><th>Clicks</th><th>Link clicks</th><th>Spend</th><th>Reported purchases</th><th>Reported leads</th><th>Reported purchase value</th></tr></thead><tbody>${selected.daily.map(d=>`<tr><td>${esc(d.date)}</td><td>${number(d.impressions)}</td><td>${number(d.clicks)}</td><td>${number(d.link_clicks)}</td><td>${esc(currency(n(d.cost_micros)/1e6,d.currency_code))}</td><td>${number(d.purchases)}</td><td>${number(d.leads)}</td><td>${esc(currency(n(d.purchase_value),d.currency_code))}</td></tr>`).join("")||'<tr><td colspan="8">No daily reporting rows available.</td></tr>'}</tbody></table></div></section>`:`<section class="mcc-panel"><h2>Daily performance</h2><p>${esc(selected.timezone)} · Google-reported results</p><div class="mcc-scroll"><table><thead><tr><th>Date</th><th>Impressions</th><th>Clicks</th><th>Spend</th><th>Reported conversions</th><th>Reported value</th></tr></thead><tbody>${selected.daily.map(d=>`<tr><td>${esc(d.date)}</td><td>${number(d.impressions)}</td><td>${number(d.clicks)}</td><td>${esc(currency(n(d.cost_micros)/1e6,d.currency_code))}</td><td>${number(d.conversions)}</td><td>${esc(currency(n(d.conversion_value),d.currency_code))}</td></tr>`).join("")||'<tr><td colspan="6">No daily reporting rows available.</td></tr>'}</tbody></table></div></section>`:""}`;
}
const platformStyle=`
.mcc-platform-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.mcc-platform,.mcc-panel{background:#fff;border:1px solid #d9e2ed;border-radius:16px;padding:24px;min-width:0}.mcc-platform{display:flex;flex-direction:column;box-shadow:0 4px 18px #102b5006}.mcc-platform header{display:flex;gap:12px;align-items:center;margin-bottom:18px}.mcc-platform header h3{margin:2px 0;font-size:22px}.mcc-platform-logo{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#f5f8fc;overflow:hidden;flex-shrink:0}.mcc-platform-logo svg{width:36px;height:36px;display:block}.mcc-platform-fallback{display:grid;place-items:center;width:100%;height:100%;background:#eaf2ff;color:#164d93;font-size:18px;font-weight:750}.mcc-platform .mcc-status{align-self:flex-start}.mcc-count{font-size:13px;color:#53677c}.mcc-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 16px;margin:22px 0}.mcc-metrics>div{min-width:0}.mcc-metrics dt{font-size:12px;color:#53677c;margin-bottom:5px}.mcc-metrics dd{margin:0;font-weight:700;font-size:24px;line-height:1.25;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.mcc-freshness{font-size:12px;color:#53677c;overflow-wrap:anywhere}.mcc-platform footer{margin-top:auto;padding-top:18px;border-top:1px solid #e8edf3}.mcc-primary{display:flex;justify-content:space-between;align-items:center;gap:8px;text-decoration:none}.mcc-panel{margin:22px 0}.mcc-panel>.mcc-metrics{grid-template-columns:repeat(3,minmax(0,1fr));padding:20px 0;border-top:1px solid #e8edf3;border-bottom:1px solid #e8edf3}.mcc-ga4-table{overflow:visible}.mcc-ga4-table table{table-layout:fixed;width:100%}.mcc-ga4-table th,.mcc-ga4-table td{white-space:normal;overflow-wrap:anywhere;font-size:12px;padding:9px 7px}.mcc-ga4-table th:first-child,.mcc-ga4-table td:first-child{width:30%}.mcc-section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.mcc-section-heading h2{margin:0}.mcc-row-context{display:block;font-size:11px;margin-top:4px}.mcc-breadcrumb{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 16px}.mcc a:focus-visible,.mcc summary:focus-visible{outline:3px solid #3275c6;outline-offset:4px}.mcc-roadmap{margin-top:32px;padding:22px;border:1px solid #d9e2ed;border-radius:14px}.mcc-roadmap>.mcc-grid{margin-top:20px}@media(max-width:1000px){.mcc-platform-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.mcc-platform-grid{grid-template-columns:1fr}.mcc-platform,.mcc-panel{padding:18px}.mcc-panel>.mcc-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.mcc-metrics dd{font-size:22px}.mcc-ga4-table th,.mcc-ga4-table td{font-size:10px;padding:6px 3px}.mcc-ga4-table th:first-child,.mcc-ga4-table td:first-child{width:26%}}`;
module.exports={buildPlatforms,platformCard,platformLogo,renderPlatformDetail,platformStyle,dashboardHref,googleMetrics,metaMetrics,linkedinMetrics,tiktokMetrics,redditMetrics,pinterestMetrics,youtubeMetrics,analyticsMetrics,analyticsSourceLabel};
