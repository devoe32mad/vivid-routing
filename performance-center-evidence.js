"use strict";

const {dashboardEvidence:googleEvidence}=require("./google-ads-readonly-store");
const {dashboardEvidence:metaEvidence}=require("./meta-ads-store");
const {dashboardEvidence:linkedinEvidence}=require("./linkedin-ads-store");
const {dashboardEvidence:tiktokEvidence}=require("./tiktok-ads-store");
const {dashboardEvidence:redditEvidence}=require("./reddit-ads-store");
const {dashboardEvidence:pinterestEvidence}=require("./pinterest-ads-store");
const {dashboardEvidence:analyticsEvidence}=require("./google-analytics-store");
const {dashboardEvidence:searchEvidence}=require("./google-search-console-store");
const {dashboardEvidence:youtubeEvidence}=require("./youtube-analytics-store");
const {campaignRecommendations,crossPlatformRecommendations,websiteTrafficRecommendations}=require("./marketing-performance-insights");

const n=value=>Number.isFinite(Number(value))?Number(value):0;
const sum=(rows,key)=>rows.reduce((total,row)=>total+n(row[key]),0);
const aiSource=value=>/(chatgpt|openai|perplexity|claude|anthropic|copilot|gemini|bard|you\.com|phind)/i.test(String(value||""));
const organicMedium=value=>/(organic|organic_social|social|referral)/i.test(String(value||""))&&!/(paid|cpc|ppc)/i.test(String(value||""));

async function safe(load){try{return await load();}catch(error){if(["42P01","42703"].includes(error.code))return null;console.warn("performance_center_evidence_unavailable "+JSON.stringify({code:error.code||"failed"}));return null;}}

function empty(title,action,href){return{priority:"Learning",confidence:"Waiting for data",title,reason:"Vivid does not have enough measured activity in this area to make a reliable recommendation yet.",action,href};}

function strongestGa4(rows,predicate){
  const grouped=new Map();
  for(const row of rows.filter(predicate)){
    const label=`${row.source||"Unknown"} / ${row.medium||"Unknown"}`;
    const item=grouped.get(label)||{label,sessions:0,engaged:0,keyEvents:0,revenue:0};
    item.sessions+=n(row.sessions);item.engaged+=n(row.engaged_sessions);item.keyEvents+=n(row.key_events);item.revenue+=n(row.revenue);grouped.set(label,item);
  }
  return [...grouped.values()].sort((a,b)=>b.sessions-a.sessions)[0]||null;
}

function ga4Groups(rows,predicate){
  const grouped=new Map();
  for(const row of rows.filter(predicate)){
    const label=`${row.source||"Unknown"} / ${row.medium||"Unknown"}`;
    const item=grouped.get(label)||{label,sessions:0,engaged:0,keyEvents:0,revenue:0};
    item.sessions+=n(row.sessions);item.engaged+=n(row.engaged_sessions);item.keyEvents+=n(row.key_events);item.revenue+=n(row.revenue);grouped.set(label,item);
  }
  return [...grouped.values()].sort((a,b)=>b.sessions-a.sessions);
}

function websiteInsights(analytics,search,range){
  const href=`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ga4`,rows=analytics?.rows||[];
  const sessions=sum(rows,"sessions"),engaged=sum(rows,"engaged_sessions"),actions=sum(rows,"key_events"),items=[];
  if(!sessions)return[websiteInsight(analytics,search,range)];
  const rate=100*engaged/sessions;
  items.push({title:`Website engagement is ${rate.toFixed(1)}%`,reason:`GA4 recorded ${sessions.toLocaleString()} sessions, ${engaged.toLocaleString()} engaged sessions and ${actions.toLocaleString()} key actions.`,action:rate<40?"Review page speed, mobile layout and the highest-traffic landing pages; test one clearer next step on those pages.":"Compare the landing pages and traffic sources above this average, then reuse their message and structure.",href});
  const direct=rows.filter(row=>/^\(direct\)$/i.test(String(row.source||""))).reduce((total,row)=>total+n(row.sessions),0);
  if(direct>0){const share=100*direct/sessions;items.push({title:`${share.toFixed(1)}% of sessions are classified as direct`,reason:`${direct.toLocaleString()} of ${sessions.toLocaleString()} sessions have no identifiable referring campaign or source.`,action:share>=50?"Use consistent UTM tags on every email, social post, QR destination and paid campaign so Vivid can explain more of this traffic.":"Keep UTM naming consistent so identifiable campaign traffic does not fall into Direct.",href});}
  if(actions===0)items.push({title:"GA4 recorded no key actions",reason:"Traffic and engagement are visible, but GA4 has not identified a lead, purchase or other key action in this period.",action:"Confirm form submissions, calls, checkout completions and other business outcomes are configured as GA4 key events before judging campaign quality.",href});
  const searchRows=search?.summary||[];
  const impressions=sum(searchRows,"impressions"),clicks=sum(searchRows,"clicks");
  if(impressions>0&&items.length<3)items.push({title:`Google Search showed your pages ${impressions.toLocaleString()} times`,reason:`Search Console recorded ${clicks.toLocaleString()} clicks from those impressions in the selected period.`,action:"Open Search visibility and improve high-impression queries or pages with weak clicks; position and impressions are visibility signals, not revenue.",href});
  return items.slice(0,3);
}

