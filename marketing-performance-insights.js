"use strict";
const {accountToday}=require("./google-ads-auto-sync");
const numeric=value=>Number.isFinite(Number(value))?Number(value):0;
const shift=(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10);
const sum=rows=>rows.reduce((t,r)=>{
  for(const key of ["impressions","clicks","cost_micros","conversions","conversion_value"])t[key]+=numeric(r[key]);
  return t;
},{impressions:0,clicks:0,cost_micros:0,conversions:0,conversion_value:0});
const money=(micros,currency)=>`${(micros/1e6).toFixed(2)} ${currency}`;
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
module.exports={googleRecommendations,sum};
