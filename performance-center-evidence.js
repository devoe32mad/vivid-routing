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
  const paidItems=[...campaignRecommendations(sources,range,now),...crossPlatformRecommendations(sources,range,now)].slice(0,3);
  const paid=paidItems.length?paidItems:[empty("No reliable paid-media recommendation yet","Keep platform reporting connected and allow more delivery data to accumulate before changing spend.",`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=paid_media`)];
  const websiteItems=websiteTrafficRecommendations(analytics||{},range).slice(0,2);
  const websiteOverview=websiteInsight(analytics,search,range);
  if(!websiteItems.some(item=>item.title===websiteOverview.title))websiteItems.push(websiteOverview);
  return{paid,website:websiteItems.slice(0,3),organic:[organicInsight(analytics,youtube,range)],ai:[aiInsight(analytics,range)]};
}

module.exports={loadPerformanceCenterInsights,aiSource,organicMedium};
