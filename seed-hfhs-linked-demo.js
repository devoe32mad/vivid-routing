"use strict";
const { Pool } = require("pg");
const KEY = "hfhs-linked-event-sponsors-20261008-v1";
const NOTICE = "PRIVATE VIVID DEMO — illustrative sponsorship only; not an actual sale, payment, signed agreement, or HFHS endorsement.";
const PICKS = [
  ["Pink Ball 2026", "Event Sponsor", "Demo Sponsor — Community Partner", 15000],
  ["The Medallion 2026", "Program Book — Full Page Color", "Demo Sponsor — Local Business", 800],
  ["4th Annual Obesity Symposium", "Exhibit Booth", "Demo Sponsor — Conference Exhibitor", 2000],
  ["Annual Breast Oncology Symposium", "CME Exhibit Booth", "Demo Sponsor — Medical Education", 2000],
  ["5th Annual Motown Women's Heart Symposium", "CME Exhibit Booth", "Demo Sponsor — Heart Health", 2000]
];
async function reconcile(client,org) {
    // Align the pre-existing walkthrough placement as well as the new demo placements.
    await client.query(`UPDATE organization_opportunities oo SET status='Sold',updated_at=CURRENT_TIMESTAMP
      WHERE oo.organization_id=$1 AND oo.status IS DISTINCT FROM 'Sold'
        AND EXISTS (SELECT 1 FROM organizations o WHERE o.id=oo.organization_id AND o.slug='henry-ford-health-demo') AND EXISTS (
        SELECT 1 FROM organization_advertising_requests ar
        JOIN qr_campaigns qc ON qc.qr_id=ar.created_qr_id AND qc.campaign_id=ar.created_campaign_id AND COALESCE(qc.is_active,true)=true
        JOIN qr_codes qr ON qr.id=qc.qr_id AND qr.space_id=oo.space_id AND COALESCE(qr.is_archived,false)=false
        JOIN campaigns c ON c.id=qc.campaign_id AND c.organization_id=oo.organization_id AND COALESCE(c.is_archived,false)=false
        WHERE ar.organization_id=oo.organization_id AND ar.opportunity_id=oo.id AND LOWER(ar.status)='approved'
      )`,[org]);
}
async function seed(client) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(2026100802)");
    const prior = await client.query("SELECT manifest FROM vivid_evaluation_fixtures WHERE fixture_key=$1", [KEY]);
    if (prior.rows.length) { await reconcile(client,prior.rows[0].manifest.organizationId); await client.query("COMMIT"); return {alreadyLoaded:true,...prior.rows[0].manifest}; }
    const orgs = await client.query(`SELECT o.id,o.customer_id FROM organizations o JOIN users u ON u.id=o.customer_id
      WHERE o.slug='henry-ford-health-demo' AND LOWER(TRIM(u.email))='michaelandrewdevoe@gmail.com'`);
    if(orgs.rows.length!==1) throw new Error("HFHS demo owner identity mismatch");
    const org=orgs.rows[0].id, owner=orgs.rows[0].customer_id;
    const manifest={organizationId:org,placements:[],addedValue:0};
    for (const [event,title,sponsor,price] of PICKS) {
      const found=await client.query(`SELECT oo.id,oo.space_id,oo.price,oo.status FROM organization_opportunities oo
        JOIN spaces s ON s.id=oo.space_id AND s.organization_id=oo.organization_id
        WHERE oo.organization_id=$1 AND s.name=$2 AND oo.title=$3
        AND COALESCE(s.is_archived,false)=false AND COALESCE(oo.is_active,true)=true FOR UPDATE OF oo`,[org,event,title]);
      if(found.rows.length!==1) throw new Error("Expected one opportunity: "+event+" / "+title);
      const opp=found.rows[0];
      if(Number(opp.price)!==price || String(opp.status).toLowerCase()!=="available") throw new Error("Opportunity price/status changed: "+event);
      const linked=await client.query("SELECT id FROM organization_advertising_requests WHERE organization_id=$1 AND opportunity_id=$2 AND LOWER(status) IN ('pending','approved')",[org,opp.id]);
      if(linked.rows.length) throw new Error("Opportunity already requested: "+event);
      const advertiser=(await client.query(`INSERT INTO advertisers(customer_id,organization_id,name,notes,relationship_status,is_active)
        VALUES($1,$2,$3,$4,'Active',true) RETURNING id`,[owner,org,sponsor,NOTICE])).rows[0].id;
      const name=`HFHS Demo — ${event} — ${title}`;
      const campaign=(await client.query(`INSERT INTO campaigns(name,advertiser,advertiser_id,user_id,organization_id,campaign_url,is_test,start_date,live_date,end_date,is_archived)
        VALUES($1,$2,$3,$4,$5,'https://example.com/hfhs-demo',true,'2026-10-08','2026-10-08','2026-11-07',false) RETURNING id`,[name,sponsor,advertiser,owner,org])).rows[0].id;
      await client.query(`INSERT INTO campaign_destinations(campaign_id,name,destination_type,destination_url,display_order,is_active)
        VALUES($1,'Demonstration destination','website','https://example.com/hfhs-demo',1,true)`,[campaign]);
      const qr=(await client.query(`INSERT INTO qr_codes(space_id,name,description,is_active,is_archived,annual_cost,total_cost,annual_impressions,live_date,end_date)
        VALUES($1,$2,$3,true,false,$4,$4,0,'2026-10-08','2026-11-07') RETURNING id`,[opp.space_id,title,NOTICE,price])).rows[0].id;
      await client.query(`INSERT INTO qr_campaigns(qr_id,campaign_id,contract_days,is_active,started_at,assigned_at)
        VALUES($1,$2,31,true,'2026-10-08','2026-10-08')`,[qr,campaign]);
      const contract=(await client.query(`INSERT INTO contracts(customer_id,organization_id,advertiser_id,location_id,qr_id,opportunity_id,
        contract_name,contract_type,start_date,end_date,expiration_date,renewal_date,total_contract_value,billing_frequency,status,source_type,notes,activated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,'Advertising','2026-10-08','2026-11-07','2026-11-07','2026-10-31',$8,'One-Time','Active','Manual',$9,CURRENT_TIMESTAMP) RETURNING id`,
        [owner,org,advertiser,opp.space_id,qr,opp.id,name,price,NOTICE])).rows[0].id;
      await client.query(`INSERT INTO organization_advertising_requests(organization_id,location_id,opportunity_id,business_name,contact_name,email,phone,
        campaign_name,destination_url,campaign_notes,opportunity_name,price,pricing_unit,suggested_term_length,suggested_term_unit,status,setup_status,
        created_vivid_user_id,created_location_id,created_contract_id,created_qr_id,created_campaign_id,approved_at,submitted_at)
        VALUES($1,$2::integer,$3,$4,'Vivid Demo','michaelandrewdevoe@gmail.com','DEMO',$5,'https://example.com/hfhs-demo',$6,$7,$8,'Per Event',1,'Event',
        'Approved','Campaign Created',$9,$2::integer,$10,$11,$12,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [org,opp.space_id,opp.id,sponsor,name,NOTICE,title,price,owner,contract,qr,campaign]);
      await client.query("UPDATE organization_opportunities SET status='Sold',qr_id=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$3",[opp.id,qr,org]);
      manifest.placements.push({event,title,price,opportunityId:opp.id,qrId:qr,campaignId:campaign,contractId:contract});
      manifest.addedValue+=price;
    }
    await reconcile(client,org);
    await client.query("INSERT INTO vivid_evaluation_fixtures(fixture_key,organization_id,manifest) VALUES($1,$2,$3::jsonb)",[KEY,org,JSON.stringify(manifest)]);
    await client.query("COMMIT"); return manifest;
  } catch(error) { await client.query("ROLLBACK"); throw error; }
}
async function main(){
  if(!process.env.DATABASE_URL)return;
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  let client;
  try{client=await pool.connect();console.log("HFHS LINKED DEMO:",JSON.stringify(await seed(client)));}
  finally{if(client)client.release();await pool.end();}
}
if(require.main===module)main().catch(e=>console.error("HFHS LINKED DEMO ERROR:",e.message,e.detail||""));
module.exports={seed,main,PICKS,KEY};
