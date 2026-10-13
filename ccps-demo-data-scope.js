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
 const ctes=selected.map(([name,body])=>`${name} AS (${body})`).join(',\n');
 if(/^\s*WITH\s+RECURSIVE\b/i.test(sql))return sql.replace(/^(\s*WITH\s+RECURSIVE)\b/i,`$1 ${ctes},`);
 if(/^\s*WITH\b/i.test(sql))return sql.replace(/^(\s*WITH)\b/i,`$1 ${ctes},`);
 return `WITH ${ctes}\n${sql}`;
}
function run(enabled,callback){return context.run(Boolean(enabled),callback);}
function install(source){
 const marker='// CCPS_DEMO_READ_MODEL_V1';if(source.includes(marker))return source;
 const anchor='async function q(sql, params = []) {';
 if(source.split(anchor).length!==2)throw Error('CCPS query scope anchor missing');
 return source.replace(anchor,anchor+'\n  '+marker+'\n  sql = require("./ccps-demo-data-scope").sqlFor(sql);');
}
module.exports={run,sqlFor,install};
