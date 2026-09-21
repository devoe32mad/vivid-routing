'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {install,configuration,seal,unseal,equal} = require('./square-sandbox');
const env = {SQUARE_SANDBOX_ENABLED:'true',SQUARE_SANDBOX_APPLICATION_ID:'sandbox-example',
  SQUARE_SANDBOX_APPLICATION_SECRET:'test-only',SQUARE_SANDBOX_TOKEN_KEY:Buffer.alloc(32,7).toString('base64'),
  SQUARE_SANDBOX_REDIRECT_URL:'https://example.com/integrations/square/sandbox/callback'};
test('encrypted credentials are tenant-bound and reject tampering', () => {
  const key = crypto.randomBytes(32), value = {access_token:'test-only'};
  const sealed = seal(value,key,'10');
  assert.deepEqual(unseal(sealed,key,'10'),value);
  assert.throws(() => unseal(sealed,key,'11'));
  assert.throws(() => unseal(sealed,crypto.randomBytes(32),'10'));
  const parts = sealed.split('.'); parts[2] = Buffer.alloc(20).toString('base64');
  assert.throws(() => unseal(parts.join('.'),key,'10'));
});
test('configuration fails closed and disabled mode has no effects', () => {
  assert.equal(configuration(env).key.length,32);
  for (const update of [{SQUARE_SANDBOX_TOKEN_KEY:''},{SQUARE_SANDBOX_APPLICATION_ID:'production'},
    {SQUARE_SANDBOX_REDIRECT_URL:'http://example.com/integrations/square/sandbox/callback'},
    {SQUARE_SANDBOX_APPLICATION_SECRET:''}]) assert.throws(() => configuration({...env,...update}));
  install({env:{},app:null,q:() => assert.fail('Database touched')});
  assert.equal(equal('abc','abc'),true); assert.equal(equal('abc','ab'),false);
  assert.equal(equal('é','a'),false); assert.equal(equal(['abc'],'abc'),false);
});
function harness(options = {}) {
  const routes = new Map(), queries = [];
  const app = {get:(p,...h) => routes.set('GET '+p,h),post:(p,...h) => routes.set('POST '+p,h)};
  const q = async (sql,args) => {queries.push({sql,args}); return options.query ? options.query(sql,args) : {rows:[]};};
  install({app,q,env,requireAdvertiserCustomerManager:(req,res,next) => {
    if (Number(req.params.customerId) !== req.session.user.id) return res.status(403).send('denied');
    return next();
  },fetcher:options.fetcher || (() => assert.fail('Unexpected network request'))});
  async function run(key,req) {
    const res = {code:200,status(n){this.code=n;return this;},set(){return this;},send(v){this.body=v;return this;},redirect(v){this.redirectTo=v;}};
    const handlers = routes.get(key); let i=0;
    await handlers[i++](req,res,async () => {while(i<handlers.length) await handlers[i++](req,res,()=>{});});
    return res;
  }
  return {run,queries};
}
test('unauthenticated and cross-customer access stop before database/network',async () => {
  const h=harness();
  assert.equal((await h.run('GET /integrations/square/sandbox/customers/:customerId',{session:{},params:{customerId:'1'}})).code,401);
  assert.equal((await h.run('GET /integrations/square/sandbox/customers/:customerId',{session:{user:{id:2}},params:{customerId:'1'}})).code,403);
  assert.equal(h.queries.length,0);
});
test('OAuth invalid state and changed session are rejected',async () => {
  for (const state of ['wrong',['right']]) {
    const h=harness();
    const res=await h.run('GET /integrations/square/sandbox/callback',{query:{state},session:{user:{id:1},squareSandboxPending:{state:'right',userId:1,customerId:1,until:Date.now()+10000}},params:{}});
    assert.equal(res.code,403); assert.equal(h.queries.length,0);
  }
});
test('connect rejects missing CSRF and callback consumes state once',async () => {
  const h=harness();
  const res=await h.run('POST /integrations/square/sandbox/customers/:customerId/connect',{params:{customerId:'1'},body:{},session:{user:{id:1}}});
  assert.equal(res.code,403);
  const req={params:{},query:{state:'right',code:'code'},session:{user:{id:1},save:cb=>cb(),squareSandboxPending:{state:'right',customerId:1,userId:1,until:Date.now()+10000}}};
  const callback=await h.run('GET /integrations/square/sandbox/callback',req);
  assert.equal(callback.code,403);
  assert.ok(h.queries.some(q=>q.sql.includes('DELETE FROM square_sandbox_states WHERE state_hash')));
});
test('installer is repeatable and rejects changed anchors',()=>{
  const {install:patch}=require('./install-square-sandbox');
  const source='app.listen(port, () => {';
  assert.equal(patch(patch(source)),patch(source));
  assert.throws(()=>patch('changed'));
});
test('successful callback encrypts credentials and never returns them to browser',async()=>{
  const token={access_token:'fake-access',refresh_token:'fake-refresh',merchant_id:'merchant-test',expires_at:'2030-01-01T00:00:00Z'};
  let consumed=false, calls=0;
  const h=harness({query:(sql)=>{
    if(sql.includes('RETURNING customer_id')) {if(consumed)return {rows:[]};consumed=true;return {rows:[{customer_id:1}]};}
    return {rows:[]};
  },fetcher:async(url,options)=>{
    calls++; assert.equal(url,'https://connect.squareupsandbox.com/oauth2/token');
    assert.equal(JSON.parse(options.body).grant_type,'authorization_code');
    return {ok:true,json:async()=>token};
  }});
  const makeReq=()=>({params:{},query:{state:'right',code:'test-code'},session:{user:{id:1},save:cb=>cb(),squareSandboxPending:{state:'right',customerId:1,userId:1,until:Date.now()+10000}}});
  const res=await h.run('GET /integrations/square/sandbox/callback',makeReq());
  assert.equal(res.redirectTo,'/integrations/square/sandbox/customers/1');
  const insert=h.queries.find(q=>q.sql.includes('INSERT INTO square_sandbox_connections'));
  assert.ok(insert); assert.ok(!insert.args[2].includes('fake-access'));
  assert.deepEqual(unseal(insert.args[2],configuration(env).key,'1'),token);
  assert.equal((await h.run('GET /integrations/square/sandbox/callback',makeReq())).code,403);
  assert.equal(calls,1);
});

