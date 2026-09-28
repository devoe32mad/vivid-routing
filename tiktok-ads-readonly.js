"use strict";

const crypto=require("node:crypto");

const PATH="/admin/connectors/tiktok-ads";
const API_ROOT="https://business-api.tiktok.com/open_api/v1.3";

class TikTokAdsError extends Error {
  constructor(code,detail="") {
    super(code);
    this.code=code;
    this.detail=String(detail).slice(0,500);
  }
}

function configuration(env=process.env) {
  const key=Buffer.from(env.TIKTOK_ADS_TOKEN_KEY||"","base64");
  const redirect=new URL(env.TIKTOK_ADS_REDIRECT_URL||"");
  if(!/^\d{4,30}$/.test(env.TIKTOK_ADS_APP_ID||"")||!env.TIKTOK_ADS_APP_SECRET||key.length!==32||redirect.protocol!=="https:"||redirect.username||redirect.password||redirect.pathname!==PATH+"/callback"||redirect.search||redirect.hash)throw Error("Invalid TikTok Ads configuration");
  return{appId:env.TIKTOK_ADS_APP_ID,appSecret:env.TIKTOK_ADS_APP_SECRET,key,redirect:redirect.href};
}

const hash=value=>crypto.createHash("sha256").update(String(value)).digest("hex");
const id=value=>{const text=String(value??"");return/^\d{1,30}$/.test(text)&&text!=="0"?text:null;};

function seal(value,key,context) {
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
  cipher.setAAD(Buffer.from("tiktok:"+context));
  const body=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
  return[iv,cipher.getAuthTag(),body].map(part=>part.toString("base64")).join(".");
}

function unseal(value,key,context) {
  try {
    const parts=String(value).split(".");
    if(parts.length!==3)throw Error();
    const[iv,tag,body]=parts.map(part=>Buffer.from(part,"base64"));
    const cipher=crypto.createDecipheriv("aes-256-gcm",key,iv);
    cipher.setAAD(Buffer.from("tiktok:"+context));
    cipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([cipher.update(body),cipher.final()]).toString());
  } catch {
    throw new TikTokAdsError("authorization");
  }
}

const validDate=value=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
function importRange(input={}) {
  if(!validDate(input.from)||!validDate(input.to)||input.from>input.to||Date.parse(input.to)-Date.parse(input.from)>30*86400000)throw new TikTokAdsError("date_range");
  return{from:input.from,to:input.to};
}

const integer=value=>{const text=String(value??"0");if(!/^\d{1,19}$/.test(text)||BigInt(text)>9223372036854775807n)throw new TikTokAdsError("invalid_report","integer");return text;};
const decimal=value=>{const text=String(value??"0");if(!/^-?\d{1,38}(?:\.\d{1,18})?$/.test(text))throw new TikTokAdsError("invalid_report","decimal");return text.includes(".")?text.replace(/0+$/,"").replace(/\.$/,""):text;};
function moneyMicros(value) {
  const text=decimal(value);
  if(text.startsWith("-"))throw new TikTokAdsError("invalid_report","negative_spend");
  const[whole,fraction=""]=text.split(".");
  return integer((BigInt(whole)*1000000n+BigInt((fraction+"000000").slice(0,6))).toString());
}

function normalize(rows,account,period,campaigns=new Map()) {
  importRange(period);
  if(!Array.isArray(rows)||!account||!id(account.id)||!/^[A-Z]{3}$/.test(account.currency||""))throw new TikTokAdsError("invalid_report");
  const seen=new Set();
  return rows.map(row=>{
    const dimensions=row?.dimensions||{},metrics=row?.metrics||{},campaignId=id(dimensions.campaign_id),date=String(dimensions.stat_time_day||dimensions.stat_time_date||"").slice(0,10),key=`${date}:${campaignId}`;
    if(!campaignId||!validDate(date)||date<period.from||date>period.to||seen.has(key))throw new TikTokAdsError("invalid_report","dimensions");
    seen.add(key);
    const campaign=campaigns.get(campaignId)||{};
    return{
      date,
      campaign_id:campaignId,
      campaign_name:String(campaign.name||campaignId).slice(0,240),
      objective:String(campaign.objective||"TikTok campaign").slice(0,120),
      currency_code:account.currency,
      account_timezone:String(account.timezone||"UTC").slice(0,80),
      impressions:integer(metrics.impressions),
      clicks:integer(metrics.clicks),
      cost_micros:moneyMicros(metrics.spend),
      conversions:decimal(metrics.conversion),
      conversion_value:decimal(metrics.total_purchase_value??0),
      video_views:integer(metrics.video_play_actions),
      video_views_2s:integer(metrics.video_watched_2s),
      video_views_6s:integer(metrics.video_watched_6s),
      payload_hash:hash(JSON.stringify(row))
    };
  });
}

