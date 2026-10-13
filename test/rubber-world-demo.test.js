'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const seed=require('../seed-rubber-world-demo'),review=require('../rubber-world-review');
test('seeder creates only isolated magazine fixture, replays safely, and rolls back on identity collision',async()=>{
 let id=100,log=[];const q=async(sql,args=[])=>{log.push([sql,args]);const n=Math.max(0,...[...sql.matchAll(/\$(\d+)/g)].map(x=>+x[1]));assert.equal(n,args.length,sql);if(sql.startsWith('SELECT id FROM organizations WHERE id='))return {rows:[{id:args[0]}]};if(sql.startsWith('SELECT'))return {rows:[]};return {rows:[{id:id++}]};};
 const result=await seed.seed({query:q});assert.equal(result.programs.length,9);assert.equal(result.placements.length,6);assert.equal(result.opportunities.length,29);assert(result.ownerCreated);assert.equal(log.at(-1)[0],'COMMIT');
 for(const [sql,args]of log)if(sql.startsWith('UPDATE'))assert(sql.includes('organization_id=$2'));
 assert(!JSON.stringify(result).match(/HFHS|Henry Ford|CCPS/));
 const events=log.filter(([sql])=>sql.startsWith('INSERT INTO events')).flatMap(([,args])=>JSON.parse(args[0]));assert(events.length>0);assert(events.every(x=>x.created_at.slice(0,10)>=seed.START&&x.created_at.slice(0,10)<=seed.END));assert(events.filter(x=>x.type==='conversion').every(x=>x.value===1200));
 log=[];await seed.seed({query:async sql=>{log.push([sql]);return {rows:sql.includes('SELECT manifest')?[{manifest:result}]:[]};}});assert(!log.some(([s])=>s.startsWith('INSERT INTO events')));
 log=[];await assert.rejects(seed.seed({query:async sql=>{log.push([sql]);return {rows:sql.includes('SELECT id,name,email FROM users')?[{id:2}]:[]};}}),/owner already exists/);assert.equal(log.at(-1)[0],'ROLLBACK');
});
test('route allowlist rejects cross-organization and mutating GET paths',()=>{
 for(const path of ['/org-organization/39','/advertise/henry-ford-health-demo','/admin/archive-campaign/10','/r/10','/admin/users','/org-opportunity/edit/10'])assert.equal(review.routeAllowed(path,900),false,path);
 for(const path of ['/org-organization/900','/org-revenue-pipeline/location/10/revenue','/reports','/org-business-breakdown','/org-contract/1','/advertise/rubber-world-demo/location/1/opportunity/2'])assert(review.routeAllowed(path,900),path);
 assert.equal(review.validToken('invalid'),false);assert.equal(review.validToken(null),false);
});
test('magazine copy preserves internal paths and scripts',()=>{
 const value='<a href="/org-location/9?location_id=9">Location Programs</a><script>location.href="/events"</script>';
 assert.equal(review.presentation(value),'<a href="/org-location/9?location_id=9">Issue / Edition Channels</a><script>location.href="/events"</script>');
});
test('read-only middleware blocks POST and foreign record IDs before handlers',async()=>{
 let middleware;review.register({get(){},use(fn){middleware=fn;}},{q:async(sql)=>({rows:sql.includes('SELECT id FROM organizations')?[{id:900}]:sql.includes('qr_codes')?[{id:11}]:sql.includes('campaigns')?[{id:12}]:sql.includes('spaces')?[{id:10}]:[]})});
 // Extract version from source because it is a hash, not the access token.
 const hash=require('fs').readFileSync(require.resolve('../rubber-world-review'),'utf8').match(/const HASH='([^']+)'/)[1];
 for(const [path,method,query]of [['/reports','POST',{}],['/reports','GET',{organization_id:'39'}],['/admin/view-qr/999','GET',{}],['/org-contract/999','GET',{}],['/org-revenue-pipeline/location/999/revenue','GET',{}]]){
  let code,next=false;const res={setHeader(){},status(n){code=n;return this},send(){}};await middleware({path,method,query,session:{rubberWorldReview:{org:900,owner:901,version:hash,expires:review.EXPIRES}}},res,()=>{next=true;});assert.equal(code,403,path);assert.equal(next,false,path);
 }
});
test('fixture SQL executes transactionally in PostgreSQL with exact aggregate reconciliation',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 const source=require('fs').readFileSync(require.resolve('../seed-rubber-world-demo'),'utf8')+require('fs').readFileSync(require.resolve('../rubber-world-catalogue'),'utf8'),tables=new Map();
 for(const m of source.matchAll(/INSERT INTO (\w+)\s*\(([^)]+)\)/g)){if(!tables.has(m[1]))tables.set(m[1],new Set(['id']));for(const col of m[2].split(','))tables.get(m[1]).add(col.trim());}
 const type=col=>col==='id'?'SERIAL PRIMARY KEY':col==='manifest'?'JSONB':col==='email'?'VARCHAR(255)':col==='photo_data'?'BYTEA':['vivid_click_id','vivid_session_id'].includes(col)?'TEXT':col.endsWith('_id')?'INTEGER':col.startsWith('is_')?'BOOLEAN':/(_at|_date)$/.test(col)?'TIMESTAMP':/^(price|annual_price|value|total_contract_value|annual_cost|total_cost|annual_impressions|avg_customer_value|contract_days|suggested_term_length|display_order|estimated_value)$/.test(col)?'NUMERIC':'TEXT';
 for(const [table,cols]of tables)await db.exec(`CREATE TABLE ${table} (${[...cols].map(c=>c+' '+type(c)).join(',')}${table==='vivid_evaluation_fixtures'?', UNIQUE(fixture_key)':''})`);
 await db.exec('CREATE FUNCTION pg_advisory_xact_lock(bigint) RETURNS void LANGUAGE sql AS $$ SELECT $$;');
 const client={query:(sql,args)=>db.query(sql,args)},result=await seed.seed(client);
 const rows=(await db.query("SELECT type,COUNT(*)::int AS count,SUM(value)::numeric AS value FROM events GROUP BY type")).rows;
 for(const [event,key]of [['scan','scans'],['destination_click','clicks'],['conversion','conversions']])assert.equal(rows.find(r=>r.type===event).count,result.totals[key]);
 assert.equal(Number(rows.find(r=>r.type==='conversion').value),result.totals.revenue);
 assert.equal(result.programs.length,9);assert.equal(result.locations.length,11);
 const before=(await db.query('SELECT COUNT(*)::int AS count FROM organization_opportunities')).rows[0].count;
 const replay=await seed.seed(client);assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM organization_opportunities')).rows[0].count,before);assert(replay.alreadyLoaded);assert.equal(replay.organizationId,result.organizationId);
 const pending=(await db.query("SELECT COUNT(*)::int AS count,SUM(price)::numeric AS total FROM organization_advertising_requests WHERE status='Pending'")).rows[0];assert.equal(pending.count,3);assert.equal(Number(pending.total),8100);
 const owner=(await db.query('SELECT email FROM users WHERE id=$1',[result.ownerId])).rows[0];assert.equal(owner.email,seed.EMAIL);
 await db.exec('ALTER TABLE spaces ADD COLUMN is_archived BOOLEAN DEFAULT false');
 const ai=await require('../rubber-world-ai-demo').load(client.query,result.organizationId).catch(async e=>{await db.close();throw e});
 assert.equal(ai.requests.length,3);assert.equal(ai.contracts.length,6);assert.equal(ai.advertisers.length,3);assert.equal(ai.metrics.find(x=>x.type==='conversion').count,105);assert.equal(ai.opportunities.filter(x=>x.status==='Available').length,26);
 const foreign=await require('../rubber-world-ai-demo').load(client.query,999999);assert.equal(foreign.opportunities.length,0);assert.equal(foreign.metrics.length,0);
 await db.close();
});

test('demo AI replaces native links in place without enabling production AI routes',()=>{
 const ai=require('../rubber-world-ai-demo'),privateAi=require('../ai-preview-access');
 const html='<nav><a class="nav-item" href="/org-weekly-ai-report?organization_id=40">Weekly AI Report</a><a href="/org-ai-readiness?organization_id=40">AI Readiness</a></nav>';
 const output=privateAi.withoutAiLinks(ai.navigation(html));
 assert(output.includes('class="nav-item"'));assert(output.includes('/rubber-world-demo/ai/weekly-report?organization_id=40'));assert(output.includes('AI Readiness'));assert.equal((output.match(/Weekly AI Report/g)||[]).length,1);
 assert.equal(review.routeAllowed('/org-ai-campaign-operator',40),false);
 for(const p of ai.paths)assert(review.routeAllowed(p,40));
});
