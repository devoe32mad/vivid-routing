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
  if(direct>0){const share=100*direct/sessions;items.push({title:`The source of ${share.toFixed(1)}% of website visits is unknown`,reason:`${direct.toLocaleString()} of ${sessions.toLocaleString()} visits arrived without information showing which ad, post, email or link sent them.`,action:share>=50?"Add a trackable link to every ad, social post, email and QR destination so Vivid can show what actually brought each visitor.":"Keep using trackable links so more website visits can be tied to the marketing that produced them.",href});}
  if(actions===0)items.push({title:"Website visits are not yet tied to leads or sales",reason:"Vivid can see traffic and engagement, but no form submission, call, purchase or other business result was recorded in this period.",action:"Choose the website actions that matter—such as Contact Us, request a demo, call or purchase—and connect them so Vivid can show which marketing produced results.",href});
  const searchRows=search?.summary||[];
  const impressions=sum(searchRows,"impressions"),clicks=sum(searchRows,"clicks");
  if(impressions>0&&items.length<3)items.push({title:`Google Search showed your pages ${impressions.toLocaleString()} times`,reason:`Search Console recorded ${clicks.toLocaleString()} clicks from those impressions in the selected period.`,action:"Open Search visibility and improve high-impression queries or pages with weak clicks; position and impressions are visibility signals, not revenue.",href});
  return items.slice(0,3);
}

function organicInsights(analytics,youtube,range){
  const href=`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=organic`,groups=ga4Groups(analytics?.rows||[],row=>organicMedium(row.medium)&&!aiSource(row.source)),items=[];
  const sessions=groups.reduce((total,g)=>total+g.sessions,0),engaged=groups.reduce((total,g)=>total+g.engaged,0),actions=groups.reduce((total,g)=>total+g.keyEvents,0);
  if(sessions){items.push({title:`Unpaid posts, search and referrals produced ${sessions.toLocaleString()} website visits`,reason:`${engaged.toLocaleString()} visitors showed meaningful interest (${(100*engaged/sessions).toFixed(1)}%), but ${actions.toLocaleString()} leads, purchases or other results were recorded.`,action:actions?"Repeat the topic and call to action from the unpaid source that produced the most business results.":"Use trackable links on every social post and connect website leads or sales before deciding which unpaid content works best.",href});}
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
  const campaigns=sources.flatMap(source=>(source.evidence?.rows||[]).map(row=>({platform:source.name,name:row.campaign_name||"Unnamed campaign",impressions:n(row.impressions),clicks:n(row.clicks),conversions:n(source.id==="meta"?row.purchases:row.conversions),value:n(source.id==="meta"?row.purchase_value:source.id==="pinterest"?n(row.conversion_value_micros)/1e6:row.conversion_value)}))).sort((a,b)=>b.conversions-a.conversions||b.clicks-a.clicks||b.impressions-a.impressions);
  const connected=rollups.filter(item=>item.connections>0),delivery=rollups.filter(item=>item.impressions>0).sort((a,b)=>b.impressions-a.impressions),items=generated.slice(0,3);
  const totalImpressions=delivery.reduce((total,item)=>total+item.impressions,0),totalClicks=delivery.reduce((total,item)=>total+item.clicks,0),totalConversions=delivery.reduce((total,item)=>total+item.conversions,0);
  const leaderCampaign=campaigns[0];
  if(items.length<3&&leaderCampaign&&(leaderCampaign.impressions||leaderCampaign.clicks))items.push({title:`${leaderCampaign.name} is your strongest measured paid campaign`,reason:`On ${leaderCampaign.platform}, it produced ${leaderCampaign.impressions.toLocaleString()} views, ${leaderCampaign.clicks.toLocaleString()} clicks and ${leaderCampaign.conversions.toLocaleString()} reported results${leaderCampaign.value?` worth ${leaderCampaign.value.toLocaleString(undefined,{style:"currency",currency:"USD"})}`:""}.`,action:leaderCampaign.clicks?`Review the offer, headline and audience used in ${leaderCampaign.name}. Keep the original running while you test that same approach on one weaker platform.`:"The campaign is being shown but is not earning clicks yet. Test a clearer offer and headline before increasing its budget.",href});
  const target=delivery.find(item=>item.name!==leaderCampaign?.platform&&item.clicks<(leaderCampaign?.clicks||0))||connected.find(item=>item.name!==leaderCampaign?.platform);
  if(items.length<3&&leaderCampaign?.clicks&&target)items.push({title:`Test the ${leaderCampaign.platform} approach on ${target.name}`,reason:`${leaderCampaign.name} produced ${leaderCampaign.clicks.toLocaleString()} clicks. ${target.name} produced ${target.clicks.toLocaleString()} clicks in the same period.`,action:`Create a small ${target.name} test using the same core offer and message as ${leaderCampaign.name}. Do not replace the original campaign until the test produces better business results.`,href});
  if(items.length<3&&(totalClicks>0||totalImpressions>0))items.push({title:totalConversions?`${totalConversions.toLocaleString()} ad-platform results are visible`:"Paid campaigns produced attention but no recorded result",reason:totalConversions?"The ad platforms reported results, but they still need to be matched to real leads, purchases or revenue before judging return.":`${totalImpressions.toLocaleString()} views and ${totalClicks.toLocaleString()} clicks are visible, but no connected ad platform reported a lead, purchase or other result.`,action:"Connect the website action that matters—lead, call, demo or purchase—to each campaign before moving budget from one platform to another.",href});
  if(items.length<3&&connected.length)items.push({title:`Vivid is watching ${connected.length} paid platform${connected.length===1?"":"s"}`,reason:`${connected.reduce((total,item)=>total+item.connections,0)} ad accounts are connected, and ${delivery.length} platforms returned campaign activity for this period.`,action:"Keep the connections active. Vivid will strengthen campaign-to-campaign recommendations as clicks and business results accumulate.",href});
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