function organicInsights(analytics,youtube,range){
  const href=`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=organic`,groups=ga4Groups(analytics?.rows||[],row=>organicMedium(row.medium)&&!aiSource(row.source)),items=[];
  const sessions=groups.reduce((total,g)=>total+g.sessions,0),engaged=groups.reduce((total,g)=>total+g.engaged,0),actions=groups.reduce((total,g)=>total+g.keyEvents,0);
  if(sessions){items.push({title:`Organic and referral sources produced ${sessions.toLocaleString()} website sessions`,reason:`${engaged.toLocaleString()} were engaged (${(100*engaged/sessions).toFixed(1)}%) and ${actions.toLocaleString()} key actions were recorded.`,action:actions?"Compare the unpaid sources and landing pages that produced key actions, then repeat the strongest topic or offer.":"Add consistent UTMs to social links and confirm GA4 key actions before comparing unpaid content by business outcome.",href});}
  for(const group of groups.slice(0,2))items.push({title:`${group.label} produced ${group.sessions.toLocaleString()} sessions`,reason:`${group.engaged.toLocaleString()} engaged sessions (${group.sessions?(100*group.engaged/group.sessions).toFixed(1):"0.0"}%) and ${group.keyEvents.toLocaleString()} key actions came from this identifiable source.`,action:"Open the source detail, identify the posts or pages behind these visits, and prepare one repeat test. Do not assign ROI without cost and verified revenue.",href});
  const videos=youtube?.rows||[],views=sum(videos,"views"),engagement=sum(videos,"likes")+sum(videos,"comments")+sum(videos,"shares");
  if(views>0&&items.length<3)items.push({title:`YouTube generated ${views.toLocaleString()} organic views`,reason:`Videos recorded ${engagement.toLocaleString()} likes, comments and shares in the selected period.`,action:"Compare the strongest video topics and calls to action before planning the next post.",href});
  return items.length?items.slice(0,3):[organicInsight(analytics,youtube,range)];
}

function aiInsights(analytics,range){
  const href=`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ai_traffic`,allRows=analytics?.rows||[],groups=ga4Groups(allRows,row=>aiSource(row.source)),items=[];
  const sessions=groups.reduce((total,g)=>total+g.sessions,0),engaged=groups.reduce((total,g)=>total+g.engaged,0),actions=groups.reduce((total,g)=>total+g.keyEvents,0),allSessions=sum(allRows,"sessions");
  if(!sessions)return[aiInsight(analytics,range)];
  items.push({title:`AI assistants produced ${sessions.toLocaleString()} identifiable visits`,reason:`That is ${allSessions?(100*sessions/allSessions).toFixed(1):"0.0"}% of website sessions; AI visits are already included in Website totals and are not added again.`,action:"Track this share over time and keep the pages AI visitors reach clear, factual and easy to cite.",href});
  items.push({title:`AI traffic engaged at ${(100*engaged/sessions).toFixed(1)}%`,reason:`${engaged.toLocaleString()} of ${sessions.toLocaleString()} identifiable AI-referred sessions were engaged, with ${actions.toLocaleString()} GA4 key actions.`,action:actions?"Inspect the landing pages and AI sources that produced key actions, then improve the content pattern behind them.":"Confirm GA4 key actions and strengthen the next step on the pages AI visitors reach most often.",href});
  const best=groups[0];
  if(best)items.push({title:`${best.label} is the largest identifiable AI source`,reason:`It produced ${best.sessions.toLocaleString()} sessions and ${best.engaged.toLocaleString()} engaged sessions. Some AI traffic cannot be identified, so this is directional.`,action:"Review the landing pages receiving this traffic and expand the clearest answers, proof points and calls to action.",href});
  return items.slice(0,3);
}

