'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createLedger,queryFor,nextWindow}=require('./square-production-ledger');
const {installCheckout,requestFor,parsePrice,safeURL}=require('./square-production-checkout');
async function database(){
  const db=new PGlite();
  await db.exec(`CREATE TABLE users(id BIGINT PRIMARY KEY);INSERT INTO users VALUES(17),(18);
    CREATE TABLE campaigns(id BIGINT PRIMARY KEY,user_id BIGINT,name TEXT,is_test BOOLEAN);INSERT INTO campaigns VALUES(56,17,'Live offer',false),(57,18,'Other',false),(58,17,'Test',true);
    CREATE TABLE events(id BIGINT PRIMARY KEY,campaign_id BIGINT,qr_id BIGINT,type TEXT,vivid_click_id TEXT,created_at TIMESTAMPTZ);
    INSERT INTO events VALUES(1,56,60,'scan','aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',NOW()),(2,57,61,'scan','bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee',NOW()),(3,58,62,'scan','cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee',NOW());
    CREATE TABLE square_production_connections(customer_id BIGINT PRIMARY KEY,merchant_id TEXT,token_ciphertext TEXT);
    INSERT INTO square_production_connections VALUES(17,'m1','sealed');
    CREATE TABLE square_production_sync(customer_id BIGINT PRIMARY KEY,lease TEXT,lease_until TIMESTAMPTZ);
    INSERT INTO square_production_sync VALUES(17,'lease',NOW()+INTERVAL '2 minutes');
    CREATE TABLE square_production_sales(customer_id BIGINT,merchant_id TEXT,snapshot JSONB);
  `);
  const q=async(sql,args)=>args ? db.query(sql,args) : {rows:(await db.exec(sql)).at(-1)?.rows || []};
  return {db,q};
}
const conn={row:{merchant_id:'m1',token_ciphertext:'sealed'},token:{access_token:'fake',vivid_scopes:'MERCHANT_PROFILE_READ PAYMENTS_READ ORDERS_READ ORDERS_WRITE PAYMENTS_WRITE'}};
const click='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
test('durable SQL ledger migrates, deduplicates, resumes and retains old refunded payments',async()=>{
  const {db,q}=await database();
  try{
    const old={id:'old',created_at:'2025-01-01',status:'COMPLETED',total:{amount:1000,currency:'USD'}};
    await q('INSERT INTO square_production_sales VALUES($1,$2,$3)',[17,'m1',JSON.stringify({payments:[old],refunds:[]})]);
    let phase=0,failPage=false;
    const api=async(path)=>{
      const u=new URL(path,'https://example.com');
      if(u.pathname==='/v2/payments' && phase===0){
        if(u.searchParams.get('cursor')){if(failPage)throw Error('interruption');return {payments:[{id:'p2'}]};}
        return {payments:[{id:'p1'}],cursor:'next'};
      }
      if(u.pathname==='/v2/payments')return {payments:[]};
      if(u.pathname==='/v2/refunds')return {refunds:phase ? [{id:'r1',payment_id:'old'}] : []};
      if(u.pathname==='/v2/payments/old')return {payment:old};
      throw Error(path);
    };
    const ledger=createLedger({q,api,enrich:async(id,p,t,r)=>({payment:p,refunds:r ? [{...r,status:'COMPLETED',amount:{amount:300,currency:'USD'}}] : []})});
    failPage=true;await assert.rejects(()=>ledger.run(17,conn,'lease'));
    let result=await ledger.load(17);assert.equal(result.snapshot.payments.length,2);assert.equal(result.state.window.cursor,'next');
    failPage=false;await ledger.run(17,conn,'lease');result=await ledger.load(17);assert.equal(result.snapshot.payments.length,3);assert.equal(result.state.window,null);
    phase=1;await ledger.run(17,conn,'lease');result=await ledger.load(17);assert.equal(result.snapshot.payments.length,3);assert.equal(result.snapshot.refunds[0].amount.amount,300);
    await ledger.run(17,conn,'lease');assert.equal((await ledger.load(17)).snapshot.payments.length,3);
    await q("UPDATE square_production_sync SET lease='new'");await assert.rejects(()=>ledger.run(17,conn,'lease'),/lease changed/);
    await q("UPDATE square_production_connections SET merchant_id='m2'");assert.equal(await ledger.load(17),null);
  }finally{await db.close();}
});
test('updated-time queries include old sales and overlap for eventual consistency',()=>{
  const state=nextWindow({until:'2026-09-21T12:00:00Z'},'2026-09-21T12:05:00Z'),p=queryFor(state.window);
  assert.equal(p.get('begin_time'),'1970-01-01T00:00:00Z');assert.equal(p.get('updated_at_begin_time'),'2026-09-20T12:00:00.000Z');
});
test('checkout validates amounts, merchant-bound identity and trusted redirects',()=>{
  for(const x of ['-1','0','1.001','1e3','Infinity','10001'])assert.throws(()=>parsePrice(x));
  assert.equal(parsePrice('19.99'),1999);
  for(const x of ['http://square.link/a','https://square.link.evil.com/a','https://evil.com/a','https://u:p@square.link/a'])assert.throws(()=>safeURL(x));
  assert.equal(safeURL('https://square.link/u/abc'),'https://square.link/u/abc');
  const offer={customer_id:17,merchant_id:'m1',location_id:'loc',name:'Offer',amount:1999};
  const a=requestFor(offer,click,'https://example.com');assert.equal(a.order.reference_id,click);assert.equal(a.order.line_items[0].base_price_money.amount,1999);
  assert.notEqual(a.idempotency_key,requestFor({...offer,merchant_id:'m2'},click,'https://example.com').idempotency_key);
});
test('live checkout uses database price, denies invalid scans and retries the frozen request',async()=>{
  const {db,q}=await database(),routes=new Map(),requests=[];
  let fail=false;
  const app={get:(p,...h)=>routes.set('GET '+p,h),post:(p,...h)=>routes.set('POST '+p,h)};
  installCheckout({app,q,owner:(req,res,next)=>req.session?.user?.id===Number(req.params.customerId) ? next() : res.status(403).send('denied'),
    wrap:fn=>fn,api:async(path,body)=>{
      if(path==='/v2/locations')return {locations:[{id:'loc',name:'Store',status:'ACTIVE',currency:'USD'}]};
      requests.push(body);if(fail)throw Error('timeout');return {payment_link:{url:'https://square.link/u/example',order_id:'order1'}};
    },getConnection:async()=>conn,csrf:req=>req.body.csrf && req.body.csrf===req.session?.squareProductionCsrf,
    root:id=>'/integrations/square/production/customers/'+id,origin:'https://example.com'});
  async function run(key,req){const res={code:200,status(n){this.code=n;return this;},type(){return this;},send(body){this.body=body;return this;},redirect(code,url){this.code=code;this.url=url;}};const handlers=routes.get(key);async function next(i=0){if(handlers[i])await handlers[i](req,res,()=>next(i+1));}await next();return res;}
  const admin='POST /integrations/square/production/customers/:customerId/checkout',buy='POST /integrations/square/production/buy/:customerId/:campaignId';
  const req=()=>({params:{customerId:'17',campaignId:'56'},query:{vivid_click_id:click},session:{user:{id:17},squareProductionCsrf:'csrf'},body:{csrf:'csrf',campaign_id:'56',location_id:'loc',price:'19.99',name:'Offer',enabled:'true',vivid_click_id:click}});
  try{
    assert.equal((await run(admin,req())).code,303);
    const bad=req();bad.body.campaign_id='57';assert.equal((await run(admin,bad)).code,400);
    const testReq=req();testReq.body.campaign_id='58';assert.equal((await run(admin,testReq)).code,400);
    const publicReq=req();delete publicReq.session.user;publicReq.body.price='0.01';
    const noCsrf=req();noCsrf.body.csrf='wrong';assert.equal((await run(buy,noCsrf)).code,403);
    const wrongScan=req();wrongScan.body.vivid_click_id='bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee';assert.equal((await run(buy,wrongScan)).code,404);
    fail=true;await assert.rejects(()=>run(buy,publicReq));fail=false;
    await q('UPDATE square_production_offers SET amount=9900');
    assert.equal((await run(buy,publicReq)).url,'https://square.link/u/example');
    assert.deepEqual(requests[0],requests[1]);assert.equal(requests[1].order.line_items[0].base_price_money.amount,1999);
    assert.equal((await run(buy,publicReq)).code,303);assert.equal(requests.length,2);
    await q('UPDATE square_production_offers SET enabled=false');assert.equal((await run(buy,publicReq)).code,404);
    const rows=(await q('SELECT * FROM square_production_checkouts')).rows;assert.equal(rows.length,1);
    assert.ok(!JSON.stringify(rows).includes('fake'));
  }finally{await db.close();}
});
