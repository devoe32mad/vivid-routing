"use strict";

const{TikTokAdsError,id,seal,unseal,importRange}=require("./tiktok-ads-readonly");

const SCHEMA=`CREATE TABLE IF NOT EXISTS tiktok_ads_private_connections(
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES users(id),
  dashboard_user_id BIGINT REFERENCES users(id),
  account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  account_timezone TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  last_error TEXT NOT NULL DEFAULT '',
  last_synced_at TIMESTAMPTZ,
  last_from DATE,
  last_to DATE,
  next_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  sync_failures INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id,account_id)
);
CREATE TABLE IF NOT EXISTS tiktok_ads_private_states(
  state_hash TEXT PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS tiktok_ads_private_syncs(
  id BIGSERIAL PRIMARY KEY,
  connection_id BIGINT NOT NULL REFERENCES tiktok_ads_private_connections(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status TEXT NOT NULL,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  error_code TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tiktok_ads_private_daily(
  connection_id BIGINT NOT NULL REFERENCES tiktok_ads_private_connections(id) ON DELETE CASCADE,
  evidence_date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  objective TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  account_timezone TEXT NOT NULL,
  impressions BIGINT NOT NULL,
  clicks BIGINT NOT NULL,
  cost_micros BIGINT NOT NULL,
  conversions NUMERIC NOT NULL,
  conversion_value NUMERIC NOT NULL,
  video_views BIGINT NOT NULL,
  video_views_2s BIGINT NOT NULL,
  video_views_6s BIGINT NOT NULL,
  payload_hash TEXT NOT NULL,
  sync_id BIGINT NOT NULL REFERENCES tiktok_ads_private_syncs(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(connection_id,evidence_date,campaign_id)
);`;

const PUBLIC="id,dashboard_user_id,account_id,account_name,currency_code,account_timezone,status,last_error,last_synced_at,last_from::text,last_to::text,next_sync_at,last_attempt_at";

