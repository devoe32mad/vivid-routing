"use strict";
const {conservativeProjection}=require("./conservative-projection");
const {accountToday}=require("./google-ads-auto-sync");
const numeric=value=>Number.isFinite(Number(value))?Number(value):0;
const shift=(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10);
const sum=rows=>rows.reduce((t,r)=>{
  for(const key of ["impressions","clicks","cost_micros","conversions","conversion_value"])t[key]+=numeric(r[key]);
  return t;
},{impressions:0,clicks:0,cost_micros:0,conversions:0,conversion_value:0});
const money=(micros,currency)=>`${(micros/1e6).toLocaleString("en-US",{maximumFractionDigits:0})} ${currency}`;
function googleRecommendations({connections=[],daily=[]}={},range,now=new Date()) {
  const items=[];
  for(const c of connections) {
    const href=`/admin/connectors/google-ads/${Number(c.id)}?from=${range.from}&to=${range.to}`;
    const add=(title,reason,signal="Review")=>items.push({title:`${c.account_name}: ${title}`,reason,signal,href,source:"Google Ads"});
    if(c.status==="attention_required") {
      add("Reconnect reporting", "Google access needs attention. Reconnect the account before using its results to make decisions.","Connection");continue;
    }
    if(!c.last_synced_at) {add("First sync pending","The account is connected. Performance recommendations will appear after reports arrive.","Awaiting data");continue;}
    if(c.last_error || !Number.isFinite(Date.parse(c.last_synced_at)) || now-Date.parse(c.last_synced_at)>2*3600000) {
      add("Refresh reporting before judging performance","The most recent report is stale or the last sync failed. Saved results remain available; performance comparisons are withheld.","Data freshness");continue;
    }
    const today=accountToday(c.account_timezone,now),end=range.to<today?range.to:shift(today,-1);
    if(range.from>end || c.last_from>range.from || c.last_to<end || !c.last_from || !c.last_to) {
      add("Complete the reporting baseline","The latest successful sync does not cover this entire period of completed account days. Choose a recent period or refresh the missing dates.","Coverage");continue;
    }
    const rows=daily.filter(r=>String(r.connection_id)===String(c.id) && r.date>=range.from && r.date<=end);
    const totals=sum(rows),days=(Date.parse(end)-Date.parse(range.from))/86400000+1;
    const period=`${range.from}–${end} (${c.account_timezone}; today excluded)`;
    if(!rows.length || totals.impressions===0) {
      add("Waiting for delivery evidence",`No delivery rows were returned for ${period}. Check campaign eligibility if you expected activity. This alone does not establish poor performance.`,"Awaiting data");continue;
    }
    if(days<7 || totals.clicks<30) {
      add("Keep collecting a baseline",`${totals.impressions} impressions, ${totals.clicks} clicks and ${money(totals.cost_micros,c.currency_code)} spend for ${period}. Vivid waits for at least 7 completed days and 30 clicks before traffic comparisons.`,"Limited evidence");continue;
    }
    if(totals.conversions<=0) {
      add("Review the conversion path",`${totals.clicks} clicks and ${money(totals.cost_micros,c.currency_code)} spend, with no positive Google-reported conversions for ${period}. Validate the conversion goal, tracking and landing page; delayed reporting can affect this result.`,"Measurement");
    } else {
      add("Review the actions being counted",`${totals.clicks} clicks and ${totals.conversions} Google-reported conversions for ${period}. Confirm whether these are page views, leads or purchases before treating them as business results.`,"Reported outcomes");
    }
    // Compare equal completed seven-day windows inside the selected, covered
    // range. Do not compare incompatible currencies or platform attribution.
    if(days>=14) {
      const currentStart=shift(end,-6),priorStart=shift(end,-13),priorEnd=shift(end,-7);
      const current=sum(rows.filter(r=>r.date>=currentStart));
      const previous=sum(rows.filter(r=>r.date>=priorStart && r.date<=priorEnd));
      if(current.clicks>=30 && previous.clicks>=30 && current.cost_micros>0 && previous.cost_micros>0) {
        const change=((current.cost_micros/current.clicks)/(previous.cost_micros/previous.clicks)-1)*100;
        if(Math.abs(change)>=20) add(change>0?"Investigate higher click costs":"Review the lower-cost traffic",`Average CPC ${change>0?"rose":"fell"} ${Math.abs(change).toFixed(0)}%: ${money(previous.cost_micros/previous.clicks,c.currency_code)} → ${money(current.cost_micros/current.clicks,c.currency_code)}. ${priorStart}–${priorEnd} (${previous.clicks} clicks) vs ${currentStart}–${end} (${current.clicks} clicks). Review keyword and campaign mix plus lead quality before changing spend.`,"Traffic trend");
      }
    }
    const campaigns=new Map();
    for(const r of rows) {
      const key=String(r.campaign_id);
      if(!campaigns.has(key))campaigns.set(key,{...r,rows:[]});
      campaigns.get(key).rows.push(r);
    }
    const eligible=[...campaigns.values()].map(r=>({...r,...sum(r.rows)})).filter(r=>r.clicks>=30 && r.impressions>=1000 && r.cost_micros>0);
    for(const c1 of eligible) {
      const peers=eligible.filter(r=>r.campaign_id!==c1.campaign_id && r.channel===c1.channel && r.currency_code===c1.currency_code);
      if(!peers.length)continue;
      const p=sum(peers),cpc=c1.cost_micros/c1.clicks,peerCpc=p.cost_micros/p.clicks;
      if(cpc<=peerCpc*0.8) add(`Inspect ${c1.campaign_name}'s traffic efficiency`,`${money(cpc,c1.currency_code)} CPC vs ${money(peerCpc,c1.currency_code)} for other ${c1.channel} campaigns in this account; ${c1.clicks} clicks vs ${p.clicks} peer clicks for ${period}. Lower click cost is a useful test candidate, but does not establish better leads, sales or ROI.`,"Traffic signal");
      else if(cpc>=peerCpc*1.25) add(`Review ${c1.campaign_name}'s click costs`,`${money(cpc,c1.currency_code)} CPC vs ${money(peerCpc,c1.currency_code)} for other ${c1.channel} campaigns in this account; ${c1.clicks} clicks vs ${p.clicks} peer clicks for ${period}. Inspect search terms and targeting, then compare lead quality before reducing spend.`,"Needs review");
    }
  }
  return items;
}
function tiktokRecommendations({connections=[],rows=[]}={},range,now=new Date()) {
  const items=[];
  for(const connection of connections){
    const href=`/admin/connectors/tiktok-ads/${Number(connection.id)}?from=${range.from}&to=${range.to}`;
    const add=(title,reason,signal="Review")=>items.push({title:`${connection.account_name}: ${title}`,reason,signal,href,source:"TikTok Ads"});
    if(connection.status==="attention_required"){add("Reconnect reporting","TikTok access needs attention. Reconnect the advertiser account before using its results to make decisions.","Connection");continue;}
    if(!connection.last_synced_at){add("First sync pending","The advertiser account is connected. Performance recommendations will appear after TikTok reports arrive.","Awaiting data");continue;}
    if(connection.last_error||!Number.isFinite(Date.parse(connection.last_synced_at))||now-Date.parse(connection.last_synced_at)>2*3600000){add("Refresh reporting before judging performance","The most recent TikTok report is stale or the last sync failed. Saved evidence remains available, but performance conclusions are withheld.","Data freshness");continue;}
    const accountRows=rows.filter(r=>String(r.connection_id)===String(connection.id)),totals=sum(accountRows);
    totals.video_views=accountRows.reduce((value,row)=>value+numeric(row.video_views),0);totals.video_views_6s=accountRows.reduce((value,row)=>value+numeric(row.video_views_6s),0);
    const period=`${range.from}–${range.to} (${connection.account_timezone||"account timezone"})`;
    if(!accountRows.length||totals.impressions===0){add("Waiting for delivery evidence",`No TikTok delivery rows were returned for ${period}. Check campaign eligibility if activity was expected; this alone does not establish poor performance.`,"Awaiting data");continue;}
    if(totals.impressions<1000||totals.clicks<30){add("Keep collecting a baseline",`${totals.impressions} impressions, ${totals.clicks} clicks and ${money(totals.cost_micros,connection.currency_code)} spend for ${period}. Vivid waits for at least 1,000 impressions and 30 clicks before interpreting traffic or outcomes.`,"Limited evidence");continue;}
    if(totals.conversions<=0)add("Review the path after the click",`${totals.clicks} clicks and ${money(totals.cost_micros,connection.currency_code)} TikTok spend, with no positive TikTok-reported conversions for ${period}. Validate the landing page, TikTok Pixel/events and Vivid outcome tracking before changing spend.`,"Measurement");
    else add("Verify the reported outcomes",`${totals.clicks} clicks and ${totals.conversions} TikTok-reported conversions for ${period}. Reconcile them with GA4, Vivid and sales evidence before treating them as customers or revenue.`,"Reported outcomes");
    const eligible=accountRows.filter(r=>numeric(r.impressions)>=1000&&numeric(r.clicks)>=30&&numeric(r.video_views)>0);
    if(eligible.length>=2){
      const scored=eligible.map(r=>({row:r,retention:numeric(r.video_views_6s)/numeric(r.video_views),ctr:numeric(r.clicks)/numeric(r.impressions)})).sort((a,b)=>b.retention-a.retention),best=scored[0],worst=scored.at(-1);
      if(best.retention-worst.retention>=0.05&&best.retention>=worst.retention*1.25)add(`Compare ${best.row.campaign_name}'s creative with ${worst.row.campaign_name}`,`${(100*best.retention).toFixed(1)}% vs ${(100*worst.retention).toFixed(1)}% of recorded video plays reached 6 seconds. Review hooks, audience and placements, then run a controlled creative test; retention alone does not establish sales performance.`,"Creative signal");
    }
  }
  return items;
}
function crossPlatformRecommendations(sources=[],range,now=new Date()) {
  const eligible=[];
  for(const source of sources){
    const fresh=(source.evidence?.connections||[]).filter(connection=>connection.status!=="attention_required"&&!connection.last_error&&Number.isFinite(Date.parse(connection.last_synced_at))&&now-Date.parse(connection.last_synced_at)<=2*3600000);
    for(const connection of fresh){
      const rows=(source.evidence?.rows||[]).filter(row=>String(row.connection_id)===String(connection.id));
      const totals=sum(rows),currency=connection.currency_code||rows[0]?.currency_code||"USD";
      if(totals.impressions<1000||totals.clicks<30||totals.cost_micros<=0)continue;
      const value=rows.reduce((total,row)=>total+numeric(source.id==="meta"?row.purchase_value:source.id==="pinterest"?numeric(row.conversion_value_micros)/1e6:row.conversion_value),0);
      const conversions=rows.reduce((total,row)=>total+numeric(source.id==="meta"?row.purchases:row.conversions),0);
      const engagement=rows.reduce((total,row)=>total+numeric(row.reactions)+numeric(row.comments)+numeric(row.shares)+numeric(row.saves),0);
      eligible.push({source:source.name,id:source.id,connection,totals:{...totals,value,conversions,engagement},currency,href:source.href(connection.id,range),ctr:totals.clicks/totals.impressions,cpc:totals.cost_micros/totals.clicks,roas:totals.cost_micros>0?value/(totals.cost_micros/1e6):0});
    }
  }
  const items=[];
  for(const currency of new Set(eligible.map(item=>item.currency))){
    const peers=eligible.filter(item=>item.currency===currency);
    if(peers.length<2)continue;
    const best=[...peers].sort((a,b)=>a.cpc-b.cpc)[0],worst=[...peers].sort((a,b)=>b.cpc-a.cpc)[0];
    if(best.id!==worst.id&&worst.cpc>=best.cpc*1.25){
      items.push({source:"Cross-platform",signal:"Traffic efficiency",priority:"Medium",confidence:"Medium",title:`Review ${best.source} as a lower-cost traffic test`,reason:`${money(best.cpc,currency)} average CPC across ${best.totals.clicks} clicks, compared with ${money(worst.cpc,currency)} across ${worst.totals.clicks} clicks on ${worst.source}. Both exceed Vivid’s minimum evidence threshold. Compare GA4 engagement and verified outcomes before reallocating budget; lower CPC alone does not establish better customers or ROI.`,evidence:[`${best.source} · ${best.totals.impressions} impressions · ${best.totals.clicks} clicks · ${money(best.totals.cost_micros,currency)} spend`,`${worst.source} · ${worst.totals.impressions} impressions · ${worst.totals.clicks} clicks · ${money(worst.totals.cost_micros,currency)} spend`],limitation:"Platform objectives and attribution rules can differ. CPC does not measure lead quality, profit or incremental lift.",action:`Prepare a controlled traffic test using the strongest ${best.source} message; keep the current budget unchanged until approved.`,href:best.href});
      items.push({source:"Cross-platform",signal:"Cost review",priority:"Medium",confidence:"Medium",title:`Inspect ${worst.source} before increasing spend`,reason:`${money(worst.cpc,currency)} average CPC across ${worst.totals.clicks} clicks versus ${money(best.cpc,currency)} on ${best.source}. Review audience, creative and post-click quality before changing spend; platform attribution and campaign objectives may differ.`,evidence:[`${worst.source} CPC · ${money(worst.cpc,currency)}`,`${best.source} CPC · ${money(best.cpc,currency)}`],limitation:"This comparison does not establish that the lower-cost platform produces better customers.",action:`Review ${worst.source} targeting, creative and landing-page alignment before approving additional spend.`,href:worst.href});
    }
    const outcomePeers=peers.filter(item=>item.totals.conversions>=2&&item.totals.value>0);
    if(outcomePeers.length>=2){
      const best=[...outcomePeers].sort((a,b)=>b.roas-a.roas)[0],worst=[...outcomePeers].sort((a,b)=>a.roas-b.roas)[0];
      if(best.id!==worst.id&&best.roas>=Math.max(1.5,worst.roas*1.5))items.push({source:"Cross-platform",signal:"Reported return",priority:"High",confidence:"Medium",title:`Test ${best.source}’s stronger offer across another channel`,reason:`${best.source} reports ${best.roas.toFixed(2)}x ROAS from ${best.totals.conversions} conversions, compared with ${worst.roas.toFixed(2)}x on ${worst.source}. Preserve the stronger offer and run a limited cross-channel test rather than moving the full budget.`,evidence:[`${best.source} · ${money(best.totals.cost_micros,currency)} spend · ${best.totals.conversions} reported conversions · ${best.totals.value.toLocaleString("en-US",{maximumFractionDigits:0})} ${currency} reported value`,`${worst.source} · ${money(worst.totals.cost_micros,currency)} spend · ${worst.totals.conversions} reported conversions · ${worst.totals.value.toLocaleString("en-US",{maximumFractionDigits:0})} ${currency} reported value`],limitation:"Platform-reported conversions can overlap and are not verified profit. Different audiences and attribution windows can affect ROAS.",action:`Prepare a small approved test of the ${best.source} offer on ${worst.source}; keep existing campaigns unchanged while measuring the result.`,href:best.href});
    }
  }
  return items.sort((a,b)=>({High:3,Medium:2,Low:1}[b.priority]||0)-({High:3,Medium:2,Low:1}[a.priority]||0)).slice(0,6);
}
const paidSource=value=>{value=String(value||"").toLowerCase();if(/google/.test(value))return"Google Ads";if(/facebook|instagram|meta/.test(value))return"Meta Ads";if(/linkedin/.test(value))return"LinkedIn Ads";if(/pinterest/.test(value))return"Pinterest Ads";if(/tiktok/.test(value))return"TikTok Ads";if(/reddit/.test(value))return"Reddit Ads";return"";};
function websiteTrafficRecommendations({rows=[]}={},range){
  const groups=new Map();
  for(const row of rows){const source=paidSource(row.source);if(!source||!/(cpc|paid|paid.social)/i.test(String(row.medium||"")))continue;const group=groups.get(source)||{source,sessions:0,users:0,engaged:0,keyEvents:0,revenue:0};group.sessions+=numeric(row.sessions);group.users+=numeric(row.users);group.engaged+=numeric(row.engaged_sessions);group.keyEvents+=numeric(row.key_events);group.revenue+=numeric(row.revenue);groups.set(source,group);}
  const eligible=[...groups.values()].filter(group=>group.sessions>=20).map(group=>({...group,engagementRate:group.engaged/group.sessions})),items=[];
  for(const group of eligible)if(group.keyEvents===0)items.push({source:"Website behavior",signal:"Post-click gap",priority:"High",confidence:group.sessions>=50?"Medium":"Low",title:`Investigate ${group.source} visits that did not produce key actions`,reason:`GA4 recorded ${group.sessions} sessions and ${group.engaged} engaged sessions from ${group.source}, but no key events for ${range.from}–${range.to}. Validate UTMs, the landing page and GA4 key-event setup before changing spend.`,evidence:[`${group.source} · ${group.sessions} website sessions · ${group.engaged} engaged sessions`,"GA4 · 0 key events in the selected period"],limitation:"GA4 source-level traffic may include multiple campaigns and does not prove that the advertising caused or failed to cause an outcome.",action:"Audit campaign UTMs and the landing-page conversion event; do not pause the platform solely from this signal.",href:"/admin/connectors/google-analytics"});
  if(eligible.length>=2){const best=[...eligible].sort((a,b)=>b.engagementRate-a.engagementRate)[0],worst=[...eligible].sort((a,b)=>a.engagementRate-b.engagementRate)[0],difference=best.engagementRate-worst.engagementRate;if(difference>=0.15)items.push({source:"Website behavior",signal:"Traffic quality",priority:"Medium",confidence:best.sessions>=50&&worst.sessions>=50?"Medium":"Low",title:`Compare the landing experience for ${best.source} and ${worst.source}`,reason:`${(100*best.engagementRate).toFixed(1)}% of ${best.source} sessions were engaged versus ${(100*worst.engagementRate).toFixed(1)}% from ${worst.source}. Review offer-message match, page speed and audience intent before reallocating budget.`,evidence:[`${best.source} · ${best.sessions} sessions · ${(100*best.engagementRate).toFixed(1)}% engagement`,`${worst.source} · ${worst.sessions} sessions · ${(100*worst.engagementRate).toFixed(1)}% engagement`],limitation:"GA4 engagement is a website-quality signal, not verified sales or incremental lift.",action:`Prepare a landing-page and message comparison using the stronger ${best.source} experience as the test hypothesis.`,href:"/admin/connectors/google-analytics"});}
  return items.slice(0,4);
}
function campaignRecommendations(sources=[],range,now=new Date(),economics=null){
  const items=[];
  for(const source of sources){
    for(const connection of source.evidence?.connections||[]){
      if(connection.status==="attention_required"||connection.last_error||!Number.isFinite(Date.parse(connection.last_synced_at))||now-Date.parse(connection.last_synced_at)>2*3600000)continue;
      const rows=(source.evidence?.rows||[]).filter(row=>String(row.connection_id)===String(connection.id));
      const normalized=rows.map(row=>{const cost=numeric(row.cost_micros),clicks=numeric(row.clicks),impressions=numeric(row.impressions),conversions=numeric(source.id==="meta"?row.purchases:row.conversions),value=numeric(source.id==="meta"?row.purchase_value:source.id==="pinterest"?numeric(row.conversion_value_micros)/1e6:row.conversion_value);return{row,cost,clicks,impressions,conversions,value,cpc:clicks?cost/clicks:0,ctr:impressions?clicks/impressions:0,roas:cost?value/(cost/1e6):0};});
      const href=source.href(connection.id,range),currency=connection.currency_code||rows[0]?.currency_code||"USD";
      // Require a covered, completed baseline and comparable campaigns in one account.
      const days=(Date.parse(range.to)-Date.parse(range.from))/86400000+1;
      const covered=connection.last_from&&connection.last_to&&connection.last_from<=range.from&&connection.last_to>=range.to;
      const completed=range.to<accountToday(connection.account_timezone||"UTC",now);
      if(covered&&completed&&days>=7){
        const candidates=normalized.filter(c=>c.clicks>=30&&c.conversions>=5&&c.value>0&&c.cost>0&&c.row.campaign_id&&(c.row.currency_code||currency)===currency);
        const winners=[...candidates].sort((a,b)=>b.roas-a.roas);
        for(const winner of winners){
          const objective=winner.row.objective||winner.row.channel;
          const donor=candidates.filter(c=>c.row.campaign_id!==winner.row.campaign_id&&objective&&(c.row.objective||c.row.channel)===objective&&winner.roas>=c.roas*1.5).sort((a,b)=>a.roas-b.roas)[0];
          if(!donor)continue;
          const budget=Math.floor(Math.min(winner.cost,donor.cost)/1e6*0.10*100)/100;
          const projection=conservativeProjection({spend:winner.cost/1e6,clicks:winner.clicks,conversions:winner.conversions,revenue:winner.value,budget,marginPct:economics?.gross_margin_pct});
          if(!projection||projection.roas<=1||projection.roas<=donor.roas)continue;
          Object.assign(projection,{currency,evidenceHref:href,fromCampaign:donor.row.campaign_name||String(donor.row.campaign_id),toCampaign:winner.row.campaign_name||String(winner.row.campaign_id),confidence:winner.conversions>=30&&donor.conversions>=30?"Medium":"Low",period:`${range.from}–${range.to}`,baselineSpend:winner.cost/1e6,baselineClicks:winner.clicks,baselineConversions:winner.conversions,baselineRevenue:winner.value});
          items.push({source:source.name,signal:"Revenue test",priority:"High",confidence:projection.confidence,title:`Consider a limited budget test from ${projection.fromCampaign} to ${projection.toCampaign}`,reason:`${projection.toCampaign} reported ${winner.roas.toFixed(2)}× ROAS compared with ${donor.roas.toFixed(2)}× for ${projection.fromCampaign} in the same account, currency and campaign objective/channel.`,action:"Confirm that conversion values represent revenue and attribution settings match, then prepare the proposed test for approval.",limitation:"Platform-attributed value is not verified revenue. A stronger historical campaign can perform differently with additional budget.",href,projection,testPlan:{change:`Move ${budget.toFixed(2)} ${currency} from ${projection.fromCampaign} to ${projection.toCampaign}.`,where:`${source.name}: ${projection.toCampaign}.`,why:"The conservative scenario remains stronger than the source campaign’s reported ROAS.",timing:"Review after 14 days, allowing for the account’s conversion reporting delay.",success:"Compare revenue and ROAS with this projection and the source campaign baseline.",review:"Stop expansion if measured ROAS falls below the source campaign baseline; review tracking before drawing conclusions.",keep:"Keep total spend capped and all unrelated campaigns unchanged. Approval is required before any budget change."}});
          break;
        }
      }
      const waste=normalized.filter(c=>c.clicks>=50&&c.cost>0&&c.conversions===0).sort((a,b)=>b.cost-a.cost)[0];
      if(waste)items.push({source:source.name,signal:"Outcome gap",priority:"High",confidence:waste.clicks>=100?"Medium":"Low",title:`Audit ${waste.row.campaign_name||"campaign"} before adding budget`,reason:`The campaign recorded ${waste.clicks} clicks and ${money(waste.cost,currency)} spend, with no positive platform-reported conversions for ${range.from}–${range.to}.`,evidence:[`${waste.impressions} impressions · ${waste.clicks} clicks`,`${money(waste.cost,currency)} spend · 0 reported conversions`],limitation:"A missing platform conversion can reflect tracking, attribution delay or an upper-funnel objective; it does not prove the spend was wasted.",action:"Verify the campaign objective, conversion event, UTMs and landing page before approving more spend.",href});
      const eligible=normalized.filter(c=>c.impressions>=1000&&c.clicks>=30&&c.cost>0);
      if(eligible.length<2)continue;
      const best=[...eligible].sort((a,b)=>a.cpc-b.cpc)[0],worst=[...eligible].sort((a,b)=>b.cpc-a.cpc)[0];
      if(best.row.campaign_id!==worst.row.campaign_id&&worst.cpc>=best.cpc*1.3)items.push({source:source.name,signal:"Campaign comparison",priority:"Medium",confidence:"Medium",title:`Compare ${best.row.campaign_name||"lower-cost campaign"} with ${worst.row.campaign_name||"higher-cost campaign"}`,reason:`Average CPC was ${money(best.cpc,currency)} versus ${money(worst.cpc,currency)} across campaigns on the same platform and currency.`,evidence:[`${best.row.campaign_name||"Campaign"} · ${best.clicks} clicks · ${money(best.cpc,currency)} CPC`,`${worst.row.campaign_name||"Campaign"} · ${worst.clicks} clicks · ${money(worst.cpc,currency)} CPC`],limitation:"Different objectives, audiences and placements can make CPC comparisons imperfect. Lower CPC does not establish better leads or profit.",action:"Review the lower-cost campaign’s offer, creative and audience as a hypothesis for a controlled test; keep budgets unchanged until approved.",href});
    }
  }
  return items.sort((a,b)=>({High:3,Medium:2,Low:1}[b.priority]||0)-({High:3,Medium:2,Low:1}[a.priority]||0)).slice(0,8);
}
module.exports={googleRecommendations,tiktokRecommendations,crossPlatformRecommendations,websiteTrafficRecommendations,campaignRecommendations,sum};
