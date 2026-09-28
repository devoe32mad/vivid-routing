"use strict";

const crypto=require("node:crypto");

const PATH="/admin/connectors/reddit-ads";
const API_ROOT="https://ads-api.reddit.com/api/v3";
const AUTH_URL="https://www.reddit.com/api/v1/authorize";
const TOKEN_URL="https://www.reddit.com/api/v1/access_token";
const SCOPES="adsread";

class RedditAdsError extends Error {
  constructor(code,detail=""){super(code);this.code=code;this.detail=String(detail).slice(0,500);}
}

function configuration(env=process.env){
  const clientId=String(env.REDDIT_ADS_CLIENT_ID||"").trim();
  const clientSecret=String(env.REDDIT_ADS_CLIENT_SECRET||"").trim();
  const key=Buffer.from(String(env.REDDIT_ADS_TOKEN_KEY||"").trim(),"base64");
  const redirect=new URL(String(env.REDDIT_ADS_REDIRECT_URL||"").trim());
  // Reddit-issued credentials are opaque. Validate their presence and reject
  // whitespace/control characters without assuming a legacy character set.
  if(clientId.length<5||clientId.length>256||/[\s\x00-\x1f\x7f]/.test(clientId)||!clientSecret||clientSecret.length>4096||/[\x00-\x1f\x7f]/.test(clientSecret)||key.length!==32||redirect.protocol!=="https:"||redirect.username||redirect.password||redirect.pathname!==PATH+"/callback"||redirect.search||redirect.hash)throw Error("Invalid Reddit Ads configuration");
  return{clientId,clientSecret,key,redirect:redirect.href};
}

const hash=value=>crypto.createHash("sha256").update(String(value)).digest("hex");
const id=value=>{const text=String(value??"");return/^[A-Za-z0-9_-]{1,100}$/.test(text)?text:null;};
function seal(value,key,context){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,iv);cipher.setAAD(Buffer.from("reddit:"+context));const body=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return[iv,cipher.getAuthTag(),body].map(v=>v.toString("base64")).join(".");}
function unseal(value,key,context){try{const parts=String(value).split(".");if(parts.length!==3)throw Error();const[iv,tag,body]=parts.map(v=>Buffer.from(v,"base64")),cipher=crypto.createDecipheriv("aes-256-gcm",key,iv);cipher.setAAD(Buffer.from("reddit:"+context));cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(body),cipher.final()]).toString());}catch{throw new RedditAdsError("authorization");}}

const validDate=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value).toISOString().slice(0,10)===value;
function importRange(input={}){if(!validDate(input.from)||!validDate(input.to)||input.from>input.to||Date.parse(input.to)-Date.parse(input.from)>30*86400000)throw new RedditAdsError("date_range");return{from:input.from,to:input.to};}
const integer=value=>{const text=String(value??"0");if(!/^\d{1,19}$/.test(text)||BigInt(text)>9223372036854775807n)throw new RedditAdsError("invalid_report","integer");return text;};
const decimal=value=>{const text=String(value??"0");if(!/^-?\d{1,38}(?:\.\d{1,18})?$/.test(text))throw new RedditAdsError("invalid_report","decimal");return text.includes(".")?text.replace(/0+$/,"").replace(/\.$/,""):text;};
const sum=(...values)=>values.reduce((total,value)=>total+Number(value||0),0);
const dateValue=value=>String(value||"").slice(0,10);

function normalize(rows,account,period){
  importRange(period);if(!Array.isArray(rows)||!id(account?.id)||!/^[A-Z]{3}$/.test(account?.currency||""))throw new RedditAdsError("invalid_report");
  const seen=new Set();return rows.map(row=>{
    const campaignId=id(row?.campaign_id),date=dateValue(row?.date),key=`${date}:${campaignId}`;
    if(!campaignId||!validDate(date)||date<period.from||date>period.to||seen.has(key))throw new RedditAdsError("invalid_report","dimensions");seen.add(key);
    return{date,campaign_id:campaignId,campaign_name:String(row.campaign_name||`Reddit campaign ${campaignId}`).slice(0,240),currency_code:account.currency,account_timezone:String(account.timezone||"UTC").slice(0,80),impressions:integer(row.impressions),clicks:integer(row.clicks),cost_micros:integer(row.spend),conversions:decimal(sum(row.conversion_purchase_clicks,row.conversion_purchase_views)),leads:decimal(sum(row.conversion_lead_clicks,row.conversion_lead_views,row.reddit_leads)),conversion_value:decimal(Number(row.conversion_purchase_total_value||0)/100),payload_hash:hash(JSON.stringify(row))};
  });
}