function paidInsights(sources,range,now){
  const href=`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=paid_media`;
  const generated=[...campaignRecommendations(sources,range,now),...crossPlatformRecommendations(sources,range,now)];
  const rollups=sources.map(source=>{const rows=source.evidence?.rows||[];return{name:source.name,connections:(source.evidence?.connections||[]).length,campaigns:rows.length,impressions:sum(rows,"impressions"),clicks:sum(rows,"clicks"),conversions:rows.reduce((total,row)=>total+n(source.id==="meta"?row.purchases:row.conversions),0)};});
  const connected=rollups.filter(item=>item.connections>0),delivery=rollups.filter(item=>item.impressions>0).sort((a,b)=>b.impressions-a.impressions),items=generated.slice(0,3);
  const totalImpressions=delivery.reduce((total,item)=>total+item.impressions,0),totalClicks=delivery.reduce((total,item)=>total+item.clicks,0),totalConversions=delivery.reduce((total,item)=>total+item.conversions,0);
  if(items.length<3&&connected.length)items.push({title:`${connected.length} paid platform${connected.length===1?" is":"s are"} connected`,reason:`Vivid found ${connected.reduce((total,item)=>total+item.connections,0)} connected ad account${connected.reduce((total,item)=>total+item.connections,0)===1?"":"s"}; ${delivery.length} platform${delivery.length===1?" has":"s have"} delivery data in this period.`,action:"Keep the account connections active and use consistent conversion events and UTMs across every platform.",href});
  if(items.length<3&&totalImpressions>0){const leader=delivery[0],ctr=leader.impressions?100*leader.clicks/leader.impressions:0;items.push({title:`${leader.name} has the most measured paid delivery`,reason:`It recorded ${leader.impressions.toLocaleString()} impressions and ${leader.clicks.toLocaleString()} clicks (${ctr.toFixed(2)}% CTR). Across connected paid sources, Vivid recorded ${totalImpressions.toLocaleString()} impressions and ${totalClicks.toLocaleString()} clicks.`,action:leader.clicks?"Compare this traffic in GA4 before increasing spend; clicks alone do not establish lead quality or revenue.":"Check campaign eligibility, audience size and creative relevance; the sample is still too small for a budget decision.",href});}
  if(items.length<3&&(totalClicks>0||totalImpressions>0))items.push({title:totalConversions?`${totalConversions.toLocaleString()} platform-reported conversions are visible`:"No platform-reported conversions are visible",reason:totalConversions?"Platform conversions are useful directional evidence but can overlap and are not automatically verified revenue.":`${totalClicks.toLocaleString()} paid clicks are visible in this period, but no connected ad platform reported a conversion.`,action:"Verify each platform conversion event and compare paid traffic with GA4 key actions before changing budgets.",href});
  return items.length?items.slice(0,3):[empty("No paid-account evidence is connected for this account","Connect at least one paid platform or select the account that owns the connection.",href)];
}

function organicInsight(analytics,youtube,range){
  const rows=analytics?.rows||[];
  const best=strongestGa4(rows,row=>organicMedium(row.medium)&&!aiSource(row.source));
  const videos=youtube?.rows||[];
  const views=sum(videos,"views"),engagement=sum(videos,"likes")+sum(videos,"comments")+sum(videos,"shares");
  if(best)return{priority:"Opportunity",confidence:best.sessions>=20?"Medium":"Early signal",title:`${best.label} brought the most identifiable unpaid website traffic`,reason:`GA4 recorded ${best.sessions.toLocaleString()} sessions, ${best.engaged.toLocaleString()} engaged sessions and ${best.keyEvents.toLocaleString()} key actions from this source in the selected period.`,action:"Open the source detail, identify the posts or pages behind the visits, and prepare one repeat test. Do not calculate ROI unless cost and verified revenue are available.",href:`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=organic`};
  if(views>0)return{priority:"Opportunity",confidence:views>=100?"Medium":"Early signal",title:"YouTube organic activity is building measurable attention",reason:`Vivid recorded ${views.toLocaleString()} views and ${engagement.toLocaleString()} likes, comments or shares in the selected period.`,action:"Open the video evidence and compare topics before planning the next post. Organic attention is not revenue by itself.",href:`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=organic`};
  return empty("No reliable organic-content signal yet","Connect or refresh GA4 and an organic content source, then keep consistent campaign tags on shared links.",`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=organic`);
}

