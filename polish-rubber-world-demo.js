'use strict';
const {KEY,EMAIL,SLUG}=require('./seed-rubber-world-demo');
const store=require('./responsibility-store');
async function polish(client){
 const q=(s,p)=>client.query(s,p);
 await q('BEGIN');
 try{
  await q('SELECT pg_advisory_xact_lock(202610144)');
  const record=(await q(`SELECT f.manifest,o.id,o.customer_id FROM vivid_evaluation_fixtures f JOIN organizations o ON o.id=f.organization_id JOIN users u ON u.id=o.customer_id WHERE f.fixture_key=$1 AND o.slug=$2 AND LOWER(u.email)=$3 FOR UPDATE OF f`,[KEY,SLUG,EMAIL])).rows[0];
  if(!record)throw Error('Verified Rubber World fixture missing');
  if(record.manifest.polishV2){await q('COMMIT');return {alreadyApplied:true};}
  const org=Number(record.id),owner=Number(record.customer_id);
  const campaigns=(await q('SELECT id,advertiser_id FROM campaigns WHERE organization_id=$1 AND user_id=$2 AND is_test=true ORDER BY id',[org,owner])).rows;
  if(campaigns.length!==3)throw Error('Unexpected Rubber World campaign count');
  await q("UPDATE campaigns SET end_date='2026-11-12'::date WHERE organization_id=$1 AND user_id=$2 AND is_test=true AND id=ANY($3::int[])",[org,owner,campaigns.map(c=>c.id)]);
  await q(`INSERT INTO campaign_schedules(qr_id,campaign_id,days_of_week,start_time,end_time,priority,is_active)
    SELECT qc.qr_id,qc.campaign_id,'0,1,2,3,4,5,6','00:00','23:59',50,true FROM qr_campaigns qc JOIN campaigns c ON c.id=qc.campaign_id JOIN qr_codes qr ON qr.id=qc.qr_id JOIN spaces s ON s.id=qr.space_id
    WHERE c.organization_id=$1 AND c.user_id=$2 AND c.is_test=true AND s.organization_id=$1 AND COALESCE(qc.is_active,true) AND qc.ended_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM campaign_schedules cs WHERE cs.qr_id=qc.qr_id AND cs.campaign_id=qc.campaign_id AND cs.is_active=true)`,[org,owner]);
  await require('./website-page-tracking').createTracker(q).ensureSchema();
  await q(`INSERT INTO campaign_website_visits(scan_event_id,campaign_id,qr_id,vivid_click_id,page_url,page_name,created_at)
    SELECT e.id,e.campaign_id,e.qr_id,e.vivid_click_id,'https://example.com/demo-product-information','Product information - simulated demo',e.created_at+interval '20 seconds'
    FROM events e JOIN campaigns c ON c.id=e.campaign_id JOIN qr_codes qr ON qr.id=e.qr_id JOIN spaces s ON s.id=qr.space_id
    WHERE c.organization_id=$1 AND c.user_id=$2 AND c.is_test=true AND s.organization_id=$1 AND e.type='scan' AND e.vivid_click_id IS NOT NULL AND MOD(e.id,4)=0
    ON CONFLICT(campaign_id,vivid_click_id,page_url) DO NOTHING`,[org,owner]);
  const scope={organizationId:org,dataset:'demo',hasOrganizationWideAccess:true,allowedLocationIds:[],canEdit:true};
  const model=await store.load(q,scope);
  if(model.reps.length<2)throw Error('Demo sales roster missing');
  for(const [i,r]of model.roots.entries())if(!r.rep_id)await store.save(q,scope,r,{rep_id:model.reps[i%model.reps.length].id,version:r.version,next_action:r.next_action,notes:r.notes,due_date:store.date(r.due_date),follow_up_status:r.follow_up_status},'Rubber World demo completion');
  // Locked fictional accounts provide native advertiser relationship owner labels.
  const users=[];
  for(const name of ['Jane Doe','Bill Smith']){
   const email='rubber-world-demo-'+name.toLowerCase().replace(' ','-')+'@example.invalid';
   let user=(await q('SELECT id,name,account_status,password FROM users WHERE email=$1',[email])).rows[0];
   if(user&&(user.name!==name||user.account_status!=='pending'||user.password))throw Error('Demo rep identity collision');
   if(!user)user=(await q("INSERT INTO users(name,email,password,role,account_status,company_name) VALUES($1,$2,NULL,'customer','pending','Rubber World Demo - fictional internal owner') RETURNING id",[name,email])).rows[0];
   users.push(user.id);
  }
  for(const [i,c]of campaigns.entries())await q('UPDATE advertisers SET account_owner_user_id=$1 WHERE id=$2 AND organization_id=$3 AND customer_id=$4 AND account_owner_user_id IS NULL',[users[i%users.length],c.advertiser_id,org,owner]);
  const manifest={...record.manifest,polishV2:true};
  await q('UPDATE vivid_evaluation_fixtures SET manifest=$1::jsonb WHERE fixture_key=$2 AND organization_id=$3',[JSON.stringify(manifest),KEY,org]);
  await q('COMMIT');return {organizationId:org,campaigns:campaigns.length};
 }catch(e){await q('ROLLBACK');throw e;}
}
async function main(){if(!process.env.DATABASE_URL)return;const {Pool}=require('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});let c;try{c=await pool.connect();console.log('RUBBER WORLD POLISH:',await polish(c));}finally{c?.release();await pool.end();}}
if(require.main===module)main().catch(e=>{console.error('RUBBER WORLD POLISH ERROR:',e.message);});
module.exports={polish};
