'use strict';
// Canonical ownership is stored once per opportunity lifecycle, never in the browser.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS organization_sales_reps (
 id SERIAL PRIMARY KEY, organization_id integer NOT NULL REFERENCES organizations(id),
 dataset text NOT NULL DEFAULT 'live' CHECK(dataset IN ('live','demo')),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100), user_id integer REFERENCES users(id),
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,dataset,name), UNIQUE(organization_id,dataset,id)
);
CREATE TABLE IF NOT EXISTS organization_responsibility (
 organization_id integer NOT NULL REFERENCES organizations(id), dataset text NOT NULL DEFAULT 'live',
 root_kind text NOT NULL CHECK(root_kind IN ('opportunity','request','contract')),root_id integer NOT NULL CHECK(root_id>0),
 rep_id integer, next_action text NOT NULL DEFAULT '', due_date date, notes text NOT NULL DEFAULT '',
 follow_up_status text NOT NULL DEFAULT 'Not started' CHECK(follow_up_status IN ('Not started','In progress','Waiting','Complete')),
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), updated_by text NOT NULL,
 PRIMARY KEY(organization_id,dataset,root_kind,root_id),
 FOREIGN KEY(organization_id,dataset,rep_id) REFERENCES organization_sales_reps(organization_id,dataset,id)
);
CREATE TABLE IF NOT EXISTS organization_responsibility_audit (
 id bigserial PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id),dataset text NOT NULL,
 root_kind text NOT NULL,root_id integer NOT NULL, version integer NOT NULL,
 rep_id integer, next_action text NOT NULL,due_date date,follow_up_status text NOT NULL,notes text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now(),changed_by text NOT NULL,
 UNIQUE(organization_id,dataset,root_kind,root_id,version)
);`;
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const date=v=>v?new Date(v).toISOString().slice(0,10):'';
const validDate=s=>!s||/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&date(s)===s;
const key=(kind,id)=>kind+':'+Number(id);
const closed=s=>/^(cancelled|canceled|rejected|declined|expired|archived|terminated)$/i.test(String(s||'').trim());
const active=s=>/^(active|approved|sold|scheduled|signed|executed)$/i.test(String(s||'').trim());
function buildModel(opportunities,requests,contracts,assignments=[],reps=[],today=date(new Date())){
 const entities=new Map(), roots=new Map();
 for(const [kind,rows] of [['opportunity',opportunities],['request',requests],['contract',contracts]])for(const r of rows)entities.set(key(kind,r.id),{...r,kind});
 function resolve(e,seen=new Set()){
  const own=key(e.kind,e.id);if(seen.has(own))return own;seen.add(own);
  // Preserve ownership through renewal chains, including contracts without a direct opportunity link.
  const refs=e.kind==='contract'?[['contract',e.renewed_from_contract_id],['opportunity',e.opportunity_id],['request',e.advertising_request_id]]:e.kind==='request'?[['opportunity',e.opportunity_id]]:[];
  for(const [kind,id] of refs){const parent=entities.get(key(kind,id));if(parent)return resolve(parent,seen);}
  return own;
 }
 for(const e of entities.values()){e.root=resolve(e);if(!roots.has(e.root))roots.set(e.root,{key:e.root,entities:[]});roots.get(e.root).entities.push(e);}
 const owners=new Map(assignments.map(a=>[key(a.root_kind,a.root_id),a]));const people=new Map(reps.map(r=>[Number(r.id),r]));
 for(const root of roots.values()){
  const e=entities.get(root.key),owned=owners.get(root.key)||{};
  Object.assign(root,{kind:e.kind,id:Number(e.id),title:e.title||e.opportunity_name||e.contract_name||'Untitled opportunity',location_id:Number(e.space_id||e.location_id)||null,program_id:Number(e.program_id)||null,location_name:e.location_name||'',program_name:e.program_name||'',...owned});
  root.rep_id=Number(owned.rep_id)||null;root.rep_name=people.get(root.rep_id)?.name||'Unassigned';root.version=Number(owned.version)||0;
  const latest=rows=>rows.sort((a,b)=>Number(b.id)-Number(a.id))[0];
  const cs=root.entities.filter(x=>x.kind==='contract'&&!closed(x.status));
  const rs=root.entities.filter(x=>x.kind==='request'&&!closed(x.status)&&x.setup_status!=='Demo Archived');
  const c=latest(cs.filter(x=>active(x.status))),r=latest(rs.filter(x=>active(x.status)));
  const pending=latest(rs.filter(x=>!active(x.status)))||latest(cs.filter(x=>!active(x.status)));
  const selected=c||r||pending||e;
  root.status=c||r||active(e.status)?'approved':pending||/^pending$/i.test(e.status)?'pending':e.kind==='opportunity'&&/^available$/i.test(e.status)&&e.is_active!==false?'available':'other';
  if(root.status==='available'&&((e.available_from&&date(e.available_from)>today)||(e.available_until&&date(e.available_until)<today)))root.status='other';
  root.value=Number(selected.total_contract_value??selected.price??selected.annual_price??0);
  root.stage_date=date(selected.approved_at||selected.submitted_at||selected.created_at);
  root.business_name=selected.business_name||selected.advertiser_name||rs[0]?.business_name||'';
  root.source_kind=selected.kind;root.source_id=Number(selected.id);
  root.renewals=cs.filter(x=>active(x.status)&&!cs.some(n=>Number(n.renewed_from_contract_id)===Number(x.id)&&active(n.status))).map(x=>({id:Number(x.id),date:date(x.renewal_date||x.expiration_date||x.end_date),value:Number(x.total_contract_value||0)})).filter(x=>x.date);
 }
 return {entities,roots:[...roots.values()],reps};
}
async function load(q,scope){
 const org=scope.organizationId,wide=scope.hasOrganizationWideAccess,ids=scope.allowedLocationIds;
 const results=await Promise.all([
  q(`SELECT oo.*,s.name AS location_name,p.name AS program_name FROM organization_opportunities oo LEFT JOIN spaces s ON s.id=oo.space_id AND s.organization_id=oo.organization_id LEFT JOIN organization_programs p ON p.id=oo.program_id AND p.organization_id=oo.organization_id WHERE oo.organization_id=$1 AND ($2::boolean OR oo.space_id=ANY($3::int[]))`,[org,wide,ids]),
  q(`SELECT ar.*,s.name AS location_name FROM organization_advertising_requests ar LEFT JOIN spaces s ON s.id=ar.location_id AND s.organization_id=ar.organization_id WHERE ar.organization_id=$1 AND ($2::boolean OR ar.location_id=ANY($3::int[]))`,[org,wide,ids]),
  q(`SELECT c.*,s.name AS location_name,a.name AS advertiser_name FROM contracts c LEFT JOIN spaces s ON s.id=c.location_id AND s.organization_id=c.organization_id LEFT JOIN advertisers a ON a.id=c.advertiser_id AND a.organization_id=c.organization_id WHERE c.organization_id=$1 AND ($2::boolean OR c.location_id=ANY($3::int[]))`,[org,wide,ids]),
  q('SELECT * FROM organization_responsibility WHERE organization_id=$1 AND dataset=$2',[org,scope.dataset]),
  q('SELECT * FROM organization_sales_reps WHERE organization_id=$1 AND dataset=$2 ORDER BY name,id',[org,scope.dataset])
 ]);
 return buildModel(...results.map(r=>r.rows));
}
async function save(q,scope,root,input,actor){
 if(!scope.canEdit)throw fail('You do not have permission to change responsibility.',403);
 const rep=input.rep_id===''||input.rep_id==null?null:Number(input.rep_id),version=Number(input.version);
 const next=String(input.next_action||'').trim(),notes=String(input.notes||'').trim(),due=String(input.due_date||''),status=String(input.follow_up_status||'Not started');
 if((rep!==null&&(!Number.isSafeInteger(rep)||rep<1))||!Number.isSafeInteger(version)||version<0||next.length>300||notes.length>2000||!validDate(due)||!['Not started','In progress','Waiting','Complete'].includes(status))throw fail('Check the responsible party, date, and follow-up fields.');
 if(rep!==null&&!(await q('SELECT id FROM organization_sales_reps WHERE id=$1 AND organization_id=$2 AND dataset=$3 AND is_active=true',[rep,scope.organizationId,scope.dataset])).rows.length)throw fail('Select an active sales rep in this organization.',403);
 // The version condition protects concurrent edits. The audit snapshot is in the same SQL statement.
 const result=await q(`WITH saved AS (
 INSERT INTO organization_responsibility(organization_id,dataset,root_kind,root_id,rep_id,next_action,due_date,follow_up_status,notes,updated_by)
 SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 WHERE $11::int=0
 ON CONFLICT(organization_id,dataset,root_kind,root_id) DO NOTHING RETURNING *
 ), updated AS (
 UPDATE organization_responsibility SET rep_id=$5,next_action=$6,due_date=$7,follow_up_status=$8,notes=$9,updated_by=$10,updated_at=now(),version=version+1
 WHERE organization_id=$1 AND dataset=$2 AND root_kind=$3 AND root_id=$4 AND version=$11 AND $11::int>0 RETURNING *
 ), changed AS (SELECT * FROM saved UNION ALL SELECT * FROM updated), audit AS (
 INSERT INTO organization_responsibility_audit(organization_id,dataset,root_kind,root_id,version,rep_id,next_action,due_date,follow_up_status,notes,changed_by)
 SELECT organization_id,dataset,root_kind,root_id,version,rep_id,next_action,due_date,follow_up_status,notes,updated_by FROM changed RETURNING id
 ) SELECT version FROM changed`,[scope.organizationId,scope.dataset,root.kind,root.id,rep,next,due||null,status,notes,actor,version]);
 if(!result.rows.length)throw fail('Someone updated this record. Reload it before saving your changes.',409);
 return result.rows[0];
}
async function migrate(){if(!process.env.DATABASE_URL)return;const {Pool}=require('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(202610131)');await client.query(SCHEMA);await client.query(`INSERT INTO organization_sales_reps(organization_id,dataset,name) SELECT id,'demo',rep FROM organizations CROSS JOIN (VALUES ('Jane Doe'),('Bill Smith')) people(rep) WHERE (id=13 AND name='CCPS') OR slug IN ('rubber-world-demo','henry-ford-health-demo') ON CONFLICT DO NOTHING`);await client.query('COMMIT');console.log('Persistent responsibility schema ready.');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await pool.end();}}
module.exports={SCHEMA,buildModel,load,save,migrate,validDate,date,key,fail};
