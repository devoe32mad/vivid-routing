"use strict";

// Scenario assumptions, not a statistical forecast or promised incremental lift.
function conservativeProjection({spend,clicks,conversions,revenue,budget,marginPct=null}) {
  if (![spend,clicks,conversions,revenue,budget].every(v=>Number.isFinite(v)&&v>0)) return null;
  const projectedConversions=budget/(spend/clicks*1.15)*(conversions/clicks*0.70);
  const projectedRevenue=projectedConversions*(revenue/conversions);
  const hasMargin=marginPct!==null&&marginPct!==undefined&&String(marginPct).trim()!==""&&Number.isFinite(Number(marginPct))&&Number(marginPct)>=0&&Number(marginPct)<=100;
  const grossProfit=hasMargin?projectedRevenue*Number(marginPct)/100:null;
  return {budget,projectedRevenue,projectedConversions,roas:projectedRevenue/budget,grossProfit,roi:hasMargin?100*(grossProfit-budget)/budget:null,marginPct:hasMargin?Number(marginPct):null};
}
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
function renderProjection(p) {
  if(!p)return "";
  const money=v=>`${v.toLocaleString("en-US",{maximumFractionDigits:0})} ${esc(p.currency)}`;
  return `<section class="revenue-projection"><h4>Conservative revenue projection</h4><p>Revenue scenario only: confirm reported conversion values represent sales, not assigned lead values.</p><p><strong>${money(p.projectedRevenue)} projected platform-attributed revenue</strong><br>${p.roas.toFixed(2)}× projected ROAS · approximately ${p.projectedConversions.toFixed(1)} platform-reported conversions</p><p>Proposed test: move ${money(p.budget)} from ${esc(p.fromCampaign)} to ${esc(p.toCampaign)}. Projection confidence: ${esc(p.confidence)}.</p><details><summary>How we calculated this</summary><p>Baseline: ${esc(p.period)}. ${money(p.baselineSpend)} spend, ${esc(p.baselineClicks)} clicks, ${esc(p.baselineConversions)} reported conversions and ${money(p.baselineRevenue)} platform-reported value for ${esc(p.toCampaign)}.</p><p>We reduce the observed conversion rate by 30%, increase cost per click by 15%, and keep observed value per conversion unchanged. Test budget is 10% of the smaller campaign’s spend in this period. The projection applies only to this proposed budget.</p><p>Platform value may include assigned lead values rather than sales. Confirm revenue tracking, matching objectives and attribution settings before approving. This is a scenario, not verified sales, a guarantee or incremental revenue; it excludes revenue forgone in the source campaign.</p></details>${p.roi===null?'<p><a href="/admin/marketing-command-center#business-economics">Add your margin to see estimated profit and ROI.</a></p>':`<details><summary>Estimated profit and ROI</summary><p>Using your ${p.marginPct}% margin: ${money(p.grossProfit)} projected gross profit before advertising; ${money(p.grossProfit-p.budget)} after advertising; ${p.roi.toFixed(1)}% projected ROI. These are estimates based on platform-attributed value.</p></details>`}<p><a href="${esc(p.evidenceHref)}">Review campaigns before approving a test →</a></p></section>`;
}
module.exports={conservativeProjection,renderProjection};
