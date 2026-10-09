"use strict";
const {Pool}=require('pg');
const KEY='hfhs-focus-demo-20261009-v1';
async function trim(client){
 await client.query('BEGIN');
 try{
  await client.query('SELECT pg_advisory_xact_lock(2026100901)');
  const prior=await client.query('SELECT manifest FROM vivid_evaluation_fixtures WHERE fixture_key=$1',[KEY]);
  if(prior.rows.length){await client.query('COMMIT');return {alreadyLoaded:true,...prior.rows[0].manifest};}
  const orgs=(await client.query(`SELECT o.id,o.customer_id FROM organizations o JOIN users u ON u.id=o.customer_id
   WHERE o.slug='henry-ford-health-demo' AND LOWER(u.email)='michaelandrewdevoe@gmail.com'`)).rows;
  if(orgs.length!==1)throw Error('HFHS identity mismatch');
  const org=orgs[0].id,owner=orgs[0].customer_id;
  const fixtures=(await client.query('SELECT fixture_key,manifest FROM vivid_evaluation_fixtures WHERE organization_id=$1',[org])).rows;
  const recent=fixtures.find(f=>f.fixture_key==='hfhs-linked-event-sponsors-20261008-v1')?.manifest;
  const original=fixtures.find(f=>f.fixture_key==='hfhs-enterprise-demo-2026-10-v1')?.manifest;
  if(recent?.placements?.length!==5 || original?.placements?.length!==10)throw Error('Demo fixture mismatch');
  const walkthrough=(await client.query(`SELECT ar.created_campaign_id AS "campaignId",ar.created_qr_id AS "qrId",ar.opportunity_id AS "opportunityId",ar.created_contract_id AS "contractId"
   FROM organization_advertising_requests ar JOIN campaigns c ON c.id=ar.created_campaign_id
   WHERE ar.organization_id=$1 AND ar.created_vivid_user_id=$2 AND c.organization_id=$1
   AND ar.business_name='Vivid HFHS Walkthrough — Test Only' AND c.name='HFHS Table Host Walkthrough'`,[org,owner])).rows;
  if(walkthrough.length!==1)throw Error('Table Host demo identity mismatch');
  const targets=[...recent.placements,...walkthrough];
  const campaignIds=targets.map(p=>Number(p.campaignId)),qrIds=targets.map(p=>Number(p.qrId)),oppIds=targets.map(p=>Number(p.opportunityId)),contractIds=targets.map(p=>Number(p.contractId));
  if(new Set(campaignIds).size!==6 || original.placements.some(p=>qrIds.includes(Number(p.qrId))))throw Error('Fixture overlap');
  const activity=(await client.query("SELECT count(*)::int AS n FROM events WHERE campaign_id=ANY($1::int[]) AND type='conversion'",[campaignIds])).rows[0];
  if(Number(activity.n)!==0)throw Error('New conversions recorded on cleanup candidates; review before archiving');
  const snapshots={};
  for(const [table,ids] of [['campaigns',campaignIds],['qr_codes',qrIds],['contracts',contractIds],['organization_opportunities',oppIds]]){
   snapshots[table]=(await client.query(`SELECT * FROM ${table} WHERE id=ANY($1::int[])`,[ids])).rows;
   if(snapshots[table].length!==6)throw Error('Cleanup records missing: '+table);
  }
  if(snapshots.campaigns.some(c=>Number(c.organization_id)!==Number(org)||Number(c.user_id)!==Number(owner)))throw Error('Campaign owner mismatch');
  await client.query('UPDATE campaigns SET is_archived=true WHERE id=ANY($1::int[]) AND organization_id=$2',[campaignIds,org]);
  await client.query('UPDATE qr_codes SET is_archived=true,is_active=false WHERE id=ANY($1::int[])',[qrIds]);
  await client.query('UPDATE qr_campaigns SET is_active=false WHERE qr_id=ANY($1::int[]) AND campaign_id=ANY($2::int[])',[qrIds,campaignIds]);
  await client.query('UPDATE campaign_schedules SET is_active=false WHERE qr_id=ANY($1::int[]) AND campaign_id=ANY($2::int[])',[qrIds,campaignIds]);
  await client.query("UPDATE contracts SET status='Inactive',updated_at=CURRENT_TIMESTAMP WHERE id=ANY($1::int[]) AND organization_id=$2",[contractIds,org]);
  await client.query("UPDATE organization_opportunities SET status='Available',qr_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=ANY($1::int[]) AND organization_id=$2",[oppIds,org]);
  await client.query("UPDATE organization_advertising_requests SET setup_status='Demo Archived',updated_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND created_campaign_id=ANY($2::int[]) AND created_qr_id=ANY($3::int[])",[org,campaignIds,qrIds]);
  const keepQrIds=original.placements.map(p=>Number(p.qrId));
  const kept=(await client.query(`SELECT count(DISTINCT qc.campaign_id)::int AS campaigns,count(DISTINCT qr.id)::int AS placements,sum(qr.annual_cost)::numeric AS cost
   FROM qr_codes qr JOIN qr_campaigns qc ON qc.qr_id=qr.id AND COALESCE(qc.is_active,true)=true
   WHERE qr.id=ANY($1::int[]) AND COALESCE(qr.is_archived,false)=false`,[keepQrIds])).rows[0];
  if(kept.campaigns!==5||kept.placements!==10||Number(kept.cost)!==137000)throw Error('Retained demo totals mismatch');
  const manifest={organizationId:org,archivedCampaignIds:campaignIds,archivedQrIds:qrIds,kept,snapshots};
  await client.query('INSERT INTO vivid_evaluation_fixtures(fixture_key,organization_id,manifest) VALUES($1,$2,$3::jsonb)',[KEY,org,JSON.stringify(manifest)]);
  await client.query('COMMIT');return {organizationId:org,archivedCampaignIds:campaignIds,kept};
 }catch(e){await client.query('ROLLBACK');throw e;}
}
async function main(){
 if(!process.env.DATABASE_URL)return;
 const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});let client;
 try{client=await pool.connect();const result=await trim(client);console.log('HFHS DEMO FOCUSED:',JSON.stringify({alreadyLoaded:result.alreadyLoaded,organizationId:result.organizationId,archivedCampaignIds:result.archivedCampaignIds,kept:result.kept}));}
 finally{if(client)client.release();await pool.end();}
}
if(require.main===module)main().catch(e=>console.error('HFHS DEMO FOCUS ERROR:',e.message));
module.exports={trim,main,KEY};
