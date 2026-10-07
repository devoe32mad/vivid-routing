"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');
const {install}=require('../install-sponsorship-post-login-return');
const source=install(fs.readFileSync(require.resolve('../server.js'),'utf8'));
function response(){return {code:200,status(n){this.code=n;return this;},send(body){this.body=body;return this;},redirect(url){this.url=url;return this;}};}
function session(extra={}){return {...extra,save(cb){cb();}};}
const guardStart=source.indexOf('function requireLogin(');
const guardEnd=source.indexOf('function requireSuperAdmin(',guardStart);
const requireLogin=vm.runInNewContext(source.slice(guardStart,guardEnd)+';requireLogin');
const loginStart=source.indexOf('app.post("/login"');
const loginEnd=source.indexOf('\n/*',source.indexOf('\n});',loginStart));
function loginHandler(){let handler;vm.runInNewContext(source.slice(loginStart,loginEnd),{app:{post(path,fn){handler=fn;}},q:async()=>({rows:[{id:7,email:'advertiser@example.test',role:'customer',password:'hashed'}]}),isHashedPassword:()=>true,verifyHashedPassword:async p=>p==='correct',console});return handler;}

test('logged-out request 52 retains its exact destination through successful login',async()=>{
  const req={method:'GET',path:'/admin/qr-setup-choice',query:{space_id:'36',marketplace_request_id:'52'},session:session()};
  let res=response();requireLogin(req,res,()=>assert.fail('must authenticate'));
  assert.equal(res.url,'/login');
  assert.equal(req.session.afterLoginReturn,'/admin/qr-setup-choice?space_id=36&marketplace_request_id=52');
  req.body={email:'advertiser@example.test',password:'correct'};
  res=response();await loginHandler()(req,res);
  assert.equal(res.url,'/admin/qr-setup-choice?space_id=36&marketplace_request_id=52');
  assert.equal(req.session.afterLoginReturn,undefined);
  assert.equal(req.session.user.id,7);
});
test('failed login keeps setup context without signing in',async()=>{
  const req={session:session({afterLoginReturn:'/admin/new-location?marketplace_request_id=52'}),body:{email:'advertiser@example.test',password:'wrong'}};
  const res=response();await loginHandler()(req,res);
  assert.match(res.body,/Invalid login/);assert.equal(req.session.user,undefined);
  assert.equal(req.session.afterLoginReturn,'/admin/new-location?marketplace_request_id=52');
});
test('login rejects external, malformed and extra-query return destinations',async()=>{
  for(const dest of ['https://example.com','//example.com','/admin/new-location?marketplace_request_id=52&next=https://example.com','/admin/qr-setup-choice?space_id=-1&marketplace_request_id=52']){
    const req={session:session({afterLoginReturn:dest}),body:{email:'advertiser@example.test',password:'correct'}};
    const res=response();await loginHandler()(req,res);assert.equal(res.url,'/platform-login');
  }
});
test('authenticated users still reach the existing ownership checks',()=>{
  let called=false;const req={session:session({user:{id:8}})};
  requireLogin(req,response(),()=>called=true);assert.equal(called,true);
  const route=source.slice(source.indexOf('  "/admin/qr-setup-choice",'),source.indexOf('  "/admin/qr-setup-choice",')+2800);
  assert.match(route,/ar.created_vivid_user_id = \$1/);
  assert.match(route,/This advertising setup request is not available for your account/);
});
test('new advertiser password creation redirects with the approved request ID',async()=>{
  const start=source.indexOf('app.post(\n  "/vivid-account-setup/:token",');
  const end=source.indexOf('app.get(',start);let handler;
  const client={query:async sql=>({rows:sql.includes('SELECT')?[{request_id:52,vivid_user_id:7,organization_id:13,location_id:36}]:[]}),release(){}};
  vm.runInNewContext(source.slice(start,end),{app:{post(path,fn){handler=fn;}},pool:{connect:async()=>client},crypto:require('crypto'),hashPassword:async()=> 'hash',console});
  const req={params:{token:'secure-token'},body:{password:'password123',confirm_password:'password123'},session:session()};
  const res=response();await handler(req,res);
  assert.equal(res.url,'/admin/new-location?marketplace_request_id=52');
  assert.equal(req.session.marketplaceSetup.request_id,52);
});
test('installer is idempotent',()=>assert.equal(install(source),source));
