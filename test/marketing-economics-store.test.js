"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createMarketingEconomicsStore}=require("../marketing-economics-store");
test("account economics are isolated by owner and allow an unknown margin",async()=>{
  const calls=[],q=async(sql,args=[])=>{calls.push({sql,args});if(sql.includes("SELECT gross_margin_pct"))return {rows:[{gross_margin_pct:"40.00",updated_at:"now"}]};return {rows:[{gross_margin_pct:args[1]===null?null:String(args[1]),updated_at:"now"}]};};
  const store=createMarketingEconomicsStore(q);
  assert.equal((await store.load(17)).gross_margin_pct,"40.00");
  await store.save(17,40);await store.save(17,null);
  assert.deepEqual(calls.filter(c=>c.args.length).map(c=>c.args),[[17],[17,40],[17,null]]);
  assert.match(calls[0].sql,/CHECK\(gross_margin_pct IS NULL/);
});
