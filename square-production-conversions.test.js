'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createConversions}=require('./square-production-conversions');
const conn={row:{merchant_id:'merchant',token_ciphertext:'sealed'}};
test('native reports backfill exactly once, replace estimates, preserve other actions and adjust refunds',async()=>{
  const db=new PGlite();
  const q=(sql,args)=>args ? db.query(sql,args) : db.exec(sql);
  try{
    await db.exec(`CREATE TABLE campaigns(id INT PRIMARY KEY,user_id INT,is_test BOOLEAN);
      INSERT INTO campaigns VALUES(66,17,false),(67,18,false),(68,17,true);
      CREATE TABLE campaign_destinations(id INT PRIMARY KEY,campaign_id INT,destination_url TEXT);
      INSERT INTO campaign_destinations VALUES(5,66,'https://vivid.example/integrations/square/production/buy/17/66');
      CREATE TABLE events(id SERIAL PRIMARY KEY,qr_id INT,campaign_id INT,store_id INT,
        vivid_session_id TEXT,vivid_click_id TEXT,campaign_destination_id INT,type TEXT,value NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,converted_at TIMESTAMP);
      INSERT INTO events(qr_id,campaign_id,type,vivid_click_id) VALUES(60,66,'scan','click');
      INSERT INTO events(qr_id,campaign_id,type,vivid_click_id,campaign_destination_id,value)
        VALUES(60,66,'conversion','click',5,35),(60,66,'conversion','click',9,12);
      CREATE TABLE square_production_connections(customer_id INT,merchant_id TEXT,token_ciphertext TEXT);
      INSERT INTO square_production_connections VALUES(17,'merchant','sealed');
      CREATE TABLE square_production_sync(customer_id INT,lease TEXT,lease_until TIMESTAMPTZ);
      INSERT INTO square_production_sync VALUES(17,'lease',NOW()+INTERVAL '2 minutes');
      CREATE TABLE square_production_ledger(customer_id INT,merchant_id TEXT,payment_id TEXT,payment JSONB,refunds JSONB);
    `);
    const payment={id:'p1',status:'COMPLETED',created_at:new Date(Date.now()+1000).toISOString(),total:{amount:100,currency:'USD'},match:{scan_id:1,campaign_id:66,qr_id:60,click_id:'click'}};
    const save=(p=payment,refunds=[])=>q('UPDATE square_production_ledger SET payment=$1,refunds=$2',[JSON.stringify(p),JSON.stringify(refunds)]);
    await q('INSERT INTO square_production_ledger VALUES(17,$1,$2,$3,$4)',['merchant','p1',JSON.stringify(payment),'[]']);
    const bridge=createConversions({q});
    const run=()=>bridge.reconcile(17,conn,'lease');
    const report=async()=> (await q("SELECT COUNT(*)::int AS conversions,SUM(value)::text AS revenue FROM events WHERE campaign_id=66 AND type='conversion' AND campaign_destination_id=5",[])).rows[0];
    await run();assert.deepEqual(await report(),{conversions:1,revenue:'1.00000000000000000000'});
    await run();assert.equal((await report()).conversions,1);
    assert.equal((await q("SELECT value FROM events WHERE type='conversion' AND campaign_destination_id=9",[])).rows[0].value,'12');
    // Later legacy tracking cannot add a second estimate for this same action.
    await q("INSERT INTO events(campaign_id,type,vivid_click_id,campaign_destination_id,value) VALUES(66,'conversion','click',5,35)",[]);
    assert.equal((await report()).conversions,1);
    const refund=status=>[{id:'r1',payment_id:'p1',status,amount:{amount:40,currency:'USD'}}];
    await save(payment,refund('PENDING'));await run();assert.equal(Number((await report()).revenue),1);
    await save(payment,refund('COMPLETED'));await run();assert.equal(Number((await report()).revenue),0.6);
    await save(payment,[{...refund('COMPLETED')[0],amount:{amount:100,currency:'USD'}}]);await run();
    assert.equal(Number((await report()).revenue),0);assert.equal((await report()).conversions,1);
    // Exact owner/test/currency/status gates also retract previously published events.
    for(const p of [{...payment,status:'PENDING'},{...payment,match:null},{...payment,total:{amount:100,currency:'EUR'}},{...payment,match:{...payment.match,qr_id:99}}]){
      await save(p);await run();assert.equal((await report()).conversions,0);
    }
    await save();await q('UPDATE campaigns SET is_test=true WHERE id=66',[]);await run();assert.equal((await report()).conversions,0);
    await q('UPDATE campaigns SET is_test=false,user_id=18 WHERE id=66',[]);await run();assert.equal((await report()).conversions,0);
    await q('UPDATE campaigns SET user_id=17 WHERE id=66',[]);await run();assert.equal((await report()).conversions,1);
    // Expired/stale leases cannot change native reporting.
    await save(payment,refund('COMPLETED'));await assert.rejects(()=>bridge.reconcile(17,conn,'wrong'),/lease changed/);assert.equal(Number((await report()).revenue),1);
    await q("UPDATE square_production_connections SET merchant_id='other'",[]);await assert.rejects(run,/lease changed/);assert.equal(Number((await report()).revenue),1);
    assert.ok((await q('SELECT converted_at FROM events WHERE id=1',[])).rows[0].converted_at);
  }finally{await db.close();}
});
