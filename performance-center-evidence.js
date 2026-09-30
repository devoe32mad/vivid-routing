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

const BEST_PRACTICES={
  paid:{text:"Make the page people reach match the promise and next step in the ad.",label:"Google Ads landing-page guidance",href:"https://support.google.com/google-ads/answer/6238826?hl=en",inspiration:[
    {label:"See high-performing TikTok ads",href:"https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?period=30&region=US",note:"Filter by industry and campaign goal. TikTok identifies these examples as high-performing."},
    {label:"See active Facebook and Instagram ads",href:"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US",note:"Use these for creative ideas only. Meta does not publish business results for most commercial ads."}
  ]},
  website:{text:"Use a consistently named trackable link for each campaign so visits can be tied to their source.",label:"Google Analytics campaign-link guidance",href:"https://support.google.com/analytics/answer/10917952?hl=en",inspiration:[
    {label:"Open Google Search performance",href:"https://search.google.com/search-console/performance/search-analytics",note:"See the searches and pages producing Google impressions and clicks."},
    {label:"Check or submit a page to Google",href:"https://search.google.com/search-console/inspect",note:"Inspect one page and ask Google to check it. Submission does not guarantee indexing."}
  ]},
  organic:{text:"Create useful, original content for people first—not content made only to attract search traffic.",label:"Google Search people-first content guidance",href:"https://developers.google.com/search/docs/fundamentals/creating-helpful-content",inspiration:[
    {label:"Find topics people are searching for",href:"https://trends.google.com/explore",note:"Use Google Trends to compare topics, locations and rising interest."},
    {label:"See Pinterest search and shopping trends",href:"https://trends.pinterest.com/",note:"Use current search, save and shopping trends as content inspiration."}
  ]},
  ai:{text:"AI search visibility uses the same foundation as search: useful, reliable, people-first pages that search engines can access.",label:"Google Search AI-feature guidance",href:"https://developers.google.com/search/docs/appearance/ai-features",inspiration:[
    {label:"Review Google Search AI guidance",href:"https://developers.google.com/search/docs/appearance/ai-features",note:"See how useful, accessible pages can appear as supporting links in Google's AI search experiences."}
  ]}
};

const withPractice=(items,practice)=>items.map(item=>({...item,bestPractice:practice.text,bestPracticeLabel:practice.label,bestPracticeHref:practice.href,outsideInspiration:practice.inspiration||[]}));

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
  if(!sessions)return withPractice([websiteInsight(analytics,search,range)],BEST_PRACTICES.website);
  const rate=100*engaged/sessions;
  items.push({title:`${rate.toFixed(1)}% of website visits showed meaningful interest`,reason:`Vivid recorded ${sessions.toLocaleString()} website visits. During ${engaged.toLocaleString()} of them, visitors stayed, viewed more than one page or took another meaningful action. ${actions.toLocaleString()} leads, calls, purchases or other chosen results were recorded.`,action:rate<40?"Start with the busiest page. Make it faster and easier to use on a phone, then give visitors one obvious next step.":"Compare the pages and traffic sources above this average, then reuse their clearest message and page structure.",href});
  const direct=rows.filter(row=>/^\(direct\)$/i.test(String(row.source||""))).reduce((total,row)=>total+n(row.sessions),0);
  if(direct>0){const share=100*direct/sessions;items.push({title:`The source of ${share.toFixed(1)}% of website visits is unknown`,reason:`${direct.toLocaleString()} of ${sessions.toLocaleString()} visits arrived without information showing which ad, post, email or link sent them.`,action:share>=50?"Add a trackable link to every ad, social post, email and QR destination so Vivid can show what actually brought each visitor.":"Keep using trackable links so more website visits can be tied to the marketing that produced them.",href});}
  if(actions===0)items.push({title:"Website visits are not yet tied to leads or sales",reason:"Vivid can see traffic and engagement, but no form submission, call, purchase or other business result was recorded in this period.",action:"Choose the website actions that matter—such as Contact Us, request a demo, call or purchase—and connect them so Vivid can show which marketing produced results.",href});
  const searchRows=search?.summary||[];
  const impressions=sum(searchRows,"impressions"),clicks=sum(searchRows,"clicks");
  if(impressions>0&&items.length<3)items.push({title:`Google Search showed your pages ${impressions.toLocaleString()} times`,reason:`Search Console recorded ${clicks.toLocaleString()} clicks from those impressions in the selected period.`,action:"Open Search visibility and improve high-impression queries or pages with weak clicks; position and impressions are visibility signals, not revenue.",href});
  return withPractice(items.slice(0,3),BEST_PRACTICES.website);
}