function createReader({config,fetcher=fetch}) {
  async function json(path,{token="",method="GET",query,body}={}) {
    const url=new URL(API_ROOT+path);
    if(query)for(const[key,value]of Object.entries(query))url.searchParams.set(key,Array.isArray(value)?JSON.stringify(value):String(value));
    const headers={Accept:"application/json"};
    if(token)headers["Access-Token"]=token;
    if(body!==undefined)headers["Content-Type"]="application/json";
    let response,data;
    try{response=await fetcher(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:"error",signal:AbortSignal.timeout(20000)});}catch{throw new TikTokAdsError("network");}
    try{data=await response.json();}catch{throw new TikTokAdsError("temporary");}
    const apiCode=Number(data?.code??0);
    if(!response.ok||apiCode!==0){const code=response.status===401||response.status===403||[40100,40001,40002].includes(apiCode)?"authorization":response.status===429||response.status>=500?"temporary":"tiktok_access";throw new TikTokAdsError(code,JSON.stringify({status:response.status,apiCode,message:String(data?.message||"").slice(0,280)}));}
    return data.data;
  }

  async function exchange(authCode) {
    if(typeof authCode!=="string"||!authCode||authCode.length>4096)throw new TikTokAdsError("authorization");
    const data=await json("/oauth2/access_token/",{method:"POST",body:{app_id:config.appId,secret:config.appSecret,auth_code:authCode}});
    if(typeof data?.access_token!=="string"||!data.access_token||!Array.isArray(data.advertiser_ids))throw new TikTokAdsError("authorization");
    const advertiserIds=[...new Set(data.advertiser_ids.map(id).filter(Boolean))];
    if(!advertiserIds.length||advertiserIds.length>1000)throw new TikTokAdsError("account");
    return{access_token:data.access_token,advertiser_ids:advertiserIds};
  }

  async function account(token,advertiserId) {
    advertiserId=id(advertiserId);
    if(!advertiserId)throw new TikTokAdsError("account");
    const data=await json("/advertiser/info/",{token,query:{advertiser_ids:[advertiserId],fields:["advertiser_id","name","currency","timezone"]}}),row=data?.list?.[0];
    if(id(row?.advertiser_id)!==advertiserId||!/^[A-Z]{3}$/.test(row?.currency||""))throw new TikTokAdsError("account");
    return{id:advertiserId,name:String(row.name||advertiserId).slice(0,240),currency:row.currency,timezone:String(row.timezone||"UTC")};
  }

  async function campaigns(token,account) {
    const found=new Map();
    for(let page=1;page<=100;page++){
      const data=await json("/campaign/get/",{token,query:{advertiser_id:account.id,fields:["campaign_id","campaign_name","objective_type"],page,page_size:1000}});
      if(!Array.isArray(data?.list)||found.size+data.list.length>100000)throw new TikTokAdsError("invalid_report","campaign_inventory");
      for(const row of data.list){const campaignId=id(row?.campaign_id);if(campaignId)found.set(campaignId,{name:String(row.campaign_name||campaignId).slice(0,240),objective:String(row.objective_type||"TikTok campaign").slice(0,120)});}
      const totalPages=Math.max(1,Number(data?.page_info?.total_page||1));if(page>=totalPages)break;
    }
    return found;
  }

  async function report(token,account,period) {
    period=importRange(period);
    const metrics=["spend","impressions","clicks","conversion","total_purchase_value","video_play_actions","video_watched_2s","video_watched_6s"];
    const all=[];
    for(let page=1;page<=100;page++){
      const data=await json("/report/integrated/get/",{token,query:{advertiser_id:account.id,report_type:"BASIC",data_level:"AUCTION_CAMPAIGN",dimensions:["campaign_id","stat_time_day"],metrics,start_date:period.from,end_date:period.to,page,page_size:1000}});
      if(!Array.isArray(data?.list)||all.length+data.list.length>50000)throw new TikTokAdsError("invalid_report");
      all.push(...data.list);
      const totalPages=Math.max(1,Number(data?.page_info?.total_page||1));
      if(page>=totalPages)break;
    }
    let inventory=new Map();try{inventory=await campaigns(token,account);}catch(error){if(error.code!=="tiktok_access")throw error;}
    return normalize(all,account,period,inventory);
  }

  return{exchange,account,campaigns,report};
}

module.exports={PATH,API_ROOT,TikTokAdsError,configuration,hash,id,seal,unseal,importRange,moneyMicros,normalize,createReader};
