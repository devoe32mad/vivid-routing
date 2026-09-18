"use strict";

// One-time, transactional fixture for the existing MoFlo evaluation accounts.
// No users, credentials, permissions, messages, billing or payment records are created.
const KEY = "moflo-evaluation-2026-09-v1";
const START = "2026-06-20";
const END = "2026-09-17";
const ORG = 22;
const OWNER = 33;
const NOTICE = "DEMONSTRATION ONLY — fictional venue and simulated results; example pricing, no purchase or physical inventory offered.";
const locations = [
  {key:"naples-school", existing:47, old:"MoFlo Evaluation — Naples (TEST)", name:"Demo — Naples Community School", market:"Naples, FL", kind:"School"},
  {key:"fortmyers-school", existing:48, old:"MoFlo Evaluation — Fort Myers (TEST)", name:"Demo — Fort Myers Community School", market:"Fort Myers, FL", kind:"School"},
  {key:"naples-retail", name:"Demo — Naples Retail Center", market:"Naples, FL", kind:"Retail"},
  {key:"fortmyers-retail", name:"Demo — Fort Myers Retail Center", market:"Fort Myers, FL", kind:"Retail"}
];
const campaigns = [
  {key:"home", name:"Demo — Harbor Home Services | Home Care Consultation", advertiser:"Demo — Harbor Home Services", value:250, end:"2026-09-30"},
  {key:"fitness", name:"Demo — Gulf Coast Fitness | Introductory Membership", advertiser:"Demo — Gulf Coast Fitness", value:120, end:"2026-10-31"},
  {key:"cafe", name:"Demo — Coastal Cafe | Family Meal Offer", advertiser:"Demo — Coastal Cafe", value:35, end:"2026-11-30"}
];
const placements = [
  {key:"naples-carline",location:0,campaign:0,name:"Car Line Fence",cost:1200,scans:8,clickEvery:3,convertEvery:8,end:"2026-09-30"},
  {key:"fortmyers-carline",location:1,campaign:0,name:"Car Line Fence",cost:1000,scans:7,clickEvery:4,convertEvery:12,end:"2026-09-30"},
  {key:"naples-fitness",location:2,campaign:1,name:"Retail Entrance Display",cost:900,scans:6,clickEvery:3,convertEvery:10,end:"2026-10-31"},
  {key:"fortmyers-fitness",location:3,campaign:1,name:"Retail Entrance Display",cost:750,scans:5,clickEvery:4,convertEvery:15,end:"2026-10-31"},
  {key:"naples-cafe",location:0,campaign:2,name:"Athletics Concession Display",cost:600,scans:9,clickEvery:2,convertEvery:6,end:"2026-11-30"},
  {key:"fortmyers-cafe",location:1,campaign:2,name:"Athletics Concession Display",cost:500,scans:8,clickEvery:3,convertEvery:9,end:"2026-11-30"}
];
const available = [
  {existing:37,location:0,name:"Gymnasium Community Sponsor",cost:1500,unit:"Per Year",term:1,termUnit:"Years",description:"Gymnasium sponsor display for school and community events. Start the MoFlo onboarding exercise here."},
  {existing:38,location:1,name:"Football Stadium Sponsor",cost:1800,unit:"Per Year",term:1,termUnit:"Years",description:"Stadium display with a dedicated QR destination for a local business."},
  {location:0,name:"School Magazine Full Page",cost:450,unit:"Per Campaign",term:1,termUnit:"Issues",description:"One full-page magazine placement with a trackable QR code."},
  {location:1,name:"School Event Welcome Display",cost:300,unit:"Per Event",term:1,termUnit:"Events",description:"Entrance display for one school community event."},
  {location:2,name:"Retail Checkout Counter Display",cost:225,unit:"Per Month",term:1,termUnit:"Months",description:"One month of checkout counter visibility with a dedicated trackable QR code."},
  {location:3,name:"Retail Window Community Sponsor",cost:300,unit:"Per Month",term:1,termUnit:"Months",description:"One month of retail window visibility with a dedicated trackable QR code."}
];

