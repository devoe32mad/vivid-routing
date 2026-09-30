'use strict';
const {performanceCampaignScope}=require('./performance-campaign-scope');
function returnEstimate({value,spend,marginPct=null}){
 const validMargin=marginPct!==null&&marginPct!==undefined&&String(marginPct).trim()!==''&&Number.isFinite(Number(marginPct))&&Number(marginPct)>=0&&Number(marginPct)<=100;
 if(!Number.isFinite(value)||!Number.isFinite(spend)||spend<=0)return {roas:null,roi:null};
 return {roas:value/spend,roi:validMargin?100*(value*Number(marginPct)/100-spend)/spend:null};
}
async function loadRevenueEvidence({q,userId,range}){
 const row=(await q(`SELECT
   COALESCE(SUM(e.value) FILTER(WHERE NULLIF(to_jsonb(e)->>'square_payment_key','') IS NOT NULL),0)::text AS verified_sales,
   COUNT(*) FILTER(WHERE NULLIF(to_jsonb(e)->>'square_payment_key','') IS NOT NULL)::int AS verified_count,
   COUNT(*) FILTER(WHERE NULLIF(to_jsonb(e)->>'square_payment_key','') IS NULL)::int AS unverified_count,
   COALESCE(SUM(e.value) FILTER(WHERE NULLIF(to_jsonb(e)->>'square_payment_key','') IS NULL),0)::text AS other_value
 FROM events e JOIN campaigns c ON c.id=e.campaign_id
 WHERE e.type='conversion' AND ${performanceCampaignScope()}
 AND e.created_at >= $2::date AND e.created_at < ($3::date + INTERVAL '1 day')`,[userId,range.from,range.to])).rows[0];
 return {verifiedSales:Number(row?.verified_sales||0),verifiedCount:Number(row?.verified_count||0),unverifiedCount:Number(row?.unverified_count||0),otherValue:Number(row?.other_value||0)};
}
module.exports={returnEstimate,loadRevenueEvidence};
