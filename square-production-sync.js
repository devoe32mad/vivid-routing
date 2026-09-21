'use strict';
const crypto = require('node:crypto');
// Durable leases coordinate manual imports and all running app replicas.
function createSync({q, ready, enabled=true}) {
  let schema, running=false;
  const prepare=async()=>{
    await ready();
    return schema || (schema=q(`CREATE TABLE IF NOT EXISTS square_production_sync (
      customer_id BIGINT PRIMARY KEY REFERENCES users(id), lease TEXT,
      lease_until TIMESTAMPTZ, next_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_success TIMESTAMPTZ, last_attempt TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'waiting')`
    ).catch(e=>{schema=null;throw e;}));
  };
  async function run(id, job, dueOnly=false) {
    await prepare();
    await q(`INSERT INTO square_production_sync(customer_id)
      SELECT customer_id FROM square_production_connections WHERE customer_id=$1
      ON CONFLICT(customer_id) DO NOTHING`,[id]);
    const lease=crypto.randomUUID();
    const claim=await q(`UPDATE square_production_sync SET lease=$2,
      lease_until=NOW()+INTERVAL '2 minutes',last_attempt=NOW(),status='syncing'
      WHERE customer_id=$1 AND (lease_until IS NULL OR lease_until<NOW())
      AND ($3::boolean=false OR next_at<=NOW()) RETURNING customer_id`,[id,lease,dueOnly]);
    if(!claim.rows.length)return false;
    try {
      await job(lease);
      await q(`UPDATE square_production_sync SET lease=NULL,lease_until=NULL,status='ok',
        last_success=NOW(),next_at=NOW()+INTERVAL '5 minutes' WHERE customer_id=$1 AND lease=$2`,[id,lease]);
      return true;
    } catch(e) {
      await q(`UPDATE square_production_sync SET lease=NULL,lease_until=NULL,status='retry',
        next_at=NOW()+INTERVAL '1 minute' WHERE customer_id=$1 AND lease=$2`,[id,lease]);
      throw e;
    }
  }
  async function status(id){await prepare();return (await q('SELECT status,last_success,last_attempt FROM square_production_sync WHERE customer_id=$1',[id])).rows[0];}
  async function tick(sync) {
    if(running || !enabled)return;
    running=true;
    try {
      await prepare();
      const due=await q(`SELECT c.customer_id FROM square_production_connections c
        LEFT JOIN square_production_sync s ON s.customer_id=c.customer_id
        WHERE (s.next_at IS NULL OR s.next_at<=NOW())
          AND (s.lease_until IS NULL OR s.lease_until<NOW())
        ORDER BY s.next_at ASC NULLS FIRST,c.customer_id LIMIT 5`);
      for(const row of due.rows){try{await run(row.customer_id,lease=>sync(row.customer_id,lease),true);}catch(_){/* Status is persisted; never log credentials or responses. */}}
    } finally {running=false;}
  }
  function start(sync) {
    if(!enabled)return ()=>{};
    const timer=setInterval(()=>{tick(sync).catch(()=>{});},15000);
    timer.unref();
    return ()=>clearInterval(timer);
  }
  return {run,status,tick,start,enabled};
}
module.exports={createSync};