function createReader({config,fetcher=fetch}){
  async function request(url,{token="",method="GET",body,form=false,basic=false}={}){
    const headers={Accept:"application/json"};if(token)headers.Authorization=`Bearer ${token}`;if(basic)headers.Authorization=`Basic ${Buffer.from(config.clientId+":"+config.clientSecret).toString("base64")}`;
    let payload;if(body!==undefined){if(form){headers["Content-Type"]="application/x-www-form-urlencoded";payload=new URLSearchParams(body).toString();}else{headers["Content-Type"]="application/json";payload=JSON.stringify(body);}}
    let response,data;try{response=await fetcher(url,{method,headers,body:payload,redirect:"error",signal:AbortSignal.timeout(20000)});}catch{throw new RedditAdsError("network");}
    try{data=await response.json();}catch{throw new RedditAdsError("temporary");}
    if(!response.ok){const code=response.status===401||response.status===403?"authorization":response.status===429||response.status>=500?"temporary":"reddit_access";throw new RedditAdsError(code,JSON.stringify({status:response.status,message:data?.message||data?.error||""}));}return data;
  }
  async function exchange(code){if(typeof code!=="string"||!code||code.length>4096)throw new RedditAdsError("authorization");const data=await request(TOKEN_URL,{method:"POST",basic:true,form:true,body:{grant_type:"authorization_code",code,redirect_uri:config.redirect}});if(!data.access_token||!data.refresh_token)throw new RedditAdsError("authorization");return data;}
  async function refresh(token){if(!token?.refresh_token)throw new RedditAdsError("authorization");const data=await request(TOKEN_URL,{method:"POST",basic:true,form:true,body:{grant_type:"refresh_token",refresh_token:token.refresh_token}});if(!data.access_token)throw new RedditAdsError("authorization");return{...token,...data,refresh_token:data.refresh_token||token.refresh_token};}
  async function paged(path,{token,method="GET",body,collection=data=>data?.data}={}){const all=[];let url=new URL(API_ROOT+path);for(let page=0;page<100&&url;page++){const data=await request(url,{token,method,body}),rows=collection(data);if(!Array.isArray(rows))throw new RedditAdsError("invalid_report","collection");if(all.length+rows.length>100000)throw new RedditAdsError("invalid_report","limit");all.push(...rows);const next=data?.pagination?.next_url;url=next?new URL(next,API_ROOT):null;}return all;}
  async function accounts(token){const businesses=await paged("/me/businesses",{token}),all=[];for(const business of businesses){const businessId=id(business?.id);if(!businessId)continue;const rows=await paged(`/businesses/${encodeURIComponent(businessId)}/ad_accounts/query`,{token,method:"POST",body:{data:{}}});for(const row of rows){const accountId=id(row?.id);if(!accountId)continue;const currency=String(row.currency||row.currency_code||"").toUpperCase();if(!/^[A-Z]{3}$/.test(currency))continue;all.push({id:accountId,name:String(row.name||accountId).slice(0,240),currency,timezone:String(row.time_zone_id||row.timezone||"UTC").slice(0,80)});}}if(!all.length)throw new RedditAdsError("account");return[...new Map(all.map(a=>[a.id,a])).values()];}
  async function report(token,account,period){period=importRange(period);const fields=["CURRENCY","SPEND","IMPRESSIONS","CLICKS","CONVERSION_PURCHASE_CLICKS","CONVERSION_PURCHASE_VIEWS","CONVERSION_PURCHASE_TOTAL_VALUE","CONVERSION_LEAD_CLICKS","CONVERSION_LEAD_VIEWS","REDDIT_LEADS"];const rows=await paged(`/ad_accounts/${encodeURIComponent(account.id)}/reports`,{token,method:"POST",body:{data:{starts_at:period.from+"T00:00:00Z",ends_at:period.to+"T23:00:00Z",fields,breakdowns:["CAMPAIGN_ID","DATE"]}},collection:data=>data?.data?.metrics});return normalize(rows,account,period);}
  return{exchange,refresh,accounts,report};
}

module.exports={PATH,API_ROOT,AUTH_URL,TOKEN_URL,SCOPES,RedditAdsError,configuration,hash,id,seal,unseal,importRange,normalize,createReader};