function organicInsights(analytics,youtube,range){
  const href=`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=organic`,groups=ga4Groups(analytics?.rows||[],row=>organicMedium(row.medium)&&!aiSource(row.source)),items=[];
  const sessions=groups.reduce((total,g)=>total+g.sessions,0),engaged=groups.reduce((total,g)=>total+g.engaged,0),actions=groups.reduce((total,g)=>total+g.keyEvents,0);
  if(sessions){items.push({title:`Unpaid posts, search and referrals produced ${sessions.toLocaleString()} website visits`,reason:`${engaged.toLocaleString()} visitors showed meaningful interest (${(100*engaged/sessions).toFixed(1)}%), but ${actions.toLocaleString()} leads, purchases or other results were recorded.`,action:actions?"Repeat the topic and call to action from the unpaid source that produced the most business results.":"Use trackable links on every social post and connect website leads or sales before deciding which unpaid content works best.",href});}
  for(const group of groups.slice(0,2))items.push({title:`${group.label} brought ${group.sessions.toLocaleString()} unpaid website visits`,reason:`${group.engaged.toLocaleString()} visitors showed meaningful interest (${group.sessions?(100*group.engaged/group.sessions).toFixed(1):"0.0"}%), and ${group.keyEvents.toLocaleString()} leads, calls, purchases or other chosen results came from this source.`,action:"Find the post or page behind these visits. If it produced a business result, repeat its topic and next step in one small content test.",href});
  const videos=youtube?.rows||[],views=sum(videos,"views"),engagement=sum(videos,"likes")+sum(videos,"comments")+sum(videos,"shares");
  if(views>0&&items.length<3)items.push({title:`YouTube generated ${views.toLocaleString()} organic views`,reason:`Videos recorded ${engagement.toLocaleString()} likes, comments and shares in the selected period.`,action:"Compare the strongest video topics and calls to action before planning the next post.",href});
  return withPractice(items.length?items.slice(0,3):[organicInsight(analytics,youtube,range)],BEST_PRACTICES.organic);
}

function aiInsights(analytics,range){
  const href=`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ai_traffic`,allRows=analytics?.rows||[],groups=ga4Groups(allRows,row=>aiSource(row.source)),items=[];
  const sessions=groups.reduce((total,g)=>total+g.sessions,0),engaged=groups.reduce((total,g)=>total+g.engaged,0),actions=groups.reduce((total,g)=>total+g.keyEvents,0),allSessions=sum(allRows,"sessions");
  if(!sessions)return withPractice([aiInsight(analytics,range)],BEST_PRACTICES.ai);
  items.push({title:`AI assistants brought ${sessions.toLocaleString()} identifiable website visits`,reason:`That is ${allSessions?(100*sessions/allSessions).toFixed(1):"0.0"}% of all website visits. These visits are already included in the Website total and are not counted twice.`,action:"Track whether this share is growing. Keep the pages these visitors reach clear, factual and easy to understand.",href});
  items.push({title:`${(100*engaged/sessions).toFixed(1)}% of identifiable AI visits showed meaningful interest`,reason:`${engaged.toLocaleString()} of ${sessions.toLocaleString()} visitors stayed, viewed more than one page or took another meaningful action. ${actions.toLocaleString()} leads, calls, purchases or other chosen results were recorded.`,action:actions?"Find the AI source and destination page that produced those results, then strengthen that page's answers and next step.":"Choose the leads, calls, purchases or other results that matter, then make the next step clearer on the pages AI visitors reach most often.",href});
  const best=groups[0];
  if(best)items.push({title:`${best.label} is the largest identifiable AI source`,reason:`It brought ${best.sessions.toLocaleString()} website visits, and ${best.engaged.toLocaleString()} of those showed meaningful interest. Some AI visits cannot be identified, so use this as a direction—not a complete count.`,action:"Review the pages receiving this traffic. Expand the clearest answers, proof points and next steps that help a buyer make a decision.",href});
  return withPractice(items.slice(0,3),BEST_PRACTICES.ai);
}

