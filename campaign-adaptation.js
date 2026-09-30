"use strict";

const {accountToday}=require("./google-ads-auto-sync");
const n=value=>Number.isFinite(Number(value))?Number(value):0;
const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const goal=value=>/lead/i.test(value)?"leads":/purchase|sales|conversion/i.test(value)?"conversions":/traffic|click|visit/i.test(value)?"traffic":/awareness|reach|video/i.test(value)?"awareness":"unknown";
const money=(value,currency)=>`${value.toFixed(2)} ${currency}`;

function campaignEvidence(sources,range,now){
  const campaigns=[];
  for(const source of sources){
    for(const connection of source.evidence?.connections||[]){
      const synced=Date.parse(connection.last_synced_at),today=accountToday(connection.account_timezone||"UTC",now);
      if(connection.status==="attention_required"||connection.last_error||!Number.isFinite(synced)||now-synced>7200000||synced>now.getTime()+60000)continue;
      // Daily rows let a range ending today still use completed days only.
      const end=range.to<today?range.to:new Date(Date.parse(today)-86400000).toISOString().slice(0,10);
      if(!connection.last_from||!connection.last_to||connection.last_from>range.from||connection.last_to<end||(Date.parse(end)-Date.parse(range.from))/86400000+1<7)continue;
      const aggregate=(source.evidence?.rows||[]).filter(r=>String(r.connection_id)===String(connection.id));
      const daily=(source.evidence?.daily||[]).filter(r=>String(r.connection_id)===String(connection.id)&&r.date>=range.from&&r.date<=end);
      if(end!==range.to&&!daily.length)continue;
      const grouped=new Map();
      for(const r of end===range.to?aggregate:daily){
        const currency=r.currency_code||connection.currency_code;
        if(!currency||!r.campaign_id)continue;
        const key=`${r.campaign_id}:${currency}`;
        const meta=aggregate.find(a=>String(a.campaign_id)===String(r.campaign_id)&&(!a.currency_code||a.currency_code===currency))||r;
        const c=grouped.get(key)||{platformId:source.id,platform:source.name,account:connection.account_name||String(connection.id),connectionId:connection.id,id:String(r.campaign_id),name:meta.campaign_name||String(r.campaign_id),objective:meta.objective||meta.channel||"Not reported",currency,spend:0,clicks:0,conversions:0,revenue:0,from:range.from,to:end};
        c.spend+=n(r.cost_micros)/1e6;c.clicks+=n(r.clicks);
        c.conversions+=n(source.id==="meta"?r.purchases:r.conversions);
        c.revenue+=n(source.id==="meta"?r.purchase_value:source.id==="pinterest"?n(r.conversion_value_micros)/1e6:r.conversion_value);
        grouped.set(key,c);
      }
      for(const c of grouped.values()){
        if(c.spend<=0||c.clicks<30||c.conversions<0||c.revenue<0)continue;
        c.cpc=c.spend/c.clicks;c.cvr=c.conversions/c.clicks;c.roas=c.revenue/c.spend;c.valuePerConversion=c.conversions>0?c.revenue/c.conversions:null;
        c.goal=source.id==="meta"?"conversions":goal(c.objective);
        c.key=`${source.id}:${connection.id}:${c.id}:${c.currency}`;
        c.href=`/admin/marketing-command-center?${new URLSearchParams({from:c.from,to:c.to,platform:c.platformId,campaign:`${c.connectionId}:${c.id}`})}#campaign-evidence`;
        campaigns.push(c);
      }
    }
  }
  return campaigns;
}

function adaptationScenario(source,target,marginPct=null){
  const crossPlatform=source.platformId!==target.platformId;
  const budget=Math.floor(Math.min(source.spend,target.spend)*0.1*100)/100;
  if(budget<=0)return null;
  // Transfer only a portion of the observed rate advantage, then apply a haircut.
  // Retain destination costs; never assume the source platform's cheaper clicks transfer.
  const transfer=crossPlatform?0.25:0.50;
  const rate=(target.cvr+Math.max(0,source.cvr-target.cvr)*transfer)*0.70;
  const cpc=target.cpc*1.15;
  const conversions=budget/cpc*rate;
  const baselineConversions=budget/target.cpc*target.cvr;
  const hasRevenue=source.valuePerConversion>0&&target.valuePerConversion>0;
  const valuePerConversion=hasRevenue?Math.min(source.valuePerConversion,target.valuePerConversion):null;
  const revenue=hasRevenue?conversions*valuePerConversion:null;
  const baselineRevenue=hasRevenue?budget*target.roas:null;
  const margin=marginPct!==null&&marginPct!==undefined&&String(marginPct).trim()!==""&&Number.isFinite(Number(marginPct))&&Number(marginPct)>=0&&Number(marginPct)<=100?Number(marginPct):null;
  return {crossPlatform,budget,transfer,rate,cpc,conversions,baselineConversions,valuePerConversion,revenue,baselineRevenue,roas:hasRevenue?revenue/budget:null,revenueDifference:hasRevenue?revenue-baselineRevenue:null,conversionDifference:conversions-baselineConversions,margin,grossProfit:hasRevenue&&margin!==null?revenue*margin/100:null,roi:hasRevenue&&margin!==null?100*(revenue*margin/100-budget)/budget:null};
}

