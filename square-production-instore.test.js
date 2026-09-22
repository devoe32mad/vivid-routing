'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {createRedemptions,orderEvidence,normalizeCode,newCode}=require('./square-production-redemptions');
const {installInstore}=require('./square-production-instore');
const {installSales}=require('./square-production-sales');
const click='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const conn={row:{merchant_id:'merchant',token_ciphertext:'sealed'},token:{access_token:'fake',vivid_scopes:'MERCHANT_PROFILE_READ PAYMENTS_READ ORDERS_READ'}};
const root=id=>'/integrations/square/production/customers/'+id;
const admin='POST /integrations/square/production/customers/:customerId/instore';
const claimRoute='POST /integrations/square/production/claim/:customerId/:campaignId';
async function fixture(){
  const db=new PGlite();
  await db.exec(`CREATE TABLE users(id BIGINT PRIMARY KEY);INSERT INTO users VALUES(17),(18);
    CREATE TABLE campaigns(id BIGINT PRIMARY KEY,user_id BIGINT,name TEXT,is_test BOOLEAN);
    INSERT INTO campaigns VALUES(66,17,'Pilot',false),(67,18,'Other merchant',false),(68,17,'Test',true);
    CREATE TABLE events(id SERIAL PRIMARY KEY,qr_id BIGINT,campaign_id BIGINT,store_id BIGINT,vivid_session_id TEXT,
      vivid_click_id TEXT,campaign_destination_id BIGINT,type TEXT,value NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,converted_at TIMESTAMP);
    INSERT INTO events(qr_id,campaign_id,type,vivid_click_id,created_at) VALUES(60,66,'scan','${click}',NOW()-INTERVAL '1 minute');
    CREATE TABLE campaign_destinations(id BIGINT PRIMARY KEY,campaign_id BIGINT,destination_url TEXT);
    INSERT INTO campaign_destinations VALUES(7,66,'https://vivid.example/integrations/square/production/claim/17/66'),
      (8,66,'https://vivid.example/integrations/square/production/buy/17/66');
    CREATE TABLE square_production_connections(customer_id BIGINT PRIMARY KEY,merchant_id TEXT,token_ciphertext TEXT);
    INSERT INTO square_production_connections VALUES(17,'merchant','sealed');
    CREATE TABLE square_production_sync(customer_id BIGINT PRIMARY KEY,lease TEXT,lease_until TIMESTAMPTZ);
    INSERT INTO square_production_sync VALUES(17,'lease',NOW()+INTERVAL '10 minutes');
  `);
  const q=async(sql,args)=>args ? db.query(sql,args) : {rows:(await db.exec(sql)).at(-1)?.rows||[]};
  const routes=new Map(),provider={payments:[],orders:{},refunds:{},locations:[{id:'loc',name:'Pilot shop',status:'ACTIVE',currency:'USD'}]};
  const app={get:(path,...h)=>routes.set('GET '+path,h),post:(path,...h)=>routes.set('POST '+path,h)};
  const api=async(path,body)=>{
    assert.equal(body,null,'in-store pilot must never write to Square');
    if(path==='/v2/locations')return {locations:provider.locations};
    if(path.startsWith('/v2/payments?'))return {payments:provider.payments};
    if(path.startsWith('/v2/refunds?'))return {refunds:Object.values(provider.refunds)};
    if(path.startsWith('/v2/refunds/'))return {refund:provider.refunds[path.split('/').at(-1)]};
    if(path.startsWith('/v2/orders/'))return {order:provider.orders[path.split('/').at(-1)]};
    if(path.startsWith('/v2/payments/'))return {payment:provider.payments.find(p=>p.id===path.split('/').at(-1))};
    throw Error(path);
  };
  const options={app,q,api,owner:(req,res,next)=>Number(req.params.customerId)===req.session?.user?.id ? next() : res.status(403).send('Denied'),
    wrap:fn=>fn,getConnection:async()=>conn,csrf:req=>req.body?.csrf==='csrf' && req.session?.squareProductionCsrf==='csrf',
    root,origin:'https://vivid.example',sync:{enabled:true,status:async()=>null,run:async(id,fn)=>{await fn('lease');return true;}}};
  const {syncSales}=installSales(options),model=installInstore(options);
  async function run(key,req){
    const res={code:200,status(n){this.code=n;return this;},type(){return this;},send(body){this.body=body;return this;},set(){return this;},redirect(code,url){this.code=typeof code==='number'?code:302;this.url=url||code;return this;}};
    const h=routes.get(key);assert.ok(h,key);async function next(i=0){if(h[i])await h[i](req,res,()=>next(i+1));}await next();return res;
  }
  const req=(body={})=>({params:{customerId:'17',campaignId:'66'},query:{vivid_click_id:click},session:{user:{id:17},squareProductionCsrf:'csrf'},
    body:{csrf:'csrf',campaign_id:'66',location_id:'loc',name:'10% off sandwiches',terms:'One eligible sandwich. Excludes drinks.',enabled:'true',vivid_click_id:click,...body}});
  const setup=async()=>{assert.equal((await run(admin,req())).code,303);return model.issue(17,66,click);};
  const pay=(code,id='payment1',overrides={})=>{
    const created_at=new Date(Date.now()+1000).toISOString(),order_id='order-'+id;
    const p={id,location_id:'loc',order_id,status:'COMPLETED',created_at,total_money:{amount:1100,currency:'USD'},...overrides};
    const order={id:order_id,location_id:'loc',state:'COMPLETED',closed_at:created_at,total_money:p.total_money,
      line_items:[{name:'Sandwich',note:code},{name:'Drink'}],
      tenders:[{type:'CARD',payment_id:id,location_id:'loc',amount_money:p.total_money}]};
    provider.payments.push(p);provider.orders[order_id]=order;return {p,order};
  };
  const report=()=>q("SELECT * FROM events WHERE type='conversion' ORDER BY id",[]);
  return {db,q,model,run,req,setup,pay,provider,report,sync:()=>syncSales(17,'lease')};
}
test('order evidence retains only exact codes and rejects unsupported or ambiguous tenders',()=>{
  const code=newCode(),p={id:'p',order_id:'o',location_id:'loc',status:'COMPLETED',total:{amount:100,currency:'USD'}};
  const order={id:'o',location_id:'loc',state:'COMPLETED',closed_at:new Date().toISOString(),total_money:p.total,
    line_items:[{note:code.toLowerCase()},{note:'ordinary private customer note'}],tenders:[{type:'CARD',payment_id:'p',location_id:'loc',amount_money:p.total,card_details:{secret:'must not persist'}}]};
  assert.equal(normalizeCode(code.toLowerCase()),code);
  assert.deepEqual(orderEvidence(order,p),{code,eligible:true,closed_at:order.closed_at});
  assert.equal(orderEvidence({...order,line_items:[{note:'ordinary note'}]},p),null);
  for(const bad of [
    {...order,line_items:[{note:'Vivid-POS-Check-01'}]},
    {...order,line_items:[{note:code},{note:newCode()}]},
    {...order,line_items:[{note:'prefix '+code}]},
    {...order,tenders:[...order.tenders,...order.tenders]},
    {...order,tenders:[{...order.tenders[0],type:'CASH'}]},
    {...order,tenders:[{...order.tenders[0],payment_id:'other'}]},
    {...order,state:'OPEN'},{...order,location_id:'other'},{...order,total_money:{amount:50,currency:'USD'}}
  ])assert.equal(orderEvidence(bad,p).eligible,false);
});
test('claim, cashier approval, exact paid basket, native conversion, retry and refund',async()=>{
  const f=await fixture();try{
    const claim=await f.setup();assert.ok(normalizeCode(claim.code));
    const repeat=await f.model.issue(17,66,click);assert.equal(repeat.code,claim.code);
    assert.equal((await f.report()).rows.length,0,'claim does not produce conversion');
    const lookup=await f.run(admin+'/lookup',f.req({code:claim.code}));assert.equal(lookup.code,200);assert.match(lookup.body,/10% off sandwiches/);
    const approval=await f.run(admin+'/approve',f.req({code:claim.code,confirm:'true'}));assert.equal(approval.code,200);
    assert.match(approval.body,/Apply the offer/);
    f.pay(claim.code);await f.sync();await f.sync();
    let reports=(await f.report()).rows;assert.equal(reports.length,1);assert.equal(Number(reports[0].value),11);
    assert.equal(Number(reports[0].campaign_destination_id),7,'in-store action, not online checkout action');
    const row=(await f.q('SELECT * FROM square_instore_claims',[])).rows[0];assert.equal(row.payment_id,'payment1');
    assert.equal(await f.model.lookup(17,claim.code,'loc'),null,'already-used code denied');
    assert.equal(await f.model.approve(17,claim.code,'loc',17),null);
    f.pay(claim.code,'reused');await f.sync();assert.equal((await f.report()).rows.length,1);
    f.provider.refunds.r1={id:'r1',payment_id:'payment1',status:'COMPLETED',amount_money:{amount:300,currency:'USD'}};
    f.provider.payments[0].refund_ids=['r1'];await f.sync();reports=(await f.report()).rows;
    assert.equal(reports.length,1);assert.equal(Number(reports[0].value),8);
    f.provider.refunds.r1.amount_money.amount=1100;await f.sync();reports=(await f.report()).rows;
    assert.equal(reports.length,1);assert.equal(Number(reports[0].value),0);
    const data=JSON.stringify((await f.q('SELECT payment FROM square_production_ledger',[])).rows);
    assert.ok(!data.includes('card_details'));assert.ok(!data.includes('Sandwich'));
  }finally{await f.db.close();}
});
test('tenant, campaign, location, CSRF, approval and frozen offer restrictions',async()=>{
  const f=await fixture();try{
    const claim=await f.setup();
    for(const route of [admin,admin+'/lookup',admin+'/approve']){
      const wrong=f.req({code:claim.code,confirm:'true'});wrong.session.user.id=18;assert.equal((await f.run(route,wrong)).code,403);
      assert.equal((await f.run(route,f.req({csrf:'bad',code:claim.code}))).code,403);
    }
    assert.equal((await f.run(admin,f.req({campaign_id:67}))).code,400);
    assert.equal((await f.run(admin,f.req({campaign_id:68}))).code,400);
    assert.equal(await f.model.issue(18,66,click),null);
    assert.equal(await f.model.issue(17,66,'forged'),null);
    assert.equal(await f.model.lookup(17,claim.code,'other'),null);
    assert.equal(await f.model.lookup(18,claim.code,'loc'),null);
    assert.equal((await f.run(admin+'/approve',f.req({code:claim.code}))).code,400);
    await f.run(admin,f.req({name:'Changed',terms:'Different terms'}));
    const frozen=await f.model.issue(17,66,click);assert.equal(frozen.name,claim.name);assert.equal(frozen.terms,claim.terms);
    await f.run(admin+'/disable',f.req());assert.equal(await f.model.issue(17,66,click),null);
    assert.ok(await f.model.approve(17,claim.code,'loc',17),'issued claims keep original terms when new claims disabled');
    const r=(await f.q('SELECT approved_at,checkout_until FROM square_instore_claims',[])).rows[0];
    await f.model.approve(17,claim.code,'loc',17);
    assert.deepEqual((await f.q('SELECT approved_at,checkout_until FROM square_instore_claims',[])).rows[0],r,'retry does not extend checkout');
  }finally{await f.db.close();}
});
test('unapproved, late, expired and conflicting-reference payments stay unmatched',async()=>{
  const f=await fixture();try{
    const claim=await f.setup();const {p}=f.pay(claim.code);
    p.created_at=new Date(Date.now()-1000).toISOString();f.provider.orders[p.order_id].closed_at=p.created_at;
    await f.sync();assert.equal((await f.report()).rows.length,0);
    await f.model.approve(17,claim.code,'loc',17);await f.sync();assert.equal((await f.report()).rows.length,0,'approval after payment cannot retroattribute');
    p.created_at=new Date(Date.now()+1000).toISOString();f.provider.orders[p.order_id].closed_at=p.created_at;
    p.reference_id=click;await f.sync();assert.equal((await f.report()).rows.length,0,'online reference plus code is conflicting');
    delete p.reference_id;
    await f.q("UPDATE square_instore_claims SET checkout_until=NOW()-INTERVAL '1 second'",[]);
    await f.sync();assert.equal((await f.report()).rows.length,0);
    assert.equal(await f.model.approve(17,claim.code,'loc',17),null);
    await f.q("UPDATE square_instore_claims SET checkout_until=NULL,approved_at=NULL,expires_at=NOW()-INTERVAL '1 second'",[]);
    assert.equal(await f.model.lookup(17,claim.code,'loc'),null);
  }finally{await f.db.close();}
});
test('two paid orders claiming the same unused code are rejected without guessing',async()=>{
  const f=await fixture();try{
    const claim=await f.setup();await f.model.approve(17,claim.code,'loc',17);
    f.pay(claim.code,'p1');f.pay(claim.code,'p2');await f.sync();
    assert.equal((await f.report()).rows.length,0);
    assert.equal((await f.q('SELECT payment_id FROM square_instore_claims',[])).rows[0].payment_id,null);
  }finally{await f.db.close();}
});
test('wrong location and merchant, split payment, expired lease and test campaign fail closed',async()=>{
  const f=await fixture();try{
    const claim=await f.setup();await f.model.approve(17,claim.code,'loc',17);const {p,order}=f.pay(claim.code);
    p.location_id=order.location_id=order.tenders[0].location_id='wrong';await f.sync();assert.equal((await f.report()).rows.length,0);
    p.location_id=order.location_id=order.tenders[0].location_id='loc';
    order.tenders.push({...order.tenders[0],payment_id:'split'});await f.sync();assert.equal((await f.report()).rows.length,0);
    order.tenders.pop();await f.q('UPDATE campaigns SET is_test=true WHERE id=66',[]);await f.sync();assert.equal((await f.report()).rows.length,0);
    await f.q('UPDATE campaigns SET is_test=false WHERE id=66',[]);
    await f.q("UPDATE square_production_sync SET lease_until=NOW()-INTERVAL '1 second'",[]);await assert.rejects(f.sync,/lease changed/);
    assert.equal((await f.q('SELECT payment_id FROM square_instore_claims',[])).rows[0].payment_id,null);
    await f.q("UPDATE square_production_sync SET lease_until=NOW()+INTERVAL '1 minute'",[]);
    await f.q("UPDATE square_production_connections SET merchant_id='other'",[]);
    assert.equal(await f.model.lookup(17,claim.code,'loc'),null);await assert.rejects(f.sync,/lease changed/);
  }finally{await f.db.close();}
});
test('customer routes require eligible unique scan and escape offer content',async()=>{
  const f=await fixture();try{
    await f.run(admin,f.req({name:'<script>alert(1)</script>',terms:'<img src=x>'}));
    const request=f.req();delete request.session.user;
    const response=await f.run(claimRoute,request);assert.equal(response.code,200);assert.match(response.body,/&lt;script&gt;/);assert.ok(!response.body.includes('<script>'));
    assert.equal((await f.run(claimRoute,f.req({csrf:'bad'}))).code,403);
    await f.q("INSERT INTO events(qr_id,campaign_id,type,vivid_click_id) VALUES(60,66,'scan',$1)",[click]);
    assert.equal(await f.model.issue(17,66,click),null,'duplicate scan references denied');
  }finally{await f.db.close();}
});
test('failed ledger match rolls back code consumption and retry recovers once',async()=>{
  const f=await fixture();try{
    const claim=await f.setup();await f.model.approve(17,claim.code,'loc',17);f.pay(claim.code);
    // Initialize the ledger with an empty provider page before installing the fault.
    const payments=f.provider.payments;f.provider.payments=[];await f.sync();f.provider.payments=payments;
    await f.q(`CREATE FUNCTION fail_match() RETURNS trigger AS $$ BEGIN
      IF NEW.payment->'match'->>'method'='in_store_code' THEN RAISE EXCEPTION 'simulated ledger write failure'; END IF;
      RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_match BEFORE UPDATE ON square_production_ledger FOR EACH ROW EXECUTE FUNCTION fail_match();`);
    await assert.rejects(f.sync,/simulated ledger/);
    assert.equal((await f.q('SELECT payment_id FROM square_instore_claims',[])).rows[0].payment_id,null);
    assert.equal((await f.report()).rows.length,0);
    await f.q('DROP TRIGGER fail_match ON square_production_ledger');await f.sync();await f.sync();
    assert.equal((await f.report()).rows.length,1);
    await f.q('UPDATE campaigns SET is_test=true WHERE id=66',[]);await f.sync();
    assert.equal((await f.report()).rows.length,0,'ineligible campaigns retract native attribution');
    assert.equal((await f.q('SELECT payment_id FROM square_instore_claims',[])).rows[0].payment_id,'payment1','retraction never reopens a redeemed code');
  }finally{await f.db.close();}
});
test('simultaneous claims and approvals keep one code and one approval window',async()=>{
  const f=await fixture();try{
    await f.run(admin,f.req());
    const claims=await Promise.all([f.model.issue(17,66,click),f.model.issue(17,66,click)]);
    assert.equal(claims[0].code,claims[1].code);
    const approved=await Promise.all([f.model.approve(17,claims[0].code,'loc',17),f.model.approve(17,claims[0].code,'loc',17)]);
    assert.deepEqual(approved[0].checkout_until,approved[1].checkout_until);
    assert.equal((await f.q('SELECT * FROM square_instore_claims',[])).rows.length,1);
  }finally{await f.db.close();}
});

