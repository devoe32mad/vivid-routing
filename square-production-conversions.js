'use strict';
// Project verified USD sales into the same events consumed by Vivid reports.
// The provider key identifies the payment, never a sync attempt or return-page visit.
function createConversions({q}) {
  let schema;
  const ready=()=>schema || (schema=q(`
    ALTER TABLE events ADD COLUMN IF NOT EXISTS square_payment_key TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS events_square_payment_key ON events(square_payment_key);
    CREATE OR REPLACE FUNCTION vivid_square_conversion_guard() RETURNS trigger AS $$
    BEGIN
      IF NEW.type='conversion' AND NEW.vivid_click_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(NEW.campaign_id::text || ':' || NEW.vivid_click_id,0));
        IF NEW.square_payment_key IS NULL AND EXISTS (
          SELECT 1 FROM events e WHERE e.square_payment_key IS NOT NULL AND e.type='conversion'
          AND e.campaign_id=NEW.campaign_id AND e.vivid_click_id=NEW.vivid_click_id
          AND e.campaign_destination_id IS NOT DISTINCT FROM NEW.campaign_destination_id
        ) THEN NEW.type='square_superseded_conversion'; END IF;
        IF NEW.square_payment_key IS NOT NULL THEN
          UPDATE events e SET type='square_superseded_conversion'
          WHERE e.type='conversion' AND e.square_payment_key IS NULL
            AND e.campaign_id=NEW.campaign_id AND e.vivid_click_id=NEW.vivid_click_id
            AND e.campaign_destination_id IS NOT DISTINCT FROM NEW.campaign_destination_id;
        END IF;
      END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS vivid_square_conversion_guard ON events;
    CREATE TRIGGER vivid_square_conversion_guard BEFORE INSERT ON events
      FOR EACH ROW EXECUTE FUNCTION vivid_square_conversion_guard();
  `).catch(e=>{schema=null;throw e;}));

  async function reconcile(id,connection,lease) {
    await ready();
    // Connection/lease fencing also prevents an old merchant job from publishing events.
    // Re-read all retained records so already-imported payments are backfilled on upgrade.
    const result=await q(`WITH fence AS MATERIALIZED (
      SELECT c.customer_id,c.merchant_id FROM square_production_connections c
      JOIN square_production_sync s USING(customer_id)
      WHERE c.customer_id=$1 AND c.merchant_id=$2 AND c.token_ciphertext=$3
        AND s.lease=$4 AND s.lease_until>NOW() FOR UPDATE OF c,s
    ), candidates AS MATERIALIZED (
      SELECT jsonb_build_array(l.customer_id,l.merchant_id,l.payment_id)::text AS payment_key,
        e.id AS scan_id,e.qr_id,e.campaign_id,e.store_id,e.vivid_session_id,e.vivid_click_id,
        (l.payment->>'created_at')::timestamptz AS paid_at,
        ((l.payment->'total'->>'amount')::numeric - COALESCE((
          SELECT SUM((r->'amount'->>'amount')::numeric)
          FROM jsonb_array_elements(l.refunds) r
          WHERE r->>'status'='COMPLETED' AND r->>'payment_id'=l.payment_id
            AND r->'amount'->>'currency'='USD'),0))/100 AS net,
        action.id AS action_id
      FROM square_production_ledger l JOIN fence f USING(customer_id,merchant_id)
      JOIN events e ON e.id::text=l.payment->'match'->>'scan_id'
      JOIN campaigns c ON c.id=e.campaign_id AND c.user_id=l.customer_id
      LEFT JOIN LATERAL (
        SELECT MIN(cd.id) AS id FROM campaign_destinations cd
        WHERE cd.campaign_id=e.campaign_id
          AND split_part(split_part(cd.destination_url,'?',1),'#',1)
            ~ ('^https://[^/]+/integrations/square/production/buy/' || l.customer_id || '/' || e.campaign_id || '$')
        HAVING COUNT(*)=1
      ) action ON true
      WHERE e.type='scan' AND COALESCE(c.is_test,false)=false
        AND e.campaign_id::text=l.payment->'match'->>'campaign_id'
        AND e.qr_id::text=l.payment->'match'->>'qr_id'
        AND e.vivid_click_id=l.payment->'match'->>'click_id'
        AND e.created_at<=(l.payment->>'created_at')::timestamptz
        AND e.created_at>=(l.payment->>'created_at')::timestamptz-INTERVAL '30 days'
        AND l.payment->>'status'='COMPLETED' AND l.payment->'total'->>'currency'='USD'
    ), written AS (
      INSERT INTO events(qr_id,campaign_id,store_id,vivid_session_id,vivid_click_id,
        campaign_destination_id,type,value,created_at,square_payment_key)
      SELECT qr_id,campaign_id,store_id,vivid_session_id,vivid_click_id,action_id,
        'conversion',GREATEST(net,0),paid_at AT TIME ZONE 'UTC',payment_key FROM candidates
      ON CONFLICT(square_payment_key) DO UPDATE SET value=EXCLUDED.value,type='conversion',
        qr_id=EXCLUDED.qr_id,campaign_id=EXCLUDED.campaign_id,
        campaign_destination_id=EXCLUDED.campaign_destination_id
      RETURNING id,campaign_id,vivid_click_id,campaign_destination_id
    ), invalidated AS (
      UPDATE events e SET type='square_unattributed_conversion',value=0
      FROM square_production_ledger l JOIN fence f USING(customer_id,merchant_id)
      WHERE e.square_payment_key=jsonb_build_array(l.customer_id,l.merchant_id,l.payment_id)::text
        AND NOT EXISTS (SELECT 1 FROM candidates x WHERE x.payment_key=e.square_payment_key)
      RETURNING e.id
    ), scans AS (
      UPDATE events e SET converted_at=COALESCE(e.converted_at,x.paid_at AT TIME ZONE 'UTC')
      FROM candidates x WHERE e.id=x.scan_id AND EXISTS(SELECT 1 FROM written)
      RETURNING e.id
    ) SELECT COUNT(*)::int AS fenced FROM fence
    `,[id,connection.row.merchant_id,connection.row.token_ciphertext,lease]);
    if(!result.rows[0]?.fenced)throw Error('Connection or lease changed before conversion reconciliation');
  }
  return {ready,reconcile};
}
module.exports={createConversions};
