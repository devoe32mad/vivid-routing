'use strict';
// Per-payment durable records. A cursor is committed atomically with each page.
function nextWindow(state, now) {
  if(state?.window)return state;
  return {...state,window:{phase:'payments',cursor:null,end:now,
    begin:state?.until ? new Date(Date.parse(state.until)-86400000).toISOString() : new Date(Date.parse(now)-90*86400000).toISOString(),
    initial:!state?.until}};
}
function queryFor(window) {
  const p={limit:'10',sort_order:'ASC',begin_time:window.initial && window.phase==='payments' ? window.begin : '1970-01-01T00:00:00Z',end_time:window.end};
  if(!window.initial || window.phase==='refunds')Object.assign(p,{updated_at_begin_time:window.begin,updated_at_end_time:window.end,sort_field:'UPDATED_AT'});
  if(window.cursor)p.cursor=window.cursor;
  return new URLSearchParams(p);
}
function advance(state,cursor) {
  if(cursor && cursor===state.window.cursor)throw Error('Repeated Square cursor');
  if(cursor)return {...state,window:{...state.window,cursor}};
  if(state.window.phase==='payments')return {...state,window:{...state.window,phase:'refunds',cursor:null}};
  return {until:state.window.end,window:null};
}
function createLedger({q,api,enrich}) {
  let schema;
  const ready=()=>schema || (schema=q(`CREATE TABLE IF NOT EXISTS square_production_ledger (
    customer_id BIGINT NOT NULL REFERENCES users(id),merchant_id TEXT NOT NULL,payment_id TEXT NOT NULL,
    payment JSONB NOT NULL,refunds JSONB NOT NULL DEFAULT '[]',updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(customer_id,merchant_id,payment_id));
    CREATE TABLE IF NOT EXISTS square_production_checkpoints (
    customer_id BIGINT NOT NULL REFERENCES users(id),merchant_id TEXT NOT NULL,state JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(customer_id,merchant_id));
    INSERT INTO square_production_ledger(customer_id,merchant_id,payment_id,payment,refunds)
      SELECT s.customer_id,s.merchant_id,p->>'id',p,
        COALESCE((SELECT jsonb_agg(r) FROM jsonb_array_elements(s.snapshot->'refunds') r WHERE r->>'payment_id'=p->>'id'),'[]'::jsonb)
      FROM square_production_sales s CROSS JOIN LATERAL jsonb_array_elements(s.snapshot->'payments') p
      ON CONFLICT DO NOTHING`).catch(e=>{schema=null;throw e;}));
  async function run(id,connection,lease) {
    await ready();
    const merchant=connection.row.merchant_id,token=connection.token.access_token;
    let state=(await q('SELECT state FROM square_production_checkpoints WHERE customer_id=$1 AND merchant_id=$2',[id,merchant])).rows[0]?.state;
    state=nextWindow(state,new Date().toISOString());
    const deadline=Date.now()+60000;
    for(let pages=0;pages<8 && Date.now()<deadline;pages++) {
      const w=state.window,key=w.phase==='payments' ? 'payments' : 'refunds';
      const data=await api('/v2/'+key+'?'+queryFor(w),null,token);
      const rows=new Map();
      for(const raw of data[key] || []) {
        const paymentId=key==='payments' ? raw.id : raw.payment_id;
        if(!paymentId)continue; // Unlinked refunds cannot be attributed to a payment.
        if(rows.has(paymentId))continue;
        const p=key==='payments' ? raw : (await api('/v2/payments/'+encodeURIComponent(paymentId),null,token)).payment;
        if(p?.id!==paymentId)throw Error('Payment identity mismatch');
        rows.set(paymentId,await enrich(id,p,token,key==='refunds' ? raw : null));
      }
      const next=advance(state,data.cursor);
      // One PostgreSQL statement: no partially saved page and no stale lease writes.
      const saved=await q(`WITH fence AS MATERIALIZED (
        SELECT c.customer_id,c.merchant_id FROM square_production_connections c
        JOIN square_production_sync s USING(customer_id)
        WHERE c.customer_id=$1 AND c.merchant_id=$2 AND c.token_ciphertext=$3 AND s.lease=$4 AND s.lease_until>NOW()
        FOR UPDATE OF s,c), records AS (
        INSERT INTO square_production_ledger(customer_id,merchant_id,payment_id,payment,refunds)
        SELECT f.customer_id,f.merchant_id,r->'payment'->>'id',r->'payment',r->'refunds'
        FROM fence f CROSS JOIN jsonb_array_elements($5::jsonb) r
        ON CONFLICT(customer_id,merchant_id,payment_id) DO UPDATE SET payment=EXCLUDED.payment,refunds=EXCLUDED.refunds,updated_at=NOW()
        RETURNING payment_id)
        INSERT INTO square_production_checkpoints(customer_id,merchant_id,state)
        SELECT customer_id,merchant_id,$6::jsonb FROM fence
        ON CONFLICT(customer_id,merchant_id) DO UPDATE SET state=EXCLUDED.state,updated_at=NOW() RETURNING customer_id`,
        [id,merchant,connection.row.token_ciphertext,lease,JSON.stringify([...rows.values()]),JSON.stringify(next)]);
      if(!saved.rows.length)throw Error('Connection or lease changed');
      state=next;
      if(!state.window)return;
    }
    // The next run resumes the committed page, including initial imports over 2,000 rows.
  }
  async function load(id) {
    await ready();
    const rows=(await q(`SELECT CASE WHEN l.payment->'match' IS NULL OR EXISTS(
        SELECT 1 FROM campaigns c WHERE c.id::text=l.payment->'match'->>'campaign_id'
          AND c.user_id=l.customer_id AND COALESCE(c.is_test,false)=false)
        THEN l.payment ELSE l.payment-'match' END AS payment,l.refunds,l.updated_at FROM square_production_ledger l
      JOIN square_production_connections c USING(customer_id,merchant_id)
      WHERE l.customer_id=$1 ORDER BY (l.payment->>'created_at') DESC,l.payment_id`,[id])).rows;
    const cp=(await q(`SELECT s.state,s.updated_at FROM square_production_checkpoints s
      JOIN square_production_connections c USING(customer_id,merchant_id) WHERE s.customer_id=$1`,[id])).rows[0];
    if(!cp && !rows.length)return null;
    return {imported_at:cp?.updated_at || rows[0].updated_at,state:cp?.state,
      snapshot:{payments:rows.map(r=>r.payment),refunds:rows.flatMap(r=>r.refunds)}};
  }
  return {ready,run,load};
}
module.exports={createLedger,nextWindow,queryFor,advance};
