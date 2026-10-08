"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const {aiPreviewMiddleware,canPreviewAi,canViewPerformanceCenter} = require("../ai-preview-access");
const {registerMarketingCommandCenterRoutes} = require("../marketing-command-center-routes");
const actor = {id:39,role:"customer"};
function render(user,extra={}) {
  const req={method:"GET",path:"/my-setup",session:{user,...extra}};
  const res={locals:{},getHeader:()=>"text/html",send(body){return body;}};
  aiPreviewMiddleware(req,res,()=>{});
  return res.send('<nav><a href="/my-setup">My Setup</a><a href="/reports">Reports</a><a href="/admin/ai-insights">Insights</a><a href="/admin/ai-approval-center">AI approvals</a></nav>');
}
test("enabled customer receives marketing navigation without private AI privileges",()=>{
  const html=render(actor);
  assert.match(html,/id="marketing-command-center-nav"/);
  assert.match(html,/href="\/admin\/marketing-command-center"/);
  assert.match(html,/>Reports</);
  assert.doesNotMatch(html,/AI approvals|>Insights</);
  assert.equal(canPreviewAi({user:actor}),false);
  assert.equal(canViewPerformanceCenter({user:actor}),false);
  for(const user of [undefined,{id:40,role:"customer"},{id:39,role:"super_admin"}])
    assert.doesNotMatch(render(user),/marketing-command-center-nav/);
  assert.doesNotMatch(render(actor,{orgUser:{id:39}}),/marketing-command-center-nav/);
});
test("customer marketing dashboard remains restricted to its own account",async()=>{
  const routes={},reads=[];
  registerMarketingCommandCenterRoutes({app:{get:(p,...f)=>routes[p]=f,post:()=>{}},q:async(sql,params)=>{reads.push({sql,params});return {rows:[]};},page:(_,body)=>body,requireLogin:(_q,_s,next)=>next(),requireOrganizationPermission:()=>()=>{},env:{}});
  async function run(query={}) {
    const req={session:{user:actor},query};
    const res={code:200,status(code){this.code=code;return this;},set(){},send(body){this.body=body;return this;}};
    const stack=routes['/admin/marketing-command-center'];let i=0;
    await (function next(){return stack[i++]?.(req,res,next);})();return res;
  }
  const result=await run();
  assert.equal(result.code,200);assert.match(result.body,/Connect another platform/);
  assert.equal(reads.find(r=>/FROM campaigns c/.test(r.sql)).params[0],39);
  reads.length=0;
  assert.equal((await run({account:"17"})).code,403);assert.equal(reads.length,0);
});