function paidWebsite(rows,platform){
  const patterns={"Google Ads":/google/i,"Meta Ads":/facebook|instagram|meta/i,"LinkedIn Ads":/linkedin/i,"TikTok Ads":/tiktok/i,"Reddit Ads":/reddit/i,"Pinterest Ads":/pinterest/i};
  const pattern=patterns[platform]||/$a/;
  return rows.filter(row=>pattern.test(String(row.source||""))&&/(paid|cpc|ppc)/i.test(String(row.medium||""))).reduce((total,row)=>({sessions:total.sessions+n(row.sessions),engaged:total.engaged+n(row.engaged_sessions),actions:total.actions+n(row.key_events),revenue:total.revenue+n(row.revenue)}),{sessions:0,engaged:0,actions:0,revenue:0});
}

function paidInsights(sources,range,now,analytics=null){
  const href=`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=paid_media`;
  const generated=[...campaignRecommendations(sources,range,now),...crossPlatformRecommendations(sources,range,now)];
  const rollups=sources.map(source=>{const rows=source.evidence?.rows||[];return{name:source.name,connections:(source.evidence?.connections||[]).length,campaigns:rows.length,impressions:sum(rows,"impressions"),clicks:sum(rows,"clicks"),conversions:rows.reduce((total,row)=>total+n(source.id==="meta"?row.purchases:row.conversions),0)};});
  const campaigns=sources.flatMap(source=>(source.evidence?.rows||[]).map(row=>({platform:source.name,name:row.campaign_name||"Unnamed campaign",impressions:n(row.impressions),clicks:n(row.clicks),conversions:n(source.id==="meta"?row.purchases:row.conversions),value:n(source.id==="meta"?row.purchase_value:source.id==="pinterest"?n(row.conversion_value_micros)/1e6:row.conversion_value)}))).sort((a,b)=>b.conversions-a.conversions||b.clicks-a.clicks||b.impressions-a.impressions);
  const connected=rollups.filter(item=>item.connections>0),delivery=rollups.filter(item=>item.impressions>0).sort((a,b)=>b.impressions-a.impressions),items=generated.slice(0,3);
  const totalImpressions=delivery.reduce((total,item)=>total+item.impressions,0),totalClicks=delivery.reduce((total,item)=>total+item.clicks,0),totalConversions=delivery.reduce((total,item)=>total+item.conversions,0);
  const leaderCampaign=campaigns[0];
  const website=leaderCampaign?paidWebsite(analytics?.rows||[],leaderCampaign.platform):{sessions:0,engaged:0,actions:0,revenue:0};
  const proven=leaderCampaign&&(leaderCampaign.conversions>0||leaderCampaign.value>0||website.actions>0||website.revenue>0);
  if(items.length<3&&leaderCampaign&&(leaderCampaign.impressions||leaderCampaign.clicks))items.push({title:proven?`${leaderCampaign.name} produced the strongest measured paid result`:`${leaderCampaign.name} generated the most paid attention—but no business result`,reason:`On ${leaderCampaign.platform}, it produced ${leaderCampaign.impressions.toLocaleString()} views, ${leaderCampaign.clicks.toLocaleString()} clicks and ${leaderCampaign.conversions.toLocaleString()} reported results.${website.sessions?` Traffic from ${leaderCampaign.platform} led to ${website.sessions.toLocaleString()} website visits, ${website.engaged.toLocaleString()} meaningful visits and ${website.actions.toLocaleString()} recorded leads or sales.`:""}`,action:proven?`Review the offer, headline and audience used in ${leaderCampaign.name}, then prepare a small test of that same approach on one weaker platform.`:`Do not copy this campaign to another platform yet. First improve its offer, headline or destination page and measure whether more visitors become leads or customers.`,href});
  if(items.length<3&&website.sessions){const rate=100*website.engaged/website.sessions;items.push({title:`${leaderCampaign.platform} sent ${website.sessions.toLocaleString()} website visits; ${website.engaged.toLocaleString()} showed meaningful interest`,reason:`That is a ${rate.toFixed(1)}% meaningful-visit rate, with ${website.actions.toLocaleString()} recorded leads or sales and ${website.revenue.toLocaleString(undefined,{style:"currency",currency:"USD"})} in website-reported revenue.`,action:rate<40?`Make the destination page match the promise in ${leaderCampaign.name}. Give visitors one obvious next step before spending more.`:`The destination page is holding attention. Keep the campaign stable while you test one clearer call to action for leads or sales.`,href});}
  const target=delivery.find(item=>item.name!==leaderCampaign?.platform&&item.clicks<(leaderCampaign?.clicks||0))||connected.find(item=>item.name!==leaderCampaign?.platform);
  if(items.length<3&&leaderCampaign?.clicks&&target&&proven)items.push({title:`Test the ${leaderCampaign.platform} approach on ${target.name}`,reason:`${leaderCampaign.name} produced ${leaderCampaign.clicks.toLocaleString()} clicks and at least one measured business result. ${target.name} produced ${target.clicks.toLocaleString()} clicks in the same period.`,action:`Create a small ${target.name} test using the same core offer and message as ${leaderCampaign.name}. Do not replace the original campaign until the test produces better business results.`,href});
  if(items.length<3&&(totalClicks>0||totalImpressions>0))items.push({title:totalConversions?`${totalConversions.toLocaleString()} ad-platform results are visible`:"Paid campaigns produced attention but no recorded result",reason:totalConversions?"The ad platforms reported results, but they still need to be matched to real leads, purchases or revenue before judging return.":`${totalImpressions.toLocaleString()} views and ${totalClicks.toLocaleString()} clicks are visible, but no connected ad platform reported a lead, purchase or other result.`,action:"Connect the website action that matters—lead, call, demo or purchase—to each campaign before moving budget from one platform to another.",href});
  if(items.length<3&&connected.length)items.push({title:`Vivid is watching ${connected.length} paid platform${connected.length===1?"":"s"}`,reason:`${connected.reduce((total,item)=>total+item.connections,0)} ad accounts are connected, and ${delivery.length} platforms returned campaign activity for this period.`,action:"Keep the connections active. Vivid will strengthen campaign-to-campaign recommendations as clicks and business results accumulate.",href});
  return withPractice(items.length?items.slice(0,3):[empty("No paid-account evidence is connected for this account","Connect at least one paid platform or select the account that owns the connection.",href)],BEST_PRACTICES.paid);
}