test('short codes omit ambiguous characters and normalize strictly alongside legacy codes',()=>{
  for(let i=0;i<100;i++)assert.match(newCode(),/^V-[2-9A-HJ-NP-Z]{8}$/);
  assert.equal(normalizeCode('  v-7k3m9r2x  '),'V-7K3M9R2X');
  assert.equal(normalizeCode('vivid-7f7e-4671-73cf-74f6'),'VIVID-7F7E-4671-73CF-74F6');
  for(const bad of ['V-7K3M9R2','V-7K3M9R2XX','V-0K3M9R2X','V-OK3M9R2X','V-1K3M9R2X','V-IK3M9R2X','7K3M9R2X','prefix V-7K3M9R2X'])assert.equal(normalizeCode(bad),null);
});
test('legacy claimed code survives repeated claims, cashier approval and exact paid order sync',async()=>{
  const f=await fixture();try{
    await f.setup();const legacy='VIVID-7F7E-4671-73CF-74F6';
    await f.q('UPDATE square_instore_claims SET code=$1',[legacy]);
    assert.equal((await f.model.issue(17,66,click)).code,legacy);
    const approval=await f.run(admin+'/approve',f.req({code:legacy.toLowerCase(),confirm:'true'}));
    assert.equal(approval.code,200);assert.match(approval.body,/Copy code/);assert.ok(approval.body.includes(legacy));
    f.pay(legacy);await f.sync();await f.sync();
    assert.equal((await f.report()).rows.length,1);
    assert.equal(await f.model.lookup(17,legacy,'loc'),null);
  }finally{await f.db.close();}
});
test('random-code collisions retry without changing an existing claim and stop after a bound',async()=>{
  const f=await fixture();try{
    const original=await f.setup();const secondClick='bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee';
    await f.q("INSERT INTO events(qr_id,campaign_id,type,vivid_click_id) VALUES(60,66,'scan',$1)",[secondClick]);
    let attempts=0;
    const model=createRedemptions({q:f.q,generateCode:()=>++attempts===1?original.code:'V-23456789'});
    const claim=await model.issue(17,66,secondClick);
    assert.equal(claim.code,'V-23456789');assert.equal(attempts,2);
    assert.equal((await f.model.issue(17,66,click)).code,original.code);
    const thirdClick='cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee';
    await f.q("INSERT INTO events(qr_id,campaign_id,type,vivid_click_id) VALUES(60,66,'scan',$1)",[thirdClick]);
    let collisions=0;
    await assert.rejects(createRedemptions({q:f.q,generateCode:()=>{collisions++;return original.code;}}).issue(17,66,thirdClick),/unique claim code/);
    assert.equal(collisions,5);
    assert.equal((await f.q('SELECT * FROM square_instore_claims',[])).rows.length,2);
    const failure=Object.assign(Error('different constraint'),{code:'23505',constraint:'other_constraint'});
    let writes=0;
    await assert.rejects(createRedemptions({q:async(sql)=>{if(sql.includes('WITH eligible')){writes++;throw failure;}return {rows:[]};}}).issue(17,66,thirdClick),/different constraint/);
    assert.equal(writes,1);
  }finally{await f.db.close();}
});
test('copy control copies the exact code and offers manual selection when clipboard is unavailable',async()=>{
  const f=await fixture();try{
    await f.setup();const response=await f.run(claimRoute,f.req());
    assert.match(response.body,/id="claim-code"/);assert.match(response.body,/Copy code/);
    const script=await f.run('GET /integrations/square/production/instore-copy.js',f.req());
    const {runInNewContext}=require('node:vm');
    for(const supported of [true,false]){
      let handler,copied,selection,focused=false;
      const field={value:'V-7K3M9R2X',focus(){focused=true;},select(){},setSelectionRange(start,end){selection=[start,end];}};
      const button={hidden:true,addEventListener(event,fn){assert.equal(event,'click');handler=fn;}},status={};
      const elements={'claim-code':field,'copy-claim-code':button,'copy-code-status':status};
      runInNewContext(script.body,{document:{getElementById:id=>elements[id]},navigator:supported?{clipboard:{writeText:async text=>{copied=text;}}}:{}});
      assert.equal(button.hidden,false);await handler();
      if(supported){assert.equal(copied,field.value);assert.match(status.textContent,/copied/);}
      else{assert.equal(focused,true);assert.deepEqual(selection,[0,field.value.length]);assert.match(status.textContent,/selected/);}
    }
  }finally{await f.db.close();}
});
test('short and legacy codes on the same order are conflicting even with different prefixes',()=>{
  const code=newCode(),legacy='VIVID-7F7E-4671-73CF-74F6';
  const p={id:'p',order_id:'o',location_id:'loc',status:'COMPLETED',total:{amount:100,currency:'USD'}};
  const order={id:'o',location_id:'loc',state:'COMPLETED',closed_at:new Date().toISOString(),total_money:p.total,
    line_items:[{note:code},{note:legacy}],tenders:[{type:'CARD',payment_id:'p',location_id:'loc',amount_money:p.total}]};
  assert.equal(orderEvidence(order,p).eligible,false);
  assert.equal(orderEvidence({...order,line_items:[{note:'V-INVALID'}]},p).eligible,false);
});

