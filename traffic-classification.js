"use strict";
const normalized=value=>String(value||'').trim().toLowerCase();
const aiDomains=['chatgpt.com','chat.openai.com','perplexity.ai','claude.ai','copilot.microsoft.com','gemini.google.com','bard.google.com','you.com','phind.com'];
function aiSource(value){
 const source=normalized(value).replace(/^https?:\/\//,'').split('/')[0].replace(/\.$/,'');
 return aiDomains.some(domain=>source===domain||source.endsWith('.'+domain));
}
const paidMedium=value=>/(^|[-_\s])(paid|cpc|ppc|cpm|display|affiliate)([-_\s]|$)/.test(normalized(value));
function isAiTraffic(row){
 if(paidMedium(row.medium))return false;
 // User-hosted Sites are referral websites, not AI assistants.
 if(/(^|\.)chatgpt\.site(?:\/|$)/.test(normalized(row.source)))return false;
 return normalized(row.medium)==='ai-assistant'||aiSource(row.source);
}
const organicMedium=value=>['organic','organic_social','organic-social','social','referral'].includes(normalized(value));
const isUnpaidTraffic=row=>organicMedium(row.medium)&&!isAiTraffic(row);
module.exports={aiSource,organicMedium,isAiTraffic,isUnpaidTraffic};