function organicInsight(analytics,youtube,range){
  const rows=analytics?.rows||[];
  const best=strongestGa4(rows,row=>organicMedium(row.medium)&&!aiSource(row.source));
  const videos=youtube?.rows||[];
  const views=sum(videos,"views"),engagement=sum(videos,"likes")+sum(videos,"comments")+sum(videos,"shares");
  if(best)return{priority:"Opportunity",confidence:best.sessions>=20?"Medium":"Early signal",title:`${best.label} brought the most identifiable unpaid website traffic`,reason:`It brought ${best.sessions.toLocaleString()} website visits. ${best.engaged.toLocaleString()} visitors showed meaningful interest, and ${best.keyEvents.toLocaleString()} leads, calls, purchases or other chosen results were recorded.`,action:"Find the post or page behind these visits. If it produced a business result, repeat its topic and next step in one small content test.",href:`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=organic`};
  if(views>0)return{priority:"Opportunity",confidence:views>=100?"Medium":"Early signal",title:"YouTube organic activity is building measurable attention",reason:`Vivid recorded ${views.toLocaleString()} views and ${engagement.toLocaleString()} likes, comments or shares in the selected period.`,action:"Open the video evidence and compare topics before planning the next post. Organic attention is not revenue by itself.",href:`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=organic`};
  return empty("No reliable unpaid-content signal yet","Connect website reporting and an unpaid content source, then use trackable links on every shared post.",`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=organic`);
}