function adaptationRecommendations(sources=[],range,now=new Date(),economics=null){
  const campaigns=campaignEvidence(sources,range,now),items=[];
  for(const target of campaigns){
    const matches=[];
    for(const source of campaigns){
      if(source.key===target.key||source.currency!==target.currency||source.from!==target.from||source.to!==target.to||source.conversions<5||source.cvr<=target.cvr*1.25||source.cvr<=0)continue;
      // Never compare known incompatible objectives. Unknown objectives require confirmation.
      if(source.goal!=="unknown"&&target.goal!=="unknown"&&source.goal!==target.goal)continue;
      if([source.goal,target.goal].some(g=>g==="traffic"||g==="awareness"))continue;
      if(source.revenue>0&&target.revenue>0&&source.roas<=target.roas*1.25)continue;
      if((source.revenue>0)!==(target.revenue>0))continue;
      if(source.revenue===0&&(source.goal==="unknown"||target.goal==="unknown"))continue;
      const scenario=adaptationScenario(source,target,economics?.gross_margin_pct);if(!scenario)continue;
      // Show when conservative assumptions erase the apparent upside, not just positive cases.
      const favorable=scenario.revenue!==null?scenario.revenueDifference>0:scenario.conversionDifference>0;
      const cross=scenario.crossPlatform;
      const confidence=!cross&&String(source.connectionId)===String(target.connectionId)&&source.conversions>=30&&target.conversions>=30&&source.goal!=="unknown"&&target.goal!=="unknown"?"Medium":"Low";
      const sourceLabel=`${source.name} (${source.platform})`,targetLabel=`${target.name} (${target.platform})`;
      const title=favorable?`Test ${source.name}’s approach in ${target.name}${cross?` on ${target.platform}`:""}`:`Review ${source.name} as a model for ${target.name}; projected improvement is not established`;
      const reason=`${sourceLabel} recorded ${(source.cvr*100).toFixed(2)}% click-to-conversion versus ${(target.cvr*100).toFixed(2)}% for ${targetLabel}.${source.revenue>0?` Reported ROAS was ${source.roas.toFixed(2)}× versus ${target.roas.toFixed(2)}×.`:" Revenue is unavailable; compare reported outcomes only."}`;
      const adaptation={source,target,scenario,confidence,favorable,steps:[
        `Open ${sourceLabel} and identify one offer, headline or call to action to test. Vivid’s current reports do not include the ad copy, creative or audience settings, so no winning creative element has been verified.`,
        `Create a test variant of ${targetLabel}. Copy only the selected element; keep its audience, destination, conversion event and attribution settings fixed unless that element is explicitly the test.`,
        cross?`Adapt the selected message to ${target.platform}’s ad format. Retain ${target.platform}’s own audience settings and costs; performance on ${source.platform} is not proof of performance here.`:`Keep the original ${target.name} as the control and use the platform’s split-test feature where available.`,
        `Use ${money(scenario.budget,target.currency)} from ${target.name}’s existing budget as a proposed total test cap, not a daily budget. Leave ${source.name} unchanged. Review after 14 days and after the normal conversion-reporting delay; extend only with approval if evidence remains thin.`
      ]};
      matches.push({source:target.platform,relatedPlatforms:[source.platformId,target.platformId],signal:cross?"Cross-platform campaign adaptation":"Same-platform campaign adaptation",priority:favorable?"High":"Medium",confidence,title,reason,action:favorable?`Review the source and target evidence, confirm comparable conversion events and revenue values, then approve a limited variant of ${target.name}.`:`Do not replace ${target.name} or increase spend on this estimate. Inspect the source approach and tracking first.`,href:target.href,adaptation,limitation:"Campaign-level differences do not prove which creative caused results. All numbers here are platform-reported and may use different attribution rules; projections are conditional scenarios, not verified sales or causal lift.",score:scenario.revenue!==null?(scenario.revenueDifference/scenario.budget):(scenario.conversionDifference/scenario.budget)});
    }
    // Keep the strongest same-platform and cross-platform option per target for comparison.
    for(const cross of [false,true]){const best=matches.filter(x=>x.adaptation.scenario.crossPlatform===cross).sort((a,b)=>b.score-a.score)[0];if(best)items.push(best);}
  }
  return items.sort((a,b)=>Number(b.adaptation.favorable)-Number(a.adaptation.favorable)||b.score-a.score).slice(0,8);
}

