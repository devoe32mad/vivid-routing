'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const express=require('express');
const session=require('express-session');
const {middleware,htmlUrls,install}=require('../demo-session-isolation');
test('both demos refresh independently in one browser without replacing the normal login',async()=>{
 const app=express();app.use(middleware(session,{secret:'test-secret-for-demo-session-isolation',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax'}}));
 app.get('/:key-review/:token/:view',(req,res)=>{
  if(req.params.token!=='test-valid')return res.sendStatus(404);
  req.session.regenerate(error=>{if(error)throw error;req.session[req.params.key==='ccps'?'ccpsReview':'rubberWorldReview']={valid:true};req.session.save(()=>res.redirect('/home'));});
 });
 app.get('/login-test',(req,res)=>{req.session.user='normal';res.send('normal');});
 app.get('/home',(req,res)=>res.send(`<html><body>${req.session.ccpsReview?'CCPS':req.session.rubberWorldReview?'Rubber World':req.session.user||'none'}<a href="/reports">Reports</a><img src="/photo"/><form action="/reports"><input value="x"/></form><script>fetch('/data')</script></body></html>`));
 app.get('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/home')));
 const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;const cookies=new Map();
 const get=async path=>{const response=await fetch(base+path,{redirect:'manual',headers:{Cookie:[...cookies.values()].join('; ')}});const cookie=response.headers.get('set-cookie');if(cookie){const pair=cookie.split(';')[0];cookies.set(pair.split('=')[0],pair);}return response;};
 try{
 await get('/login-test');
 for(const key of ['ccps','rubber-world']){
  let r=await get(`/${key}-review/test-valid/marketplace`);assert.equal(r.status,307);assert.equal(r.headers.get('location'),`/demo/${key}/${key}-review/test-valid/marketplace`);
  r=await get(r.headers.get('location'));assert.match(r.headers.get('set-cookie'),new RegExp(`Path=/demo/${key}`));assert.equal(r.headers.get('location'),`/demo/${key}/home`);
 }
 for(let i=0;i<3;i++)for(const [key,label]of [['ccps','CCPS'],['rubber-world','Rubber World']]){
  const html=await (await get(`/demo/${key}/home`)).text();assert.ok(html.includes(`<body>${label}`));assert.ok(html.includes(`href="/demo/${key}/reports"`));assert.ok(html.includes(`fetch('/demo/${key}/data')`));assert.ok(html.includes('<input value="x"/>'));
 }
 assert.ok((await (await get('/home')).text()).includes('<body>normal'));
 assert.equal((await get('/demo/ccps/rubber-world-review/test-valid/enterprise')).status,404);
 assert.equal((await get('/demo/ccps/ccps-review/invalid/enterprise')).status,404);
 await get('/demo/ccps/logout');assert.equal((await get('/demo/ccps/home')).status,401);
 assert.ok((await (await get('/demo/rubber-world/home')).text()).includes('<body>Rubber World'));
 }finally{await new Promise(r=>server.close(r));}
});
test('URL rewriting preserves external, fragment, already scoped and self-closing markup; install is idempotent',()=>{
 const input='<a href="https://example.com/">A</a><a href="//example.com/">B</a><a href="#x">C</a><a href="/demo/ccps/home">D</a><input value="x"/>';
 assert.equal(htmlUrls(input,'/demo/ccps'),input);
 const s=install('app.use(session({\n    store: new PgSession({}));');assert.equal(install(s),s);
});
