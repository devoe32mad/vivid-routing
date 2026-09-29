"use strict";
const crypto=require("node:crypto");
const {dateRange}=require("./marketing-command-center");
const PATH="/admin/connectors/google-search-console";
const SCOPE="https://www.googleapis.com/auth/webmasters.readonly";
class ConnectorError extends Error{constructor(code){super(code);this.code=code;}}
const equal=(a,b)=>typeof a==="string"&&typeof b==="string"&&a.length>0&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const hash=value=>crypto.createHash("sha256").update(value).digest("hex");
function configuration(env){
  const key=Buffer.from(env.GOOGLE_SEARCH_CONSOLE_TOKEN_KEY||env.GOOGLE_ANALYTICS_TOKEN_KEY||env.GOOGLE_ADS_TOKEN_KEY||"","base64");let redirect;
  try{redirect=new URL(env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI);}catch{throw new ConnectorError("configuration");}
  if(key.length!==32||!env.GOOGLE_ADS_CLIENT_ID||!env.GOOGLE_ADS_CLIENT_SECRET||redirect.protocol!=="https:"||redirect.pathname!==PATH+"/callback"||redirect.search||redirect.hash)throw new ConnectorError("configuration");
  return {key,redirect:redirect.href,clientId:env.GOOGLE_ADS_CLIENT_ID,clientSecret:env.GOOGLE_ADS_CLIENT_SECRET};
}
function seal(value,key,context){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,iv);cipher.setAAD(Buffer.from("google-search-console-readonly:"+context));const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return [iv,cipher.getAuthTag(),data].map(v=>v.toString("base64")).join(".");}
function unseal(value,key,context){const [iv,tag,data]=value.split(".").map(v=>Buffer.from(v,"base64"));const cipher=crypto.createDecipheriv("aes-256-gcm",key,iv);cipher.setAAD(Buffer.from("google-search-console-readonly:"+context));cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(data),cipher.final()]).toString());}
function importRange(input){const range=dateRange(input);if(Date.parse(range.to)-Date.parse(range.from)>30*86400000)throw new ConnectorError("date_range");return range;}
function createReader({config,fetcher=fetch}){
  async function request(url,options,stage){let response;try{response=await fetcher(url,{...options,redirect:"error",signal:AbortSignal.timeout(20000)});}catch{throw new ConnectorError("network");}if(!response.ok){const e=new ConnectorError(response.status===401?"authorization":response.status===403?"google_access":response.status===429||response.status>=500?"temporary":"invalid_report");e.diagnostic={stage,httpStatus:response.status};throw e;}try{return await response.json();}catch{throw new ConnectorError("invalid_report");}}
  async function token(fields,exchange){const result=await request("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,...fields}).toString()},exchange?"oauth_exchange":"oauth_refresh");if(typeof result.access_token!=="string"||!(Number(result.expires_in)>0)||(exchange&&typeof result.refresh_token!=="string"))throw new ConnectorError("authorization");return {access_token:result.access_token,refresh_token:result.refresh_token||fields.refresh_token,expires_at:Date.now()+Number(result.expires_in)*1000};}
  async function query(accessToken,siteUrl,range,dimensions){const body=await request(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({startDate:range.from,endDate:range.to,type:"web",dataState:"final",dimensions,rowLimit:25000})},"report_read");return (body.rows||[]).map(row=>{const clicks=Number(row.clicks||0),impressions=Number(row.impressions||0),ctr=Number(row.ctr||0),position=Number(row.position||0);if([clicks,impressions,ctr,position].some(v=>!Number.isFinite(v)))throw new ConnectorError("invalid_report");return {keys:(row.keys||[]).map(String),clicks,impressions,ctr,position};});}
  return {exchange:code=>token({grant_type:"authorization_code",code,redirect_uri:config.redirect},true),refresh:refreshToken=>token({grant_type:"refresh_token",refresh_token:refreshToken},false),
    async sites(accessToken){const body=await request("https://www.googleapis.com/webmasters/v3/sites",{headers:{Authorization:"Bearer "+accessToken}},"site_discovery");return (body.siteEntry||[]).filter(s=>typeof s.siteUrl==="string"&&s.siteUrl.length<=500&&s.permissionLevel&&s.permissionLevel!=="siteUnverifiedUser").map(s=>({site_url:s.siteUrl,permission_level:String(s.permissionLevel).slice(0,80)}));},
    async report(accessToken,siteUrl,input){const range=importRange(input),summary=await query(accessToken,siteUrl,range,[]),queries=await query(accessToken,siteUrl,range,["query"]),pages=await query(accessToken,siteUrl,range,["page"]);return {summary:summary[0]||{clicks:0,impressions:0,ctr:0,position:0},queries:queries.map(r=>({...r,label:r.keys[0]||"(not available)"})),pages:pages.map(r=>({...r,label:r.keys[0]||"(not available)"}))};}
  };
}
module.exports={PATH,SCOPE,ConnectorError,equal,hash,configuration,seal,unseal,importRange,createReader};
