'use strict';
const crypto=require('node:crypto');
// Eight base32 characters (40 random bits), without 0/O or 1/I. Keep issued legacy codes valid.
const ALPHABET='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE=/^(?:V-[2-9A-HJ-NP-Z]{8}|VIVID-(?:[A-F0-9]{4}-){3}[A-F0-9]{4})$/;
const normalizeCode=value=>typeof value==='string' && CODE.test(value.trim().toUpperCase()) ? value.trim().toUpperCase() : null;
const newCode=()=> 'V-'+Array.from(crypto.randomBytes(8),b=>ALPHABET[b & 31]).join('');

// Retain only redemption evidence, never arbitrary notes or card/customer details.
function orderEvidence(order,p){
  const notes=(order.line_items||[]).map(i=>i.note).filter(n=>typeof n==='string');
  const marked=notes.filter(n=>/VIVID-|\bV-/i.test(n));
  if(!marked.length)return null;
  const codes=[...new Set(marked.map(normalizeCode))];
  const code=codes.length===1 && codes[0] ? codes[0] : null;
  const tender=order.tenders?.length===1 ? order.tenders[0] : null;
  const sameMoney=m=>m?.currency==='USD' && Number.isSafeInteger(m.amount) && m.amount===p.total.amount;
  const eligible=Boolean(code && p.status==='COMPLETED' && p.total.currency==='USD' && p.total.amount>0 &&
    order.id===p.order_id && order.location_id===p.location_id && order.state==='COMPLETED' &&
    Number.isFinite(Date.parse(order.closed_at)) && sameMoney(order.total_money) &&
    tender?.type==='CARD' && tender.payment_id===p.id && tender.location_id===p.location_id && sameMoney(tender.amount_money));
  return {code,eligible,closed_at:eligible ? order.closed_at : null};
}