test('existing advertiser user can start OAuth without a customers record', async () => {
  const h = harness({query:(sql,args)=>{
    if (sql.startsWith('SELECT id FROM')) {
      assert.equal(sql, "SELECT id FROM users WHERE id=$1 AND role='customer'");
      assert.equal(args[0], 17);
      return {rows:[{id:17}]};
    }
    return {rows:[]};
  }});
  const req = {params:{customerId:'17'},body:{csrf:'csrf-test'},session:{
    user:{id:17},squareSandboxCsrf:'csrf-test',save:cb=>cb()
  }};
  const res = await h.run('POST /integrations/square/sandbox/customers/:customerId/connect',req);
  const url = new URL(res.redirectTo);
  assert.equal(url.origin,'https://connect.squareupsandbox.com');
  assert.equal(url.pathname,'/oauth2/authorize');
  assert.equal(url.searchParams.get('state'),req.session.squareSandboxPending.state);
});
test('unknown advertiser is rejected before authorization state is created', async () => {
  const h = harness();
  const res = await h.run('POST /integrations/square/sandbox/customers/:customerId/connect',{
    params:{customerId:'17'},body:{csrf:'csrf-test'},session:{user:{id:17},squareSandboxCsrf:'csrf-test'}
  });
  assert.equal(res.code,404);
  assert.ok(!h.queries.some(x=>x.sql.startsWith('INSERT INTO square_sandbox_states')));
});
