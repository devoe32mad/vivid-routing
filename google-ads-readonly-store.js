"use strict";
const {seal,unseal,ConnectorError,importRange} = require("./google-ads-readonly");
const SCHEMA = `
CREATE TABLE IF NOT EXISTS google_ads_private_connections (
  id BIGSERIAL PRIMARY KEY, owner_user_id BIGINT NOT NULL REFERENCES users(id),
  customer_id TEXT NOT NULL, manager_id TEXT NOT NULL DEFAULT '', account_name TEXT NOT NULL,
  currency_code TEXT NOT NULL, account_timezone TEXT NOT NULL, token_ciphertext TEXT,
  status TEXT NOT NULL CHECK(status IN ('connected','attention_required','disconnected')),
  last_error TEXT NOT NULL DEFAULT '', last_synced_at TIMESTAMPTZ, last_from DATE, last_to DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(owner_user_id,customer_id));
CREATE TABLE IF NOT EXISTS google_ads_private_states (
  state_hash TEXT PRIMARY KEY, owner_user_id BIGINT NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS google_ads_private_syncs (
  id BIGSERIAL PRIMARY KEY, connection_id BIGINT NOT NULL REFERENCES google_ads_private_connections(id) ON DELETE CASCADE,
  date_from DATE NOT NULL, date_to DATE NOT NULL, status TEXT NOT NULL,
  rows_imported INTEGER NOT NULL DEFAULT 0, error_code TEXT NOT NULL DEFAULT '',
  api_version TEXT NOT NULL, started_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS google_ads_private_daily (
  connection_id BIGINT NOT NULL REFERENCES google_ads_private_connections(id) ON DELETE CASCADE,
  evidence_date DATE NOT NULL, campaign_id TEXT NOT NULL, campaign_name TEXT NOT NULL,
  campaign_status TEXT NOT NULL, channel TEXT NOT NULL, currency_code TEXT NOT NULL,
  account_timezone TEXT NOT NULL, impressions BIGINT NOT NULL, clicks BIGINT NOT NULL,
  cost_micros BIGINT NOT NULL, conversions NUMERIC NOT NULL, conversion_value NUMERIC NOT NULL,
  payload_hash TEXT NOT NULL, sync_id BIGINT NOT NULL REFERENCES google_ads_private_syncs(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(connection_id,evidence_date,campaign_id));
CREATE INDEX IF NOT EXISTS google_ads_private_daily_date_idx ON google_ads_private_daily(connection_id,evidence_date);
ALTER TABLE google_ads_private_connections ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE google_ads_private_connections ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE google_ads_private_connections ADD COLUMN IF NOT EXISTS sync_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE google_ads_private_connections ADD COLUMN IF NOT EXISTS last_auto_synced_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS google_ads_private_connections_due_idx ON google_ads_private_connections(next_sync_at) WHERE status='connected';`;
const PUBLIC_COLUMNS = "id,customer_id,account_name,currency_code,account_timezone,status,last_error,last_synced_at,last_from::text,last_to::text,next_sync_at,last_attempt_at,last_auto_synced_at";
const SAFE_ERRORS = new Set(["authorization","temporary","network","google_access","account","invalid_report","report_too_large","oauth_client","oauth_redirect","customer_signup","customer_missing","customer_inactive","account_permission","manager_invalid","project_access","api_disabled","oauth_scope"]);
const RECONNECT_ERRORS = new Set(["authorization","oauth_scope","account_permission","customer_missing","manager_invalid"]);
function createStore({pool,q,config,reader}) {
  let schema;
  const ready = () => schema || (schema = q(SCHEMA).catch(error => {schema = undefined; throw error;}));
  const context = (userId,id) => `${userId}:${id}`;
  async function transaction(fn) {
    const client = await pool.connect();
    try { await client.query("BEGIN"); const result = await fn(client); await client.query("COMMIT"); return result; }
    catch(error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async function locked(client,userId,id) {
    const row = (await client.query("SELECT * FROM google_ads_private_connections WHERE id=$1 AND owner_user_id=$2 FOR UPDATE NOWAIT",[id,userId])).rows[0];
    if (!row) throw new ConnectorError("not_found");
    return row;
  }
  return {
    ready,
    due: () => q(`SELECT id,owner_user_id,account_timezone FROM google_ads_private_connections
      WHERE status='connected' AND token_ciphertext IS NOT NULL AND next_sync_at<=NOW()
      ORDER BY next_sync_at,id LIMIT 10`).then(r=>r.rows),
    list: userId => q(`SELECT ${PUBLIC_COLUMNS} FROM google_ads_private_connections WHERE owner_user_id=$1 ORDER BY id`,[userId]).then(r=>r.rows),
    async authorize(userId,pending,token,account) {
      // Serialize against disconnect for this owner. Pending state is consumed in
      // this transaction so concurrent callbacks cannot reuse it or reconnect after disconnect.
      return transaction(async client => {
        await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[userId]);
        const state = await client.query("DELETE FROM google_ads_private_states WHERE state_hash=$1 AND owner_user_id=$2 AND expires_at>NOW() RETURNING state_hash",[pending.hash,userId]);
        if (!state.rows.length) throw new ConnectorError("state");
        const row = (await client.query(`INSERT INTO google_ads_private_connections
          (owner_user_id,customer_id,manager_id,account_name,currency_code,account_timezone,token_ciphertext,status)
          VALUES($1,$2,$3,$4,$5,$6,$7,'connected') ON CONFLICT(owner_user_id,customer_id) DO UPDATE SET
          manager_id=EXCLUDED.manager_id,account_name=EXCLUDED.account_name,currency_code=EXCLUDED.currency_code,
          account_timezone=EXCLUDED.account_timezone,token_ciphertext=EXCLUDED.token_ciphertext,status='connected',last_error='',updated_at=NOW(),next_sync_at=NOW(),sync_failures=0
          RETURNING id`,[userId,pending.customerId,pending.managerId,String(account.descriptiveName || pending.customerId).slice(0,240),
          account.currencyCode,account.timeZone,seal(token,config.key,context(userId,pending.customerId))])).rows[0];
        return row.id;
      });
    },
    async disconnect(userId,id) {
      await transaction(async client => {
        await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[userId]);
        await locked(client,userId,id);
        await client.query("DELETE FROM google_ads_private_states WHERE owner_user_id=$1",[userId]);
        await client.query("DELETE FROM google_ads_private_connections WHERE id=$1 AND owner_user_id=$2",[id,userId]);
      });
    },
    async sync(userId,id,range,{dueOnly=false}={}) {
      range = importRange(range);
      let failure;
      const count = await transaction(async client => {
        const row = await locked(client,userId,id);
        // Recheck after taking the database lock: another process may already
        // have completed this account since the due list was read.
        if(dueOnly && (row.status !== 'connected' || Date.parse(row.next_sync_at)>Date.now())) return null;
        if (!row.token_ciphertext || row.status === "disconnected") throw new ConnectorError("authorization");
        const started = new Date();
        let data, account;
        try {
          let token = unseal(row.token_ciphertext,config.key,context(userId,row.customer_id));
          if (token.expires_at < Date.now()+60000) token = await reader.refresh(token.refresh_token);
          account = await reader.account(token.access_token,row.customer_id,row.manager_id);
          data = await reader.report(token.access_token,row.customer_id,row.manager_id,account,range);
          await client.query("UPDATE google_ads_private_connections SET token_ciphertext=$1 WHERE id=$2 AND owner_user_id=$3",
            [seal(token,config.key,context(userId,row.customer_id)),id,userId]);
        } catch(error) {
          failure = SAFE_ERRORS.has(error.code) ? error.code : "import_failed";
          await client.query(`INSERT INTO google_ads_private_syncs(connection_id,date_from,date_to,status,error_code,api_version,started_at)
            VALUES($1,$2,$3,'failed',$4,$5,$6)`,[id,range.from,range.to,failure,config.version,started]);
          await client.query(`UPDATE google_ads_private_connections SET last_error=$1,
            status=CASE WHEN $4::boolean THEN 'attention_required' ELSE status END,
            last_attempt_at=NOW(),sync_failures=LEAST(sync_failures+1,10),
            next_sync_at=NOW()+LEAST(360,5*POWER(2,LEAST(sync_failures,7)))*INTERVAL '1 minute'
            WHERE id=$2 AND owner_user_id=$3`,[failure,id,userId,RECONNECT_ERRORS.has(failure)]);
          return 0;
        }
        const syncId = (await client.query(`INSERT INTO google_ads_private_syncs(connection_id,date_from,date_to,status,rows_imported,api_version,started_at)
          VALUES($1,$2,$3,'succeeded',$4,$5,$6) RETURNING id`,[id,range.from,range.to,data.length,config.version,started])).rows[0].id;
        // Replace the entire requested window atomically. This handles retries,
        // restated conversions, and rows that disappear from Google's result set.
        await client.query("DELETE FROM google_ads_private_daily WHERE connection_id=$1 AND evidence_date BETWEEN $2::date AND $3::date",[id,range.from,range.to]);
        for(let start=0;start<data.length;start+=1000) {
          await client.query(`INSERT INTO google_ads_private_daily
            (connection_id,evidence_date,campaign_id,campaign_name,campaign_status,channel,currency_code,account_timezone,
             impressions,clicks,cost_micros,conversions,conversion_value,payload_hash,sync_id)
            SELECT $1,r.date::date,r.campaign_id,r.campaign_name,r.campaign_status,r.channel,r.currency_code,r.account_timezone,
              r.impressions::bigint,r.clicks::bigint,r.cost_micros::bigint,r.conversions,r.conversion_value,r.payload_hash,$3
            FROM jsonb_to_recordset($2::jsonb) AS r(date text,campaign_id text,campaign_name text,campaign_status text,channel text,
              currency_code text,account_timezone text,impressions text,clicks text,cost_micros text,conversions numeric,conversion_value numeric,payload_hash text)`,
          [id,JSON.stringify(data.slice(start,start+1000)),syncId]);
        }
        await client.query(`UPDATE google_ads_private_connections SET status='connected',last_error='',last_synced_at=NOW(),last_from=$1,last_to=$2,
          currency_code=$3,account_timezone=$4,account_name=$5,updated_at=NOW(),last_attempt_at=NOW(),sync_failures=0,
          next_sync_at=CASE WHEN $8::boolean THEN NOW()+INTERVAL '1 hour' ELSE next_sync_at END,
          last_auto_synced_at=CASE WHEN $8::boolean THEN NOW() ELSE last_auto_synced_at END
          WHERE id=$6 AND owner_user_id=$7`,
        [range.from,range.to,account.currencyCode,account.timeZone,String(account.descriptiveName || row.customer_id).slice(0,240),id,userId,dueOnly]);
        return data.length;
      });
      if (failure) throw new ConnectorError(failure);
      return count;
    }
  };
}
async function dashboardEvidence(q,userId,range) {
  try {
    const connections = (await q(`SELECT ${PUBLIC_COLUMNS} FROM google_ads_private_connections WHERE owner_user_id=$1 ORDER BY id`,[userId])).rows;
    const rows = (await q(`SELECT d.connection_id,d.campaign_id,(ARRAY_AGG(d.campaign_name ORDER BY d.evidence_date DESC))[1] campaign_name,d.channel,d.currency_code,d.account_timezone,
        (ARRAY_AGG(d.campaign_status ORDER BY d.evidence_date DESC))[1] campaign_status,
        SUM(d.impressions)::text impressions,SUM(d.clicks)::text clicks,SUM(d.cost_micros)::text cost_micros,
        SUM(d.conversions)::text conversions,SUM(d.conversion_value)::text conversion_value,MAX(d.imported_at) imported_at
      FROM google_ads_private_daily d JOIN google_ads_private_connections c ON c.id=d.connection_id
      WHERE c.owner_user_id=$1 AND d.evidence_date BETWEEN $2::date AND $3::date
      GROUP BY d.connection_id,d.campaign_id,d.channel,d.currency_code,d.account_timezone
      ORDER BY d.connection_id,d.campaign_id`,[userId,range.from,range.to])).rows;
    const daily = (await q(`SELECT d.connection_id,d.evidence_date::text date,d.campaign_id,d.campaign_name,d.channel,
      d.currency_code,d.impressions::text,d.clicks::text,d.cost_micros::text,d.conversions::text,d.conversion_value::text
      FROM google_ads_private_daily d JOIN google_ads_private_connections c ON c.id=d.connection_id
      WHERE c.owner_user_id=$1 AND d.evidence_date BETWEEN $2::date AND $3::date
      ORDER BY d.evidence_date,d.connection_id,d.campaign_id`,[userId,range.from,range.to])).rows;
    return {connections,rows,daily};
  } catch(error) { if(error.code === "42P01") return {connections:[],rows:[],daily:[]}; throw error; }
}
module.exports = {SCHEMA,createStore,dashboardEvidence,PUBLIC_COLUMNS};
