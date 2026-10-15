'use strict';
const fs=require('fs'),vm=require('vm');
async function initialize(q){
 const source=fs.readFileSync(require.resolve('./server'),'utf8');
 const migration=source.slice(source.indexOf('async function initDb()'),source.indexOf('\nfunction daysBetween'));
 const statements=[];
 await vm.runInNewContext(migration+';initDb()', {q:async(sql,params=[])=>{if(/^\s*(?:CREATE|ALTER)\b/i.test(sql))statements.push([sql,params]);return {rows:[{count:0}]}}});
 // Fresh isolated database only. Defer dependencies instead of changing production migrations.
 statements.unshift([`CREATE TABLE IF NOT EXISTS organizations(id serial primary key,name text NOT NULL,public_heading text,public_description text,public_logo_url text,slug text)`,[]]);
 statements.unshift([`CREATE TABLE IF NOT EXISTS users(id serial primary key,name text,email text,password text,role text,account_status text,company_name text)`,[]]);
 let pending=statements;
 for(let pass=0;pending.length&&pass<10;pass++){
  const failed=[];
  for(const [sql,params] of pending){try{await q(sql,params)}catch(e){failed.push([sql,params,e.message])}}
  if(failed.length===pending.length)throw Error('Isolated schema dependency: '+JSON.stringify(failed.map(x=>[x[0].slice(0,100),x[2]])));
  pending=failed;
 }
 if(pending.length)throw Error('Isolated schema initialization incomplete');
 await q(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS customer_id int; ALTER TABLE organizations ADD COLUMN IF NOT EXISTS organization_type text; ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_name text; ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email text; ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_phone text; ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website text; ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notes text; ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true; ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(); ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`);
 await q(`ALTER TABLE spaces ADD COLUMN IF NOT EXISTS description text; ALTER TABLE spaces ADD COLUMN IF NOT EXISTS live_date timestamp; ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();`);
 await q(`ALTER TABLE organization_opportunities ADD COLUMN IF NOT EXISTS available_from date; ALTER TABLE organization_opportunities ADD COLUMN IF NOT EXISTS available_until date; CREATE TABLE IF NOT EXISTS mca_demo_workflows(contract_id int PRIMARY KEY REFERENCES contracts(id),stage int NOT NULL DEFAULT 0,artwork_name text,artwork_data bytea,updated_at timestamp DEFAULT now());`);
 await q(require('./responsibility-store').SCHEMA);
}
module.exports={initialize};