function aiInsight(analytics,range){
  const best=strongestGa4(analytics?.rows||[],row=>aiSource(row.source));
  if(!best)return empty("No identifiable AI-referred visits yet","Keep GA4 connected. Vivid will watch identifiable referrals from ChatGPT, Perplexity, Claude, Copilot, Gemini and other AI assistants.",`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ai_traffic`);
  const rate=best.sessions?100*best.engaged/best.sessions:0;
  return{priority:"Discovery signal",confidence:best.sessions>=20?"Medium":"Early signal",title:`${best.label} is the leading identifiable AI source`,reason:`GA4 recorded ${best.sessions.toLocaleString()} sessions, ${best.engaged.toLocaleString()} engaged sessions (${rate.toFixed(1)}%) and ${best.keyEvents.toLocaleString()} key actions. These visits are also included in Website totals.`,action:"Inspect the landing pages these visitors reached, then improve the clearest page that answers their likely question. Treat referral data as directional because some AI visits cannot be identified.",href:`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ai_traffic`};
}

function websiteInsight(analytics,search,range){
  const recommended=websiteTrafficRecommendations(analytics||{},range)[0];
  if(recommended)return recommended;
  const rows=analytics?.rows||[],sessions=sum(rows,"sessions"),engaged=sum(rows,"engaged_sessions"),actions=sum(rows,"key_events");
  if(sessions>0){const rate=100*engaged/sessions;return{priority:"Website health",confidence:sessions>=50?"Medium":"Early signal",title:`${rate.toFixed(1)}% of website sessions were engaged`,reason:`GA4 recorded ${sessions.toLocaleString()} sessions, ${engaged.toLocaleString()} engaged sessions and ${actions.toLocaleString()} key actions in the selected period.`,action:actions>0?"Open Website evidence and compare traffic sources and landing pages that produced key actions.":"Confirm the actions that matter are marked as GA4 key events, then compare the highest-traffic landing pages.",href:`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ga4`};}
  const searchRows=search?.summary||search?.rows||[];
  const impressions=sum(searchRows,"impressions");
  if(impressions>0)return{priority:"Search visibility",confidence:"Early signal",title:"Google Search is showing your pages",reason:`Search Console recorded ${impressions.toLocaleString()} impressions in the selected period.`,action:"Open Search evidence and improve pages with impressions but weak clicks. Position is visibility—not revenue.",href:`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ga4`};
  return empty("No reliable website signal yet","Connect or refresh GA4, then confirm the selected dates include website activity.",`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ga4`);
}

async function loadPerformanceCenterInsights({q,userId,range,now=new Date()}){
  const loaders=[googleEvidence,metaEvidence,linkedinEvidence,tiktokEvidence,redditEvidence,pinterestEvidence,analyticsEvidence,searchEvidence,youtubeEvidence];
  const [google,meta,linkedin,tiktok,reddit,pinterest,analytics,search,youtube]=await Promise.all(loaders.map(loader=>safe(()=>loader(q,userId,range))));
  const sources=[
    ["google_ads","Google Ads",google,"google-ads"],["meta","Meta Ads",meta,"meta-ads"],["linkedin","LinkedIn Ads",linkedin,"linkedin-ads"],
    ["tiktok","TikTok Ads",tiktok,"tiktok-ads"],["reddit","Reddit Ads",reddit,"reddit-ads"],["pinterest","Pinterest Ads",pinterest,"pinterest-ads"]
  ].map(([id,name,evidence,path])=>({id,name,evidence,href:(connectionId,r)=>`/admin/connectors/${path}/${connectionId}?from=${r.from}&to=${r.to}`}));
  return{paid:paidInsights(sources,range,now),website:websiteInsights(analytics,search,range),organic:organicInsights(analytics,youtube,range),ai:aiInsights(analytics,range)};
}

module.exports={loadPerformanceCenterInsights,aiSource,organicMedium,websiteInsights,organicInsights,aiInsights,paidInsights};
