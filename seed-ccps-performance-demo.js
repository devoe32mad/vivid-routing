'use strict';
const KEY='ccps-performance-example-v1';
function events(){
 const rows=[];
 for(let day=6;day<=13;day++)for(let i=0;i<30;i++){
  const at=`2026-10-${String(day).padStart(2,'0')}T${String(10+Math.floor(i/5)).padStart(2,'0')}:${String(i%5*10).padStart(2,'0')}:00Z`;
  const base={campaign_id:69,qr_id:98,created_at:at,vivid_click_id:`${KEY}-${day}-${i}`,vivid_session_id:`${KEY}-${day}-${i}`};
  rows.push({...base,type:'scan',value:0});
  if(i<8)rows.push({...base,type:'offer',value:0});
  if(i>=8&&i<11)rows.push({...base,type:'maps',value:0});
  if(i===11)rows.push({...base,type:'waze',value:0});
  if(i===0)rows.push({...base,type:'conversion',value:50});
 }
 return rows;
}
async function seed(client){
 await client.query('BEGIN');
 try{
  await client.query('SELECT pg_advisory_xact_lock(2026101302)');
  await client.query(`CREATE TABLE IF NOT EXISTS vivid_evaluation_fixtures(fixture_key TEXT PRIMARY KEY,organization_id INTEGER NOT NULL,manifest JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  if((await client.query('SELECT fixture_key FROM vivid_evaluation_fixtures WHERE fixture_key=$1',[KEY])).rows.length){await client.query('COMMIT');return;}
  const target=(await client.query(`SELECT c.id FROM campaigns c JOIN users u ON u.id=c.user_id JOIN qr_campaigns qc ON qc.campaign_id=c.id JOIN qr_codes qr ON qr.id=qc.qr_id JOIN spaces s ON s.id=qr.space_id WHERE c.id=69 AND qr.id=98 AND s.id=40 AND s.organization_id=13 AND LOWER(u.email)='mike@vividspots.com' AND c.name='Test Analytics Upgrade (2)'`)).rows;
  if(target.length!==1)throw Error('CCPS test placement identity mismatch');
  await client.query(`UPDATE campaigns SET name='Gulf Coast — Performance Demo',is_test=true WHERE id=69`);
  await client.query(`INSERT INTO events(campaign_id,qr_id,type,value,created_at,vivid_click_id,vivid_session_id)
  SELECT campaign_id,qr_id,type,value,created_at,vivid_click_id,vivid_session_id FROM jsonb_to_recordset($1::jsonb) AS x(campaign_id integer,qr_id integer,type text,value numeric,created_at timestamp,vivid_click_id text,vivid_session_id text)`,[JSON.stringify(events())]);
  await client.query(`INSERT INTO campaign_website_visits(scan_event_id,campaign_id,qr_id,vivid_click_id,page_url,page_name,created_at)
  SELECT id,campaign_id,qr_id,vivid_click_id,'https://example.com/ccps-demo/offer','Sponsor offer — demo',created_at FROM events
  WHERE campaign_id=69 AND qr_id=98 AND type='scan' AND vivid_click_id LIKE $1
  AND split_part(vivid_click_id,'-',6)::int < 10
  ON CONFLICT(campaign_id,vivid_click_id,page_url) DO NOTHING`,[KEY+'-%']);
  await client.query('INSERT INTO vivid_evaluation_fixtures(fixture_key,organization_id,manifest) VALUES($1,13,$2::jsonb)',[KEY,JSON.stringify({campaignId:69,qrId:98,locationId:40,scans:240,intent:96,conversions:8,revenue:400,websiteVisits:80,notice:'Illustrative CCPS Performance demo; no payment processed.'})]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}
}
if(require.main===module){const {Pool}=require('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});pool.connect().then(async c=>{try{await seed(c);console.log('CCPS Performance example ready');}finally{c.release();await pool.end();}}).catch(e=>{console.error('CCPS PERFORMANCE DEMO:',e.message);process.exitCode=1;});}
module.exports={events,seed,KEY};
