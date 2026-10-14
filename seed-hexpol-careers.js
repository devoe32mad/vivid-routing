'use strict';
const {Pool}=require('pg');
const {jobs,MAIN}=require('./hexpol-careers');
async function seed(client) {
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(88125)');
    const guard=await client.query(`SELECT c.id FROM campaigns c
      JOIN qr_campaigns qc ON qc.campaign_id=c.id AND qc.qr_id=125 AND COALESCE(qc.is_active,true)=true
      JOIN qr_codes qr ON qr.id=qc.qr_id AND qr.space_id=148
      WHERE c.id=88 AND c.name='Online Job Listings' AND LOWER(TRIM(c.advertiser))='hexpol'
      AND EXISTS (SELECT 1 FROM campaign_destinations cd WHERE cd.campaign_id=c.id AND cd.destination_url=$1 AND COALESCE(cd.is_active,true)=true)
      FOR UPDATE OF c`,[MAIN]);
    if(!guard.rows.length) {await client.query('ROLLBACK');return {skipped:true};}
    // One-time marker: subsequent restarts never restore removed/disabled jobs.
    await client.query('CREATE TABLE IF NOT EXISTS vivid_setup_migrations (key TEXT PRIMARY KEY, completed_at TIMESTAMPTZ DEFAULT NOW())');
    const done=await client.query('SELECT key FROM vivid_setup_migrations WHERE key=$1',['hexpol-careers-88-27-v1']);
    if(done.rows.length){await client.query('COMMIT');return {alreadyApplied:true};}
    let inserted=0;
    for (const [index,job] of jobs.entries()) {
      const r=await client.query(`INSERT INTO campaign_destinations
        (campaign_id,name,destination_type,destination_url,estimated_value,display_order,is_active)
        SELECT 88,$1,'website',$2,0,$3,true
        WHERE NOT EXISTS(SELECT 1 FROM campaign_destinations WHERE campaign_id=88 AND destination_url=$2)
        RETURNING id`,[job.title+' — '+job.location+' — '+job.requisition,job.url,index+2]);
      inserted+=r.rows.length;
    }
    await client.query('INSERT INTO vivid_setup_migrations(key) VALUES($1)',['hexpol-careers-88-27-v1']);
    await client.query('COMMIT');return {inserted,expectedJobs:27};
  }catch(e){await client.query('ROLLBACK');throw e;}
}
if(require.main===module){
  (async()=>{
    if(!process.env.DATABASE_URL) return console.log('HEXPOL careers setup: no database; skipped');
    const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
    try{const client=await pool.connect();try{console.log('HEXPOL careers setup:',JSON.stringify(await seed(client)));}finally{client.release();}}
    catch(e){console.error('HEXPOL careers setup failed:',e.message);}
    finally{await pool.end();}
  })();
}
module.exports={seed};