function renderAdaptation(a){
  if(!a)return "";
  const {source:s,target:t,scenario:p}=a,m=v=>money(v,t.currency),num=v=>v.toFixed(1),pct=v=>`${(v*100).toFixed(2)}%`;
  const metrics=[['Spend',m(s.spend),m(t.spend)],['Clicks',num(s.clicks),num(t.clicks)],['Reported conversions',num(s.conversions),num(t.conversions)],['Conversion rate',pct(s.cvr),pct(t.cvr)],['Cost per click',m(s.cpc),m(t.cpc)],['Reported value',m(s.revenue),m(t.revenue)],['Reported ROAS',`${s.roas.toFixed(2)}×`,`${t.roas.toFixed(2)}×`]];
  return `<section class="campaign-adaptation"><p><b>Source:</b> <a href="${esc(s.href)}">${esc(s.name)} · ${esc(s.platform)}</a><br><b>Change:</b> <a href="${esc(t.href)}">${esc(t.name)} · ${esc(t.platform)}</a><br>Evidence: ${esc(s.from)}–${esc(s.to)} · ${esc(t.currency)} · ${esc(a.confidence)} projection confidence</p><h4>Conservative test scenario</h4>${p.revenue!==null?`<p><strong>${esc(m(p.revenue))} projected platform-attributed revenue</strong><br>${p.roas.toFixed(2)}× projected ROAS · approximately ${num(p.conversions)} reported conversions</p><p>For the same ${esc(m(p.budget))} test budget, ${esc(t.name)}’s historical rates imply ${esc(m(p.baselineRevenue))} revenue and ${num(p.baselineConversions)} conversions. Scenario difference: ${esc(m(p.revenueDifference))} revenue and ${num(p.conversionDifference)} conversions. This is a modeled comparison, not measured incremental revenue.</p>`:`<p><strong>Approximately ${num(p.conversions)} reported conversions</strong> on ${esc(m(p.budget))}, compared with ${num(p.baselineConversions)} at the target’s historical rate. Revenue and ROAS are unavailable because reported revenue is missing.</p>`}${!a.favorable?'<p><b>The conservative scenario does not support replacing this campaign or increasing spend.</b></p>':""}<details><summary>Compare both campaigns</summary><div style="overflow-x:auto"><table><thead><tr><th>Metric</th><th>${esc(s.name)} · ${esc(s.platform)}</th><th>${esc(t.name)} · ${esc(t.platform)}</th></tr></thead><tbody>${metrics.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p>Source account: ${esc(s.account)}; objective/channel: ${esc(s.objective)}. Target account: ${esc(t.account)}; objective/channel: ${esc(t.objective)}.</p></details><details open><summary>Exactly what to test</summary><ol>${a.steps.map(step=>`<li>${esc(step)}</li>`).join("")}</ol></details><details><summary>How we calculated this</summary><p>Take the target’s ${pct(t.cvr)} conversion rate, add ${p.transfer*100}% of the observed conversion-rate gap, then reduce that combined rate by 30%: ${pct(p.rate)}. Increase the target’s own ${esc(m(t.cpc))} CPC by 15%: ${esc(m(p.cpc))}. Projected conversions = test budget ÷ adjusted CPC × adjusted conversion rate.</p><p>Proposed total test budget = 10% of the smaller historical campaign spend, rounded down to cents.${p.valuePerConversion!==null?` Revenue uses the lower of the two observed values per conversion: ${esc(m(p.valuePerConversion))}.`:" No sale value is invented."} ${p.crossPlatform?"Only 25% of the conversion-rate gap transfers across platforms, versus 50% within a platform. These are cautious modeling assumptions, not measured transfer rates.":"The 50% transfer assumption is a modeling choice, not a measured effect."}</p><p>Before approval, confirm the same business, offer, geography, conversion definition, attribution window and revenue valuation. Current reports do not establish these matches. Platform conversion values may represent assigned lead values rather than sales. Budget capacity, seasonality and creative fatigue can change results.</p></details><details><summary>Success and stop criteria</summary><p>Compare the test with the unchanged target control using the same event and attribution window. Review revenue, ROAS, cost per conversion and verified lead or sale quality after conversion reporting settles. Do not expand based on clicks alone. Stop at the approved budget cap; do not expand if return fails to beat the target baseline. A small sample is inconclusive, not proof of failure or success.</p></details>${p.revenue!==null?(p.roi===null?'<p><a href="/admin/marketing-command-center#business-economics">Add your margin for secondary profit and ROI estimates.</a></p>':`<details><summary>Secondary profit and ROI estimate</summary><p>${p.margin}% supplied margin: ${esc(m(p.grossProfit))} gross profit before advertising, ${esc(m(p.grossProfit-p.budget))} after advertising, ${p.roi.toFixed(1)}% ROI.</p></details>`):""}<p><a href="${esc(s.href)}">Inspect source campaign →</a> · <a href="${esc(t.href)}">Inspect target campaign →</a></p><small>Review only. This recommendation does not create an ad, record approval or change spend.</small></section>`;
}
module.exports={campaignEvidence,adaptationScenario,adaptationRecommendations,renderAdaptation};
