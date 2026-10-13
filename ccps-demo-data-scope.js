'use strict';
// A request-local read model: no source records or other customer sessions are changed.
const {AsyncLocalStorage}=require('node:async_hooks');
const context=new AsyncLocalStorage();
const contractIds='41,42,43';
const requests=`SELECT advertising_request_id FROM public.contracts WHERE organization_id=13 AND id IN (${contractIds})`;
const qrs=`SELECT created_qr_id FROM public.organization_advertising_requests WHERE organization_id=13 AND id IN (${requests})`;
const dental='Coastal Family Dental (Demo)';
const home='Gulf Coast Home Services (Demo)';
const definitions={
 ...require("./ccps-demo-opportunities").definitions,
 advertisers:`SELECT (jsonb_populate_record(NULL::public.advertisers,jsonb_build_object(
 'id',v.id,'organization_id',13,'name',v.name,'relationship_status','Active',
 'next_action','Review sponsorship results with school','is_active',true))).*
 FROM (VALUES (1300041,'${dental}'),(1300042,'${home}')) v(id,name)`,
 contracts:`SELECT (jsonb_populate_record(c,jsonb_build_object('advertiser_id',CASE WHEN c.id=42 THEN 1300042 ELSE 1300041 END))).* FROM public.contracts c WHERE organization_id=13 AND id IN (${contractIds})`,
 organization_advertising_requests:`SELECT (jsonb_populate_record(ar,jsonb_build_object(
 'business_name',CASE WHEN c.id=42 THEN '${home}' ELSE '${dental}' END,
 'contact_name','Sample sponsor contact',
 'email',CASE WHEN c.id=42 THEN 'home-services@example.com' ELSE 'family-dental@example.com' END))).*
 FROM public.organization_advertising_requests ar JOIN public.contracts c ON c.advertising_request_id=ar.id
 WHERE c.organization_id=13 AND c.id IN (${contractIds})`,
 qr_codes:`SELECT * FROM public.qr_codes WHERE id IN (${qrs})`,
 campaigns:`SELECT (jsonb_populate_record(c,jsonb_build_object(
 'advertiser',CASE WHEN c.id=69 THEN '${home}' ELSE '${dental}' END,
 'name',CASE WHEN c.id=69 THEN c.name ELSE 'Coastal Family Dental — School Sponsorship' END))).*
 FROM public.campaigns c WHERE user_id=10 AND id IN (SELECT campaign_id FROM public.qr_campaigns WHERE qr_id IN (${qrs}))`,
 events:`SELECT * FROM public.events WHERE qr_id IN (${qrs})`
};
function sqlFor(sql){
 if(!context.getStore()||typeof sql!=='string'||!/^\s*(SELECT|WITH)\b/i.test(sql))return sql;
 // Contract-only placements belong in sponsor placement counts even without a visible campaign.
 if(sql.includes('FROM contracts contract')&&sql.includes('filtered_relationships')){
  sql=sql.replace(/NULL::integer AS qr_id/g,`(SELECT ar.created_qr_id FROM public.organization_advertising_requests ar WHERE ar.id=contract.advertising_request_id) AS qr_id`);
 }
 const selected=Object.entries(definitions).filter(([name])=>new RegExp('\\b(?:FROM|JOIN)\\s+'+name+'\\b','i').test(sql));
 if(!selected.length)return sql;
 // CTE rows do not inherit the base table's primary-key functional dependency.
 // Aggregate the campaign record; every joined row within its ID has the same record.
 if(selected.some(([name])=>name==='campaigns')&&/\bc\.\*/i.test(sql)&&/\bFROM\s+campaigns\s+c\b/i.test(sql)){
  if(/\bGROUP BY c\.id(?=\s*(?:ORDER BY|HAVING|LIMIT|$))/i.test(sql))sql=sql.replace(/\bc\.\*/g,'((array_agg(c::public.campaigns))[1]).*');
 }
 if(sql.includes('AS advertiser_count'))sql=sql.replace(/TRIM\(ar\.email\)/g,'TRIM(ar.business_name)');
 const ctes=selected.map(([name,body])=>`${name} AS (${body})`).join(',\n');
 if(/^\s*WITH\s+RECURSIVE\b/i.test(sql))return sql.replace(/^(\s*WITH\s+RECURSIVE)\b/i,`$1 ${ctes},`);
 if(/^\s*WITH\b/i.test(sql))return sql.replace(/^(\s*WITH)\b/i,`$1 ${ctes},`);
 return `WITH ${ctes}\n${sql}`;
}
function run(enabled,callback){return context.run(Boolean(enabled),callback);}
function install(source){
 source=require("./ccps-demo-opportunities").install(source);
 const pipelineMarker='// CCPS_UNIQUE_PIPELINE_ADVERTISERS_V1';
 if(!source.includes(pipelineMarker)){
  const pipelineAnchor='const pipelineSummaryCards = [';
  if(source.split(pipelineAnchor).length!==2)throw Error('CCPS pipeline summary anchor missing');
  source=source.replace(pipelineAnchor,`
${pipelineMarker}
if(req.ccpsReviewVerified){
 const unique=await q(\`SELECT COUNT(DISTINCT LOWER(TRIM(business_name)))::int AS count
 FROM organization_advertising_requests WHERE organization_id=$1
 AND location_id=ANY($2::int[]) AND ($3::int IS NULL OR location_id=$3)
 AND LOWER(TRIM(status))='approved'\`,[organizationId,allowedLocationIds,selectedLocationId]);
 pipelineTotals.advertisers=Number(unique.rows[0]?.count||0);
}
`+pipelineAnchor);
 }
 const marker='// CCPS_DEMO_READ_MODEL_V1';if(source.includes(marker))return source;
 const anchor='async function q(sql, params = []) {';
 if(source.split(anchor).length!==2)throw Error('CCPS query scope anchor missing');
 return source.replace(anchor,anchor+'\n  '+marker+'\n  sql = require("./ccps-demo-data-scope").sqlFor(sql);');
}
module.exports={run,sqlFor,install,active:()=>Boolean(context.getStore())};