function aiInsight(analytics,range){
  const best=strongestGa4(analytics?.rows||[],row=>aiSource(row.source));
  if(!best)return empty("No identifiable AI-referred visits yet","Keep website reporting connected. Vivid will watch identifiable visits from ChatGPT, Perplexity, Claude, Copilot, Gemini and other AI assistants.",`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ai_traffic`);
  const rate=best.sessions?100*best.engaged/best.sessions:0;
  return{priority:"Discovery signal",confidence:best.sessions>=20?"Medium":"Early signal",title:`${best.label} is the leading identifiable AI source`,reason:`It brought ${best.sessions.toLocaleString()} website visits. ${best.engaged.toLocaleString()} visitors showed meaningful interest (${rate.toFixed(1)}%), and ${best.keyEvents.toLocaleString()} leads, calls, purchases or other chosen results were recorded. These visits are also included in Website totals.`,action:"Review the pages these visitors reached. Improve the clearest page that answers a buyer's question and gives them an obvious next step.",href:`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ai_traffic`};
}

function websiteInsight(analytics,search,range){
  const recommended=websiteTrafficRecommendations(analytics||{},range)[0];
  if(recommended)return recommended;
  const rows=analytics?.rows||[],sessions=sum(rows,"sessions"),engaged=sum(rows,"engaged_sessions"),actions=sum(rows,"key_events");
  if(sessions>0){const rate=100*engaged/sessions;return{priority:"Website health",confidence:sessions>=50?"Medium":"Early signal",title:`${rate.toFixed(1)}% of website visits showed meaningful interest`,reason:`Vivid recorded ${sessions.toLocaleString()} website visits. ${engaged.toLocaleString()} visitors showed meaningful interest, and ${actions.toLocaleString()} leads, calls, purchases or other chosen results were recorded.`,action:actions>0?"Compare the pages and traffic sources that produced real business results.":"Choose the leads, calls, purchases or other results that matter, then give visitors one clear next step on the busiest pages.",href:`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ga4`};}
  const searchRows=search?.summary||search?.rows||[];
  const impressions=sum(searchRows,"impressions");
  if(impressions>0)return{priority:"Search visibility",confidence:"Early signal",title:"Google Search is showing your pages",reason:`Search Console recorded ${impressions.toLocaleString()} impressions in the selected period.`,action:"Open Search evidence and improve pages with impressions but weak clicks. Position is visibility—not revenue.",href:`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ga4`};
  return empty("No reliable website signal yet","Connect or refresh website reporting, then confirm the selected dates include website activity.",`/admin/marketing-command-center?from=${range.from}&to=${range.to}&platform=ga4`);
}

async function loadPerformanceCenterInsights({q,userId,range,now=new Date()}){
  const loaders=[googleEvidence,metaEvidence,linkedinEvidence,tiktokEvidence,redditEvidence,pinterestEvidence,analyticsEvidence,searchEvidence,youtubeEvidence];
  const [google,meta,linkedin,tiktok,reddit,pinterest,analytics,search,youtube]=await Promise.all(loaders.map(loader=>safe(()=>loader(q,userId,range))));
  const sources=[
    ["google_ads","Google Ads",google,"google-ads"],["meta","Meta Ads",meta,"meta-ads"],["linkedin","LinkedIn Ads",linkedin,"linkedin-ads"],
    ["tiktok","TikTok Ads",tiktok,"tiktok-ads"],["reddit","Reddit Ads",reddit,"reddit-ads"],["pinterest","Pinterest Ads",pinterest,"pinterest-ads"]
  ].map(([id,name,evidence,path])=>({id,name,evidence,href:(connectionId,r)=>`/admin/connectors/${path}/${connectionId}?from=${r.from}&to=${r.to}`}));
  return{paid:paidInsights(sources,range,now,analytics),website:websiteInsights(analytics,search,range),organic:organicInsights(analytics,youtube,range),ai:aiInsights(analytics,range)};
}

module.exports={loadPerformanceCenterInsights,aiSource,organicMedium,websiteInsights,organicInsights,aiInsights,paidInsights,paidWebsite};
