"use strict";
const assert=require('node:assert/strict');
const m=require('./seed-moflo-evaluation');
async function run(){
  const totals={scans:0,clicks:0,conversions:0,revenue:0};
  for(const [i,p] of m.placements.entries()){
    const rows=m.buildEvents(p,i,p.campaign+1,i+1,p.campaign+1);
    const scanned=new Set(), clicked=new Set(), days=new Set();
    for(const row of rows){
      assert(row.created_at.slice(0,10)>=m.START && row.created_at.slice(0,10)<=m.END);
      if(row.type==='scan'){assert(!scanned.has(row.vivid_click_id));scanned.add(row.vivid_click_id);days.add(row.created_at.slice(0,10));totals.scans++;}
      else if(row.type==='offer'){assert(scanned.has(row.vivid_click_id));clicked.add(row.vivid_click_id);totals.clicks++;}
      else {assert(clicked.has(row.vivid_click_id));totals.conversions++;totals.revenue+=row.value;}
    }
    assert.equal(days.size,90);
  }
  assert.deepEqual(totals,{scans:4950,clicks:1694,conversions:202,revenue:21355});
  let id=100,log=[];
  const client={query:async(sql,args=[])=>{
    log.push(sql);
    const nums=[...sql.matchAll(/\$(\d+)/g)].map(x=>+x[1]);
    assert.equal(nums.length?Math.max(...nums):0,args.length,'SQL parameter count: '+sql);
    if(sql.includes('SELECT manifest'))return {rows:[]};
    if(sql.includes('SELECT id FROM campaigns'))return {rows:[{id:1},{id:2},{id:3}]};
    if(sql.includes('FILTER(WHERE'))return {rows:[totals]};
    return {rows:[{id:id++}]};
  }};
  const result=await m.seed(client);
  assert.equal(result.locations.length,4);assert.equal(result.placements.length,6);
  assert.equal(result.opportunities.length,6);assert.equal(result.contracts.length,6);
  assert.equal(log.at(-1),'COMMIT');
  let replay=[];
  await m.seed({query:async(sql)=>{replay.push(sql);return {rows:sql.includes('SELECT manifest')?[{manifest:result}]:[]};}});
  assert(!replay.some(s=>s.includes('INSERT INTO events')),'replay must not duplicate activity');
  let failed=[];
  await assert.rejects(m.seed({query:async(sql)=>{failed.push(sql);return {rows:[]};}}),/identity check/);
  assert.equal(failed.at(-1),'ROLLBACK');
  assert(!failed.some(s=>s.includes('INSERT INTO campaigns')));
  console.log('PASS: 90-day attribution, exact totals, SQL parameters, replay protection, identity guard and rollback.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
