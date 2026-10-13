'use strict';
// A request-local read model: no source records or other customer sessions are changed.
const {AsyncLocalStorage}=require('node:async_hooks');
const context=new AsyncLocalStorage();
const contractIds='41,42,43';
const requests=`SELECT advertising_request_id FROM public.contracts WHERE organization_id=13 AND id IN (${contractIds})`;
const qrs=`SELECT created_qr_id FROM public.organization_advertising_requests WHERE organization_id=13 AND id IN (${requests})`;
const definitions={
 contracts:`SELECT * FROM public.contracts WHERE organization_id=13 AND id IN (${contractIds})`,
 organization_advertising_requests:`SELECT * FROM public.organization_advertising_requests WHERE organization_id=13 AND id IN (${requests})`,
 qr_codes:`SELECT * FROM public.qr_codes WHERE id IN (${qrs})`,
 campaigns:`SELECT * FROM public.campaigns WHERE user_id=10 AND id IN (SELECT campaign_id FROM public.qr_campaigns WHERE qr_id IN (${qrs}))`,
 events:`SELECT * FROM public.events WHERE qr_id IN (${qrs})`
};
function sqlFor(sql){
 if(!context.getStore()||typeof sql!=='string'||!/^\s*(SELECT|WITH)\b/i.test(sql))return sql;
 const selected=Object.entries(definitions).filter(([name])=>new RegExp('\\b(?:FROM|JOIN)\\s+'+name+'\\b','i').test(sql));
 if(!selected.length)return sql;
 if(sql.includes('AS advertiser_count'))sql=sql.replace(/TRIM\(ar\.email\)/g,'TRIM(ar.business_name)');
 const ctes=selected.map(([name,body])=>`${name} AS (${body})`).join(',\n');
 if(/^\s*WITH\s+RECURSIVE\b/i.test(sql))return sql.replace(/^(\s*WITH\s+RECURSIVE)\b/i,`$1 ${ctes},`);
 if(/^\s*WITH\b/i.test(sql))return sql.replace(/^(\s*WITH)\b/i,`$1 ${ctes},`);
 return `WITH ${ctes}\n${sql}`;
}
function run(enabled,callback){return context.run(Boolean(enabled),callback);}
function install(source){
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
