'use strict';
const {AsyncLocalStorage}=require('node:async_hooks');
const context=new AsyncLocalStorage();
const paths=['/admin/marketing-command-center','/admin/archived-campaigns'];
const ids=values=>values.filter(Number.isSafeInteger).join(',')||'NULL';
function run(scope,next){return context.run(scope,next);}
function blockedWrite(sql){return Boolean(context.getStore()&&/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql));}
function sqlFor(sql){
 const s=context.getStore();if(!s||typeof sql!=='string'||!/^\s*(SELECT|WITH)\b/i.test(sql))return sql;
 const c=ids(s.campaignIds),q=ids(s.qrIds),l=ids(s.locationIds);
 const definitions={campaigns:`SELECT * FROM public.campaigns WHERE id IN (${c})`,qr_codes:`SELECT * FROM public.qr_codes WHERE id IN (${q})`,spaces:`SELECT * FROM public.spaces WHERE id IN (${l})`,events:`SELECT * FROM public.events WHERE campaign_id IN (${c}) AND qr_id IN (${q})`,qr_campaigns:`SELECT * FROM public.qr_campaigns WHERE campaign_id IN (${c}) AND qr_id IN (${q})`,campaign_schedules:`SELECT * FROM public.campaign_schedules WHERE campaign_id IN (${c}) AND qr_id IN (${q})`,campaign_destinations:`SELECT * FROM public.campaign_destinations WHERE campaign_id IN (${c})`,ai_campaign_plans:`SELECT * FROM public.ai_campaign_plans WHERE placement_id IN (${q})`,ai_campaign_drafts:`SELECT * FROM public.ai_campaign_drafts WHERE placement_id IN (${q})`};
 const selected=Object.entries(definitions).filter(([name])=>new RegExp('\\b(?:FROM|JOIN)\\s+'+name+'\\b','i').test(sql));if(!selected.length)return sql;
 const ctes=selected.map(([name,body])=>`${name} AS (${body})`).join(',');
 if(/^\s*WITH\s+RECURSIVE\b/i.test(sql))return sql.replace(/^(\s*WITH\s+RECURSIVE)\b/i,`$1 ${ctes},`);
 if(/^\s*WITH\b/i.test(sql))return sql.replace(/^(\s*WITH)\b/i,`$1 ${ctes},`);
 return `WITH ${ctes} ${sql}`;
}
function install(source){
 const planMarker='// RUBBER_WORLD_NATIVE_PLAN_PREVIEW_V1';
 if(!source.includes(planMarker)){
  const anchor='    const basicLockedRoutes=new Set([';
  if(source.split(anchor).length!==2)throw Error('Native demo plan preview anchor missing');
  source=source.replace(anchor,planMarker+'\n    if(req.rubberWorldReviewVerified&&["GET","HEAD"].includes(req.method)&&require("./rubber-world-native-navigation").paths.includes(requestPath))return next();\n'+anchor);
 }
 const marker='// RUBBER_WORLD_NATIVE_NAVIGATION_V1';if(source.includes(marker))return source;
 const anchor='async function q(sql, params = []) {';if(source.split(anchor).length!==2)throw Error('Native demo query anchor missing');
 return source.replace(anchor,anchor+'\n'+marker+'\n  if(require("./rubber-world-native-navigation").blockedWrite(sql))return {rows:[],rowCount:0};\n  sql=require("./rubber-world-native-navigation").sqlFor(sql);');
}
module.exports={paths,run,sqlFor,blockedWrite,install};
