"use strict";
const {Pool}=require('pg');
const KEY='hfhs-restore-linked-history-20261008-v1';
const ORIGINAL='hfhs-enterprise-demo-2026-10-v1';
const MAPPING=[
 ['Pink Ball — Bar Activation','Pink Ball 2026'],
 ['Pink Ball — Event Signage','Pink Ball 2026'],
 ['Conference Exhibit Booth','Live in the D Advanced Endoscopy Course'],
 ['Registration Area Sponsor','Henry Ford + MSU Annual Cancer Research Symposium'],
 ['CME Exhibitor Engagement','Annual Thoracic Cancer Symposium'],
 ['Clinical Symposium Session','GU Cancer Symposium'],
 ['Community Screening Activation',"Hit'em Fore Hospice Golf Outing"],
 ['Wellness Program Activation','Providence Golf'],
 ['Arena Health Activation','Ambassador Club 2026 — Racing for the Future'],
 ['Destination: Grand Experience','Destination Grand Ball 2026']
];
async function restore(client){
 await client.query('BEGIN');
 try{
  await client.query('SELECT pg_advisory_xact_lock(2026100803)');
  const prior=await client.query('SELECT manifest FROM vivid_evaluation_fixtures WHERE fixture_key=$1',[KEY]);
  if(prior.rows.length){await client.query('COMMIT');return {alreadyLoaded:true,...prior.rows[0].manifest};}
  const original=(await client.query(`SELECT f.manifest FROM vivid_evaluation_fixtures f JOIN organizations o ON o.id=f.organization_id
   JOIN users u ON u.id=o.customer_id WHERE f.fixture_key=$1 AND o.slug='henry-ford-health-demo' AND LOWER(u.email)='michaelandrewdevoe@gmail.com'`,[ORIGINAL])).rows[0]?.manifest;
  if(!original || original.placements.length!==10)throw Error('Original HFHS demo fixture missing or changed');
  const org=Number(original.organizationId),owner=Number(original.ownerId),manifest={organizationId:org,placements:[],restoredValue:0};
  for(const [name,event] of MAPPING){
   const old=original.placements.find(p=>p.name===name);
   if(!old)throw Error('Missing original placement '+name);
   const source=original.locations.find(l=>l.key===old.program);
   const target=(await client.query(`SELECT s.id,MIN(oo.program_id) AS program_id FROM spaces s
    JOIN organization_opportunities oo ON oo.space_id=s.id AND oo.organization_id=s.organization_id
    WHERE s.organization_id=$1 AND s.name=$2 AND COALESCE(s.is_archived,false)=false GROUP BY s.id`,[org,event])).rows;
   if(target.length!==1 || !target[0].program_id)throw Error('Event identity mismatch '+event);
   const qr=(await client.query(`SELECT qr.id,qr.space_id,qr.annual_cost FROM qr_codes qr JOIN spaces s ON s.id=qr.space_id
    WHERE qr.id=$1 AND s.organization_id=$2 FOR UPDATE OF qr`,[old.qrId,org])).rows[0];
   if(!qr || Number(qr.space_id)!==Number(source.id) || Number(qr.annual_cost)!==Number(old.cost))throw Error('Original placement changed '+name);
   const opp=(await client.query(`SELECT id,price FROM organization_opportunities WHERE organization_id=$1 AND qr_id=$2 AND space_id=$3 FOR UPDATE`,[org,old.qrId,source.id])).rows;
   if(opp.length!==1 || Number(opp[0].price)!==Number(old.cost))throw Error('Original inventory mismatch '+name);
   const location=target[0].id;
   await client.query('UPDATE qr_codes SET space_id=$2 WHERE id=$1',[old.qrId,location]);
   await client.query(`UPDATE organization_opportunities SET space_id=$2,program_id=$3,status='Sold',is_active=true,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[opp[0].id,location,target[0].program_id]);
   const contracts=await client.query(`UPDATE contracts SET location_id=$3,updated_at=CURRENT_TIMESTAMP
    WHERE organization_id=$1 AND qr_id=$2 AND opportunity_id=$4 RETURNING id,total_contract_value`,[org,old.qrId,location,opp[0].id]);
   if(contracts.rows.length!==1 || Number(contracts.rows[0].total_contract_value)!==Number(old.cost))throw Error('Contract mismatch '+name);
   const requests=await client.query(`UPDATE organization_advertising_requests SET location_id=$3::integer,created_location_id=$3::integer,updated_at=CURRENT_TIMESTAMP
    WHERE organization_id=$1 AND created_qr_id=$2 AND opportunity_id=$4 AND created_vivid_user_id=$5 AND created_campaign_id=$6 RETURNING id`,
    [org,old.qrId,location,opp[0].id,owner,old.campaignId]);
   if(requests.rows.length!==1)throw Error('Marketplace relationship mismatch '+name);
   manifest.placements.push({name,event,qrId:old.qrId,campaignId:old.campaignId,opportunityId:opp[0].id,fromLocationId:source.id,locationId:location,cost:old.cost});
   manifest.restoredValue+=Number(old.cost);
  }
  await client.query('INSERT INTO vivid_evaluation_fixtures(fixture_key,organization_id,manifest) VALUES($1,$2,$3::jsonb)',[KEY,org,JSON.stringify(manifest)]);
  await client.query('COMMIT');return manifest;
 }catch(e){await client.query('ROLLBACK');throw e;}
}
async function main(){
 if(!process.env.DATABASE_URL)return;
 const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});let client;
 try{client=await pool.connect();console.log('HFHS HISTORY RESTORED:',JSON.stringify(await restore(client)));}
 finally{if(client)client.release();await pool.end();}
}
if(require.main===module)main().catch(e=>console.error('HFHS HISTORY RESTORE ERROR:',e.message));
module.exports={restore,main,KEY,MAPPING};