function buildEvents(p, index, campaignId, qrId, destinationId) {
  const result = [];
  let scanNumber = 0;
  for (let day = 0; day < 90; day++) {
    const date = new Date(`${START}T14:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + day);
    // Stable growth plus market variation makes comparisons reproducible.
    const count = p.scans + Math.floor(day / 30) + ((day + index) % 3);
    for (let j = 0; j < count; j++) {
      scanNumber++;
      const at = new Date(date.getTime() + j * 420000);
      const clickId = `${KEY}:${p.key}:${day}:${j}`;
      const base = {campaign_id:campaignId, qr_id:qrId, vivid_click_id:clickId, vivid_session_id:clickId};
      result.push({...base,type:"scan",value:0,created_at:at.toISOString(),campaign_destination_id:null});
      if (scanNumber % p.clickEvery === 0) {
        result.push({...base,type:"offer",value:0,created_at:new Date(+at+20000).toISOString(),campaign_destination_id:destinationId});
        if ((scanNumber / p.clickEvery) % p.convertEvery === 0) {
          result.push({...base,type:"conversion",value:campaigns[p.campaign].value,created_at:new Date(+at+180000).toISOString(),campaign_destination_id:destinationId});
        }
      }
    }
  }
  return result;
}

async function seed(client) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(2200332026)");
    await client.query(`CREATE TABLE IF NOT EXISTS vivid_evaluation_fixtures (
      fixture_key TEXT PRIMARY KEY, organization_id INTEGER NOT NULL,
      manifest JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const prior = await client.query("SELECT manifest FROM vivid_evaluation_fixtures WHERE fixture_key=$1",[KEY]);
    if (prior.rows.length) { const manifest=prior.rows[0].manifest; await completeDetails(client,manifest); await client.query("COMMIT"); return {alreadyLoaded:true,...manifest}; }
    const target = await client.query(`SELECT o.id FROM organizations o JOIN users u ON u.id=$2
      WHERE o.id=$1 AND o.name='MoFlo' AND LOWER(u.email)='nathan@moflo.ai'
      AND u.role='customer' AND COALESCE(o.is_active,true)=true`,[ORG,OWNER]);
    if (target.rows.length!==1) throw new Error("MoFlo account identity check failed; no fixture loaded.");
    const membership = await client.query("SELECT id FROM organization_users WHERE organization_id=$1 AND user_id=$2 AND COALESCE(is_active,true)=true",[ORG,OWNER]);
    if (!membership.rows.length) throw new Error("MoFlo enterprise membership not found.");
    // Do not take over a real venue or change someone else's work.
    for (const l of locations.filter(x=>x.existing)) {
      const row = await client.query(`SELECT id FROM spaces WHERE id=$1 AND organization_id=$2 AND name=$3
        AND NOT EXISTS (SELECT 1 FROM qr_codes WHERE space_id=$1)`,[l.existing,ORG,l.old]);
      if (row.rows.length!==1) throw new Error("Evaluation location changed or already has placements; review before loading.");
    }
    const program = await client.query("SELECT id FROM organization_programs WHERE id=95 AND organization_id=$1 AND name='MoFlo Evaluation (TEST)'",[ORG]);
    if (program.rows.length!==1) throw new Error("Expected evaluation program not found.");
    const manifest = {fixture:KEY,start:START,end:END,organizationId:ORG,advertiserAccountId:OWNER,locations:[],campaigns:[],placements:[],opportunities:[],contracts:[],totals:{scans:0,clicks:0,conversions:0,revenue:0}};
    for (const l of locations) {
      const params = [OWNER,ORG,l.name,l.market,`${NOTICE} ${l.kind} demonstration venue.`,START];
      let r;
      if (l.existing) r = await client.query(`UPDATE spaces SET user_id=$1,name=$3,location=$4,description=$5,live_date=$6::date,
        created_at=$6::date WHERE id=$7 AND organization_id=$2 RETURNING id`,[...params,l.existing]);
      else r = await client.query(`INSERT INTO spaces(user_id,organization_id,name,location,description,live_date,created_at)
        VALUES($1,$2,$3,$4,$5,$6::date,$6::date) RETURNING id`,params);
      manifest.locations.push({id:r.rows[0].id,name:l.name,market:l.market});
    }
    for (const c of campaigns) {
      const a = await client.query(`INSERT INTO advertisers(customer_id,organization_id,name,notes,relationship_status,is_active)
        VALUES($1,$2,$3,$4,'Active',true) RETURNING id`,[OWNER,ORG,c.advertiser,NOTICE]);
      const r = await client.query(`INSERT INTO campaigns(name,advertiser,advertiser_id,user_id,organization_id,campaign_url,
        avg_customer_value,is_test,start_date,live_date,end_date,created_at,is_archived)
        VALUES($1,$2,$3,$4,$5,'https://vividspots.com/',$6,true,$7::date,$7::date,$8::date,$7::date,false) RETURNING id`,
        [c.name,c.advertiser,a.rows[0].id,OWNER,ORG,c.value,START,c.end]);
      const dest = await client.query(`INSERT INTO campaign_destinations(campaign_id,name,destination_type,destination_url,estimated_value,display_order,is_active)
        VALUES($1,'Demo destination — replace with your landing page','website','https://vividspots.com/',$2,1,true) RETURNING id`,[r.rows[0].id,c.value]);
      manifest.campaigns.push({id:r.rows[0].id,advertiserId:a.rows[0].id,destinationId:dest.rows[0].id,name:c.name});
    }
    for (let i=0;i<placements.length;i++) {
      const p=placements[i], l=manifest.locations[p.location], c=manifest.campaigns[p.campaign];
      const days = Math.round((Date.parse(p.end)-Date.parse(START))/86400000)+1;
      const qr = await client.query(`INSERT INTO qr_codes(space_id,name,description,is_active,is_archived,annual_cost,total_cost,annual_impressions,live_date,end_date,created_at)
        VALUES($1,$2,$3,true,false,$4,$4,0,$5::date,$6::date,$5::date) RETURNING id`,
        [l.id,`Demo — ${p.name}`,NOTICE,p.cost,START,p.end]);
      const qrId=qr.rows[0].id;
      await client.query(`INSERT INTO qr_campaigns(qr_id,campaign_id,contract_days,is_active,started_at,assigned_at)
        VALUES($1,$2,$3,true,$4::date,$4::date)`,[qrId,c.id,days,START]);
      const op = await client.query(`INSERT INTO organization_opportunities(organization_id,space_id,program_id,qr_id,title,description,category,
        price,annual_price,pricing_unit,suggested_term_length,suggested_term_unit,status,display_order,is_active)
        VALUES($1,$2,95,$3,$4,$5,$6,$7,$7,'Per Campaign',$8,'Days','Approved',$9,true) RETURNING id`,
        [ORG,l.id,qrId,`Demo — ${p.name}`,NOTICE,locations[p.location].kind,p.cost,days,i+1]);
      const ct = await client.query(`INSERT INTO contracts(customer_id,organization_id,advertiser_id,location_id,qr_id,opportunity_id,
        contract_name,contract_type,start_date,end_date,expiration_date,renewal_date,total_contract_value,billing_frequency,status,source_type,notes,created_at,activated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,'Advertising',$8::date,$9::date,$9::date,$9::date-30,$10,'One-Time','Active','Manual',$11,$8::date,$8::date) RETURNING id`,
        [OWNER,ORG,c.advertiserId,l.id,qrId,op.rows[0].id,`Demo — ${campaigns[p.campaign].advertiser.replace('Demo — ','')} / ${p.name} / ${l.market}`,START,p.end,p.cost,NOTICE]);
      const events=buildEvents(p,i,c.id,qrId,c.destinationId);
      await client.query(`INSERT INTO events(campaign_id,qr_id,type,value,created_at,vivid_click_id,vivid_session_id,campaign_destination_id)
        SELECT campaign_id,qr_id,type,value,created_at,vivid_click_id,vivid_session_id,campaign_destination_id
        FROM jsonb_to_recordset($1::jsonb) AS x(campaign_id integer,qr_id integer,type text,value numeric,created_at timestamp,
          vivid_click_id text,vivid_session_id text,campaign_destination_id integer)`,[JSON.stringify(events)]);
      const totals={scans:0,clicks:0,conversions:0,revenue:0};
      for(const e of events){if(e.type==='scan')totals.scans++;if(e.type==='offer')totals.clicks++;if(e.type==='conversion'){totals.conversions++;totals.revenue+=e.value;}}
      for(const k of Object.keys(totals))manifest.totals[k]+=totals[k];
      manifest.placements.push({id:qrId,campaignId:c.id,locationId:l.id,name:p.name,cost:p.cost,days,end:p.end,allocatedCost90Days:p.cost*90/days,...totals});
      manifest.contracts.push({id:ct.rows[0].id,qrId,value:p.cost,end:p.end});
      await client.query(`INSERT INTO campaign_schedules(qr_id,campaign_id,days_of_week,start_time,end_time,priority,is_active,schedule_kind)
        VALUES($1,$2,'1,2,3,4,5','07:00','19:00',50,true,'weekly')`,[qrId,c.id]);
    }
    // An upcoming dated event makes the calendar and weekly report actionable.
    await client.query(`INSERT INTO campaign_schedules(qr_id,campaign_id,schedule_kind,event_name,event_type,event_start_at,event_end_at,event_timezone,event_notes,priority,is_active)
      VALUES($1,$2,'event','Demo — Family Community Evening','community','2026-09-25T21:00:00Z','2026-09-26T01:00:00Z','America/New_York',$3,90,true)`,
      [manifest.placements[4].id,manifest.campaigns[2].id,NOTICE]);
    for(let i=0;i<available.length;i++){
      const o=available[i], locationId=manifest.locations[o.location].id;
      const params=[ORG,locationId,`Demo — ${o.name}`,`${NOTICE} ${o.description}`,locations[o.location].kind,o.cost,o.unit,o.term,o.termUnit,20+i];
      let r;
      if(o.existing){
        r=await client.query(`UPDATE organization_opportunities SET title=$3,description=$4,category=$5,price=$6,annual_price=$6,
          pricing_unit=$7,suggested_term_length=$8,suggested_term_unit=$9,display_order=$10
          WHERE organization_id=$1 AND space_id=$2 AND id=$11 AND status='Available'
          AND title LIKE 'MoFlo Evaluation%' AND NOT EXISTS(SELECT 1 FROM organization_advertising_requests WHERE opportunity_id=$11)
          RETURNING id`,[...params,o.existing]);
        if(r.rows.length!==1)throw new Error("Evaluation opportunity changed or has a request; no fixture loaded.");
      }else r=await client.query(`INSERT INTO organization_opportunities(organization_id,space_id,program_id,title,description,category,price,annual_price,
        pricing_unit,suggested_term_length,suggested_term_unit,display_order,status,is_active)
        VALUES($1,$2,95,$3,$4,$5,$6,$6,$7,$8,$9,$10,'Available',true) RETURNING id`,params);
      manifest.opportunities.push({id:r.rows[0].id,locationId,name:o.name,cost:o.cost,unit:o.unit,term:o.term,termUnit:o.termUnit});
    }
    const checks=await client.query(`SELECT COUNT(*) FILTER(WHERE type='scan')::int scans,
      COUNT(*) FILTER(WHERE type='offer')::int clicks,COUNT(*) FILTER(WHERE type='conversion')::int conversions,
      COALESCE(SUM(value) FILTER(WHERE type='conversion'),0)::numeric revenue FROM events WHERE campaign_id=ANY($1::int[])`,[manifest.campaigns.map(c=>c.id)]);
    for(const k of Object.keys(manifest.totals))if(Number(checks.rows[0][k])!==manifest.totals[k])throw new Error(`Fixture verification failed: ${k}`);
    await client.query("INSERT INTO vivid_evaluation_fixtures(fixture_key,organization_id,manifest) VALUES($1,$2,$3::jsonb)",[KEY,ORG,JSON.stringify(manifest)]);
    await completeDetails(client,manifest);
    await client.query("COMMIT");
    return manifest;
  }catch(error){await client.query("ROLLBACK");throw error;}
}

async function completeDetails(client,manifest){
  if(manifest.detailVersion===2)return;
  // Repair only this fixture's legacy click representation, preserving event IDs,
  // timestamps and attribution. Native destination panels count destination_click.
  const ids=manifest.campaigns.map(c=>c.id);
  const check=await client.query(`SELECT id FROM campaigns WHERE id=ANY($1::int[]) AND user_id=$2
    AND organization_id=$3 AND is_test=true`,[ids,OWNER,ORG]);
  if(check.rows.length!==3)throw new Error('Fixture ownership changed; detail repair cancelled.');
  await client.query(`UPDATE events SET type='destination_click'
    WHERE campaign_id=ANY($1::int[]) AND vivid_click_id LIKE $2 AND type='offer'`,[ids,KEY+':%']);
  manifest.requests=[];
  for(let i=0;i<manifest.contracts.length;i++){
    const ct=manifest.contracts[i], p=placements[i], campaign=manifest.campaigns[p.campaign];
    const linked=await client.query(`SELECT ct.id,ct.opportunity_id,ct.location_id,ct.qr_id,oo.title
      FROM contracts ct JOIN organization_opportunities oo ON oo.id=ct.opportunity_id
      WHERE ct.id=$1 AND ct.organization_id=$2 AND ct.customer_id=$3 AND ct.qr_id=$4
      AND ct.notes=$5 AND oo.organization_id=$2`,[ct.id,ORG,OWNER,ct.qrId,NOTICE]);
    if(linked.rows.length!==1)throw new Error('Fixture contract identity changed.');
    const row=linked.rows[0];
    const request=await client.query(`INSERT INTO organization_advertising_requests
      (organization_id,location_id,opportunity_id,business_name,contact_name,email,phone,
       campaign_name,destination_url,campaign_notes,opportunity_name,price,pricing_unit,
       suggested_term_length,suggested_term_unit,status,setup_status,created_vivid_user_id,
       created_contract_id,created_qr_id,created_campaign_id,approved_at,submitted_at,created_at,updated_at)
      VALUES($1,$2,$3,$4,'Demo historical customer','moflo-evaluation@example.invalid','DEMO — no telephone',$5,
       'https://vividspots.com/',$6,$7,$8,'Per Campaign',$9,'Days','Approved','Campaign Created',
       $10,$11,$12,$13,$14::date,$14::date,$14::date,$14::date) RETURNING id`,
      [ORG,row.location_id,row.opportunity_id,campaigns[p.campaign].advertiser,campaign.name,
       NOTICE,row.title,p.cost,manifest.placements[i].days,OWNER,ct.id,ct.qrId,campaign.id,START]);
    await client.query('UPDATE contracts SET advertising_request_id=$1 WHERE id=$2 AND organization_id=$3',
      [request.rows[0].id,ct.id,ORG]);
    manifest.requests.push(request.rows[0].id);
  }
  manifest.detailVersion=2;
  await client.query('UPDATE vivid_evaluation_fixtures SET manifest=$1::jsonb WHERE fixture_key=$2',
    [JSON.stringify(manifest),KEY]);
}

async function main(){
  require('./install-destination-click-reporting').install();
  const {Pool}=require('pg');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  let client;
  try{client=await pool.connect(); const result=await seed(client);console.log("MoFlo evaluation fixture:",JSON.stringify(result));}
  finally{if(client)client.release();await pool.end();}
}
if(require.main===module)main().catch(error=>{
  // An optional fixture must never prevent the production application starting.
  console.error("MoFlo evaluation was NOT loaded:",error.message);
});
module.exports={KEY,START,END,locations,campaigns,placements,available,buildEvents,seed};