function createRedemptions({q,generateCode=newCode}){
  let schema;
  const ready=()=>schema || (schema=q(`
    CREATE TABLE IF NOT EXISTS square_instore_offers (
      customer_id BIGINT NOT NULL REFERENCES users(id),campaign_id BIGINT NOT NULL REFERENCES campaigns(id),
      merchant_id TEXT NOT NULL,location_id TEXT NOT NULL,location_name TEXT NOT NULL,
      name TEXT NOT NULL,terms TEXT NOT NULL,enabled BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(customer_id,campaign_id));
    CREATE TABLE IF NOT EXISTS square_instore_claims (
      code TEXT PRIMARY KEY,customer_id BIGINT NOT NULL REFERENCES users(id),merchant_id TEXT NOT NULL,
      campaign_id BIGINT NOT NULL REFERENCES campaigns(id),scan_id BIGINT NOT NULL,qr_id BIGINT NOT NULL,click_id TEXT NOT NULL,
      location_id TEXT NOT NULL,location_name TEXT NOT NULL,name TEXT NOT NULL,terms TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,
      approved_at TIMESTAMPTZ,approved_by BIGINT,checkout_until TIMESTAMPTZ,
      redeemed_at TIMESTAMPTZ,order_id TEXT,payment_id TEXT,
      UNIQUE(customer_id,merchant_id,campaign_id,click_id),
      UNIQUE(customer_id,merchant_id,order_id),UNIQUE(customer_id,merchant_id,payment_id),
      CHECK((approved_at IS NULL)=(checkout_until IS NULL)),
      CHECK((payment_id IS NULL)=(order_id IS NULL)),CHECK((payment_id IS NULL)=(redeemed_at IS NULL)));
    CREATE INDEX IF NOT EXISTS square_instore_claims_customer ON square_instore_claims(customer_id,merchant_id);
  `).catch(e=>{schema=null;throw e;}));

  const eligibleSQL=`SELECT o.*,e.id AS scan_id,e.qr_id,e.vivid_click_id AS click_id,e.created_at AS scanned_at,
    COUNT(*) OVER() AS scan_count FROM square_instore_offers o
    JOIN square_production_connections sc USING(customer_id,merchant_id)
    JOIN campaigns c ON c.id=o.campaign_id AND c.user_id=o.customer_id
    JOIN events e ON e.campaign_id=c.id
    WHERE o.customer_id=$1 AND o.campaign_id=$2 AND o.enabled AND NOT COALESCE(c.is_test,false)
      AND e.type='scan' AND e.qr_id IS NOT NULL AND e.vivid_click_id=$3
      AND e.created_at<=NOW() AND e.created_at>NOW()-INTERVAL '30 days'`;
  async function offer(id,campaign,click){
    await ready();const rows=(await q(eligibleSQL,[id,campaign,click])).rows;
    return rows.length===1 ? rows[0] : null;
  }
  async function issue(id,campaign,click){
    await ready();
    for(let attempt=0;attempt<5;attempt++){
      try{
    const result=await q(`WITH eligible AS (${eligibleSQL})
      INSERT INTO square_instore_claims(code,customer_id,merchant_id,campaign_id,scan_id,qr_id,click_id,
        location_id,location_name,name,terms,expires_at)
      SELECT $4,customer_id,merchant_id,campaign_id,scan_id,qr_id,click_id,location_id,location_name,name,terms,
        LEAST(NOW()+INTERVAL '7 days',scanned_at+INTERVAL '30 days') FROM eligible WHERE scan_count=1
      ON CONFLICT(customer_id,merchant_id,campaign_id,click_id) DO UPDATE SET code=square_instore_claims.code
      RETURNING *`,[id,campaign,click,generateCode()]);
    return result.rows[0]||null;
      }catch(error){
        // Never overwrite/recycle an issued code. Retry only a random-code PK collision.
        if(error.code!=='23505' || error.constraint!=='square_instore_claims_pkey')throw error;
      }
    }
    throw Error('Could not allocate a unique claim code; retry the claim.');
  }
  const usableSQL=`FROM square_instore_claims r
    JOIN square_production_connections sc USING(customer_id,merchant_id)
    JOIN campaigns c ON c.id=r.campaign_id AND c.user_id=r.customer_id
    JOIN events e ON e.id=r.scan_id AND e.campaign_id=r.campaign_id AND e.qr_id=r.qr_id AND e.vivid_click_id=r.click_id
    WHERE r.customer_id=$1 AND r.code=$2 AND r.location_id=$3 AND NOT COALESCE(c.is_test,false)
      AND e.type='scan' AND r.expires_at>NOW() AND r.payment_id IS NULL
      AND (r.checkout_until IS NULL OR r.checkout_until>NOW())`;
  async function lookup(id,code,location){
    await ready();if(!normalizeCode(code))return null;
    return (await q(`SELECT r.* ${usableSQL}`,[id,normalizeCode(code),location])).rows[0]||null;
  }
  async function approve(id,code,location,user){
    await ready();if(!normalizeCode(code))return null;
    // Repeated approval never extends the checkout window or makes a used code usable.
    return (await q(`WITH eligible AS (SELECT r.code ${usableSQL} FOR UPDATE OF r)
      UPDATE square_instore_claims r SET approved_at=COALESCE(r.approved_at,NOW()),
        approved_by=COALESCE(r.approved_by,$4),
        checkout_until=COALESCE(r.checkout_until,LEAST(r.expires_at,NOW()+INTERVAL '30 minutes'))
      FROM eligible x WHERE r.code=x.code RETURNING r.*`,[id,normalizeCode(code),location,user])).rows[0]||null;
  }
  async function reconcile(id,connection,lease){
    await ready();
    // One fenced statement consumes a code and assigns the ledger evidence together.
    // The current sync lease serializes jobs; a code remains bound to its first paid order forever.
    const result=await q(`WITH fence AS MATERIALIZED (
      SELECT c.customer_id,c.merchant_id FROM square_production_connections c
      JOIN square_production_sync s USING(customer_id)
      WHERE c.customer_id=$1 AND c.merchant_id=$2 AND c.token_ciphertext=$3 AND s.lease=$4 AND s.lease_until>NOW()
      FOR UPDATE OF c,s
    ), candidates AS MATERIALIZED (
      SELECT r.code,l.payment_id,l.payment->>'order_id' AS order_id,
        (l.payment->>'created_at')::timestamptz AS paid_at,
        jsonb_build_object('method','in_store_code','code',r.code,'scan_id',e.id,'qr_id',e.qr_id,
          'campaign_id',e.campaign_id,'click_id',e.vivid_click_id,'name',c.name) AS evidence,
        COUNT(*) OVER(PARTITION BY r.code) AS contenders
      FROM square_production_ledger l JOIN fence f USING(customer_id,merchant_id)
      JOIN square_instore_claims r ON r.customer_id=l.customer_id AND r.merchant_id=l.merchant_id
        AND r.code=l.payment->'instore'->>'code' AND r.location_id=l.payment->>'location_id'
      JOIN campaigns c ON c.id=r.campaign_id AND c.user_id=r.customer_id AND NOT COALESCE(c.is_test,false)
      JOIN events e ON e.id=r.scan_id AND e.campaign_id=r.campaign_id AND e.qr_id=r.qr_id AND e.vivid_click_id=r.click_id
      WHERE e.type='scan' AND l.payment->'instore'->>'eligible'='true'
        AND l.payment->>'status'='COMPLETED' AND l.payment->'total'->>'currency'='USD'
        AND COALESCE(l.payment->>'reference','')='' AND COALESCE(l.payment->>'order_reference','')=''
        AND r.approved_at IS NOT NULL AND r.created_at<=r.approved_at
        AND (l.payment->>'created_at')::timestamptz BETWEEN r.approved_at AND r.checkout_until
        AND (l.payment->'instore'->>'closed_at')::timestamptz BETWEEN r.approved_at AND r.checkout_until
        AND e.created_at<=(l.payment->>'created_at')::timestamptz
        AND e.created_at>=(l.payment->>'created_at')::timestamptz-INTERVAL '30 days'
        AND (r.payment_id IS NULL OR (r.payment_id=l.payment_id AND r.order_id=l.payment->>'order_id'))
    ), claimed AS (
      UPDATE square_instore_claims r SET payment_id=x.payment_id,order_id=x.order_id,
        redeemed_at=COALESCE(r.redeemed_at,x.paid_at)
      FROM candidates x WHERE r.code=x.code AND x.contenders=1
        AND (r.payment_id IS NULL OR r.payment_id=x.payment_id)
      RETURNING r.code,r.payment_id
    ), evidence AS MATERIALIZED (
      SELECT x.* FROM candidates x JOIN claimed c USING(code,payment_id) WHERE x.contenders=1
    ), written AS (
      UPDATE square_production_ledger l SET payment=jsonb_set(l.payment,'{match}',x.evidence)
      FROM fence f JOIN evidence x ON true
      WHERE l.customer_id=f.customer_id AND l.merchant_id=f.merchant_id AND l.payment_id=x.payment_id
      RETURNING l.payment_id
    ), invalidated AS (
      UPDATE square_production_ledger l SET payment=l.payment-'match'
      FROM fence f WHERE l.customer_id=f.customer_id AND l.merchant_id=f.merchant_id
        AND l.payment->'match'->>'method'='in_store_code'
        AND NOT EXISTS(SELECT 1 FROM evidence x WHERE x.payment_id=l.payment_id)
      RETURNING l.payment_id
    ) SELECT COUNT(*)::int AS fenced FROM fence`,[id,connection.row.merchant_id,connection.row.token_ciphertext,lease]);
    if(!result.rows[0]?.fenced)throw Error('Connection or lease changed before redemption reconciliation');
  }
  return {ready,offer,issue,lookup,approve,reconcile};
}
module.exports={createRedemptions,normalizeCode,newCode,orderEvidence};