function createStore({pool,q,config,reader}) {
  let schema;
  const ready=()=>schema||(schema=q(SCHEMA).catch(error=>{schema=null;throw error;}));
  const context=(owner,account)=>`${owner}:${account}`;
  async function tx(fn){const client=await pool.connect();try{await client.query("BEGIN");const result=await fn(client);await client.query("COMMIT");return result;}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}
  async function locked(client,owner,connection){const row=(await client.query("SELECT * FROM tiktok_ads_private_connections WHERE id=$1 AND owner_user_id=$2 FOR UPDATE NOWAIT",[connection,owner])).rows[0];if(!row)throw new TikTokAdsError("not_found");return row;}

  return{
    ready,
    due:()=>q("SELECT id,owner_user_id FROM tiktok_ads_private_connections WHERE status='connected' AND next_sync_at<=NOW() ORDER BY next_sync_at,id LIMIT 10").then(result=>result.rows),
    list:owner=>q(`SELECT ${PUBLIC} FROM tiktok_ads_private_connections WHERE owner_user_id=$1 ORDER BY id`,[owner]).then(result=>result.rows),
    async assignDashboard(owner,target){return tx(async client=>{if(!(await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[target])).rows[0])throw new TikTokAdsError("not_found");const result=await client.query("UPDATE tiktok_ads_private_connections SET dashboard_user_id=$1,updated_at=NOW() WHERE owner_user_id=$2 RETURNING id,owner_user_id,dashboard_user_id",[target,owner]);if(!result.rows.length)throw new TikTokAdsError("not_found");return result.rows;});},
    async authorize(owner,pending,token,accounts){return tx(async client=>{
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[owner]);
      const target=Number.isSafeInteger(Number(pending.dashboardUserId))&&Number(pending.dashboardUserId)>0?Number(pending.dashboardUserId):owner;
      if(!(await client.query("SELECT id FROM users WHERE id=$1",[target])).rows[0])throw new TikTokAdsError("account");
      const state=await client.query("DELETE FROM tiktok_ads_private_states WHERE state_hash=$1 AND owner_user_id=$2 AND expires_at>NOW() RETURNING state_hash",[pending.hash,owner]);
      if(!state.rows.length)throw new TikTokAdsError("state");
      if(!Array.isArray(accounts)||!accounts.length||accounts.length>1000)throw new TikTokAdsError("account");
      const connectionIds=[];
      for(const account of accounts){const accountId=id(account.id);if(!accountId||!/^[A-Z]{3}$/.test(account.currency||""))throw new TikTokAdsError("account");const encrypted=seal(token,config.key,context(owner,accountId));const result=await client.query(`INSERT INTO tiktok_ads_private_connections(owner_user_id,dashboard_user_id,account_id,account_name,currency_code,account_timezone,token_ciphertext)
        VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(owner_user_id,account_id) DO UPDATE SET dashboard_user_id=EXCLUDED.dashboard_user_id,account_name=EXCLUDED.account_name,currency_code=EXCLUDED.currency_code,account_timezone=EXCLUDED.account_timezone,token_ciphertext=EXCLUDED.token_ciphertext,status='connected',last_error='',next_sync_at=NOW(),sync_failures=0,updated_at=NOW()
        RETURNING id`,[owner,target,accountId,String(account.name).slice(0,240),account.currency,String(account.timezone||"UTC").slice(0,80),encrypted]);connectionIds.push(result.rows[0].id);}
      return connectionIds;
    });},
    async disconnect(owner,connection){return tx(async client=>{await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[owner]);await locked(client,owner,connection);await client.query("DELETE FROM tiktok_ads_private_states WHERE owner_user_id=$1",[owner]);await client.query("DELETE FROM tiktok_ads_private_connections WHERE id=$1 AND owner_user_id=$2",[connection,owner]);});},
    async sync(owner,connection,period,{dueOnly=false}={}) {
      period=importRange(period);let failure="",detail="";
      const count=await tx(async client=>{
        const row=await locked(client,owner,connection);
        if(dueOnly&&Date.parse(row.next_sync_at)>Date.now())return null;
        let account,data;
        try {
          const token=unseal(row.token_ciphertext,config.key,context(owner,row.account_id));
          account=await reader.account(token.access_token,row.account_id);
          data=await reader.report(token.access_token,account,period);
        } catch(error) {
          failure=["authorization","temporary","network","tiktok_access","account","invalid_report"].includes(error.code)?error.code:"import_failed";detail=error.detail||"";
          await client.query("INSERT INTO tiktok_ads_private_syncs(connection_id,date_from,date_to,status,error_code,started_at) VALUES($1,$2,$3,'failed',$4,NOW())",[connection,period.from,period.to,failure]);
          await client.query(`UPDATE tiktok_ads_private_connections SET last_error=$1,status=CASE WHEN $4 THEN 'attention_required' ELSE status END,last_attempt_at=NOW(),sync_failures=LEAST(sync_failures+1,10),next_sync_at=NOW()+LEAST(360,5*POWER(2,LEAST(sync_failures,7)))*INTERVAL '1 minute' WHERE id=$2 AND owner_user_id=$3`,[failure,connection,owner,["authorization","tiktok_access","account"].includes(failure)]);
          return 0;
        }
        const syncId=(await client.query("INSERT INTO tiktok_ads_private_syncs(connection_id,date_from,date_to,status,rows_imported,started_at) VALUES($1,$2,$3,'succeeded',$4,NOW()) RETURNING id",[connection,period.from,period.to,data.length])).rows[0].id;
        await client.query("DELETE FROM tiktok_ads_private_daily WHERE connection_id=$1 AND evidence_date BETWEEN $2::date AND $3::date",[connection,period.from,period.to]);
        for(let offset=0;offset<data.length;offset+=1000)await client.query(`INSERT INTO tiktok_ads_private_daily
          SELECT $1,r.date::date,r.campaign_id,r.campaign_name,r.objective,r.currency_code,r.account_timezone,r.impressions::bigint,r.clicks::bigint,r.cost_micros::bigint,r.conversions,r.conversion_value,r.video_views::bigint,r.video_views_2s::bigint,r.video_views_6s::bigint,r.payload_hash,$3,NOW()
          FROM jsonb_to_recordset($2::jsonb) AS r(date text,campaign_id text,campaign_name text,objective text,currency_code text,account_timezone text,impressions text,clicks text,cost_micros text,conversions numeric,conversion_value numeric,video_views text,video_views_2s text,video_views_6s text,payload_hash text)`,[connection,JSON.stringify(data.slice(offset,offset+1000)),syncId]);
        await client.query(`UPDATE tiktok_ads_private_connections SET account_name=$1,currency_code=$2,account_timezone=$3,status='connected',last_error='',last_synced_at=NOW(),last_from=$4,last_to=$5,last_attempt_at=NOW(),sync_failures=0,next_sync_at=CASE WHEN $8 THEN NOW()+INTERVAL '1 hour' ELSE next_sync_at END,updated_at=NOW() WHERE id=$6 AND owner_user_id=$7`,[String(account.name).slice(0,240),account.currency,String(account.timezone||"UTC").slice(0,80),period.from,period.to,connection,owner,dueOnly]);
        return data.length;
      });
      if(failure)throw new TikTokAdsError(failure,detail);
      return count;
    }
  };
}

async function evidence(q,user,period,owner=false) {
  try {
    const column=owner?"owner_user_id":"dashboard_user_id";
    const connections=(await q(`SELECT ${PUBLIC} FROM tiktok_ads_private_connections WHERE ${column}=$1 ORDER BY id`,[user])).rows;
    const rows=(await q(`SELECT d.connection_id,d.campaign_id,(ARRAY_AGG(d.campaign_name ORDER BY d.evidence_date DESC))[1] campaign_name,(ARRAY_AGG(d.objective ORDER BY d.evidence_date DESC))[1] objective,d.currency_code,d.account_timezone,SUM(d.impressions)::text impressions,SUM(d.clicks)::text clicks,SUM(d.cost_micros)::text cost_micros,SUM(d.conversions)::text conversions,SUM(d.conversion_value)::text conversion_value,SUM(d.video_views)::text video_views,SUM(d.video_views_2s)::text video_views_2s,SUM(d.video_views_6s)::text video_views_6s,MAX(d.imported_at) imported_at
      FROM tiktok_ads_private_daily d JOIN tiktok_ads_private_connections c ON c.id=d.connection_id
      WHERE c.${column}=$1 AND d.evidence_date BETWEEN $2::date AND $3::date
      GROUP BY d.connection_id,d.campaign_id,d.currency_code,d.account_timezone ORDER BY d.connection_id,d.campaign_id`,[user,period.from,period.to])).rows;
    return{connections,rows,daily:[]};
  } catch(error) {
    if(error.code==="42P01"||error.code==="42703")return{connections:[],rows:[],daily:[]};
    throw error;
  }
}

const dashboardEvidence=(q,user,period)=>evidence(q,user,period,false);
const ownerEvidence=(q,user,period)=>evidence(q,user,period,true);

module.exports={SCHEMA,PUBLIC,createStore,dashboardEvidence,ownerEvidence};