test('cashier QR opens authorized read-only lookup; explicit approval still required',async()=>{
  const f=await fixture();try{
    const claim=await f.setup();
    const customer=await f.run(claimRoute,f.req());
    assert.match(customer.body,/<svg/);assert.match(customer.body,/Cashier QR code/);
    const get='GET /integrations/square/production/customers/:customerId/instore/redeem';
    const req=f.req();req.query={code:claim.code};
    const lookup=await f.run(get,req);
    assert.equal(lookup.code,200);assert.match(lookup.body,/Confirm eligible items/);
    assert.doesNotMatch(lookup.body,/type="checkbox"/);
    assert.equal((await f.q('SELECT approved_at FROM square_instore_claims',[])).rows[0].approved_at,null);
    assert.equal((await f.report()).rows.length,0);
    req.session.user.id=18;assert.equal((await f.run(get,req)).code,403);
    delete req.session.user;assert.equal((await f.run(get,req)).code,403);
    req.session.user={id:17};req.query.code='<script>';
    assert.equal((await f.run(get,req)).code,400);
    req.query.code=claim.code;await f.q("UPDATE square_instore_claims SET expires_at=NOW()-INTERVAL '1 second'",[]);
    assert.equal((await f.run(get,req)).code,409);
    assert.doesNotMatch((await f.run(claimRoute,f.req())).body,/<svg/);
  }finally{await f.db.close();}
});
test('cashier location is explicit for multiple locations and remembered only within merchant scope',async()=>{
  const f=await fixture();try{
    const claim=await f.setup();
    f.provider.locations.push({id:'other-loc',name:'Other shop',status:'ACTIVE',currency:'USD'});
    const get='GET /integrations/square/production/customers/:customerId/instore/redeem';
    const req=f.req({code:claim.code});req.query={code:claim.code};
    let response=await f.run(get,req);
    assert.match(response.body,/Choose your checkout location/);assert.match(response.body,/Check code/);
    await f.run(admin+'/lookup',req);
    assert.equal(req.session.squareInstoreLocation.locationId,'loc');
    response=await f.run(get,req);assert.match(response.body,/Confirm eligible items/);
    req.query.choose_location='1';assert.match((await f.run(get,req)).body,/Choose your checkout location/);
    delete req.query.choose_location;
    for(const changed of [{customerId:18,merchantId:'merchant',locationId:'loc'},{customerId:17,merchantId:'other',locationId:'loc'},{customerId:17,merchantId:'merchant',locationId:'deleted'}]){
      req.session.squareInstoreLocation=changed;assert.match((await f.run(get,req)).body,/Choose your checkout location/);
    }
    req.session.squareInstoreLocation={customerId:17,merchantId:'merchant',locationId:'other-loc'};
    response=await f.run(get,req);assert.equal(response.code,409);assert.match(response.body,/Change checkout location/);
    assert.equal((await f.q('SELECT approved_at FROM square_instore_claims',[])).rows[0].approved_at,null);
  }finally{await f.db.close();}
});
test('quick approval JSON uses the existing CSRF, ownership and fixed payment window',async()=>{
  const f=await fixture();try{
    const claim=await f.setup();const req=f.req({code:claim.code,confirm:'true'});req.headers={accept:'application/json'};
    const approval=await f.run(admin+'/approve',req);assert.equal(approval.code,200);
    const body=JSON.parse(approval.body);assert.equal(body.code,claim.code);assert.ok(Date.parse(body.checkout_until));
    assert.equal(JSON.parse((await f.run(admin+'/approve',req)).body).checkout_until,body.checkout_until);
    assert.equal((await f.report()).rows.length,0);
    req.body.confirm='false';assert.equal((await f.run(admin+'/approve',req)).code,400);
    req.body.confirm='true';req.body.csrf='bad';assert.equal((await f.run(admin+'/approve',req)).code,403);
    req.body.csrf='csrf';req.session.user.id=18;assert.equal((await f.run(admin+'/approve',req)).code,403);
    req.session.user.id=17;f.pay(claim.code);await f.sync();
    assert.equal((await f.run(admin+'/approve',req)).code,409);
    assert.equal((await f.report()).rows.length,1);
  }finally{await f.db.close();}
});
test('one-tap client copies only after successful approval and leaves manual clipboard fallback',async()=>{
  const f=await fixture();try{
    const {runInNewContext}=require('node:vm');
    const script=(await f.run('GET /integrations/square/production/instore-copy.js',f.req())).body;
    for(const mode of ['ok','clipboard-denied','denied','redirect','wrong-code','network']){
      const code='V-7K3M9R2X';let handler,copied,selected=false,requests=0;
      const elements={
        'claim-code':{value:code,focus(){},select(){selected=true;},setSelectionRange(){}},
        'copy-claim-code':{hidden:true,addEventListener(){}},'copy-code-status':{},
        'approve-checkout':{action:'/approve',hidden:false,addEventListener(event,fn){handler=fn;}},
        'approve-button':{textContent:'Confirm eligible items'},'approval-status':{},'checkout-steps':{hidden:true},'checkout-deadline':{}
      };
      const fetch=async(url,options)=>{
        requests++;assert.equal(url,'/approve');assert.equal(options.method,'POST');
        assert.equal(options.body.get('confirm'),'true');assert.equal(options.body.get('csrf'),'csrf');
        assert.equal(copied,undefined,'must not copy before approval response');
        if(mode==='network')throw Error('offline');
        return {ok:mode!=='denied',redirected:mode==='redirect',headers:{get:()=> 'application/json'},json:async()=>({code:mode==='wrong-code'?'V-ABCDEFGH':code,checkout_until:'2026-09-22T16:00:00Z'})};
      };
      runInNewContext(script,{document:{getElementById:id=>elements[id]},fetch,URLSearchParams,
        FormData:class{constructor(){return [['csrf','csrf'],['code',code],['location_id','loc']];}},
        navigator:{clipboard:{writeText:async value=>{if(mode==='clipboard-denied')throw Error('denied');copied=value;}}}});
      assert.equal(elements['copy-claim-code'].hidden,true);
      await handler({preventDefault(){}});assert.equal(requests,1);
      if(mode==='ok' || mode==='clipboard-denied'){
        assert.equal(elements['approve-checkout'].hidden,true);assert.equal(elements['checkout-steps'].hidden,false);
        assert.equal(elements['copy-claim-code'].hidden,false);
        if(mode==='ok')assert.equal(copied,code);else{assert.equal(selected,true);assert.match(elements['copy-code-status'].textContent,/Choose Copy/);}
      }else{
        assert.equal(copied,undefined);assert.equal(selected,false);
        assert.equal(elements['approve-checkout'].hidden,false);assert.equal(elements['checkout-steps'].hidden,true);
        assert.match(elements['approval-status'].textContent,/Could not confirm/);
      }
      assert.equal(elements['approve-button'].disabled,false);
    }
  }finally{await f.db.close();}
});
