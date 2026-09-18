"use strict";

// Independent, one-time Jim evaluation. Creates a new pending customer and its own organization.
// No Jim rows are read or changed. No messages or payments are created.
const KEY = "jim-evaluation-2026-09-v1";
const START = "2026-06-20";
const END = "2026-09-17";
let ORG, OWNER, PROGRAM;
const NOTICE = "DEMONSTRATION ONLY — illustrative college-campus scenarios (no university affiliation or endorsement) and simulated referral-acquisition outcomes. Prices and conversion values are illustrative, not VIA VIA fees, referral rewards or actual earned revenue. No purchase or physical inventory offered.";
const locations = [
  {
    "key": "alabama",
    "name": "Demo — University of Alabama",
    "market": "Tuscaloosa, AL",
    "kind": "College Campus"
  },
  {
    "key": "auburn",
    "name": "Demo — Auburn University",
    "market": "Auburn, AL",
    "kind": "College Campus"
  },
  {
    "key": "uab",
    "name": "Demo — University of Alabama at Birmingham",
    "market": "Birmingham, AL",
    "kind": "College Campus"
  },
  {
    "key": "uah",
    "name": "Demo — University of Alabama in Huntsville",
    "market": "Huntsville, AL",
    "kind": "College Campus"
  },
  {
    "key": "georgia",
    "name": "Demo — University of Georgia",
    "market": "Athens, GA",
    "kind": "College Campus"
  },
  {
    "key": "gatech",
    "name": "Demo — Georgia Tech",
    "market": "Atlanta, GA",
    "kind": "College Campus"
  },
  {
    "key": "gastate",
    "name": "Demo — Georgia State University",
    "market": "Atlanta, GA",
    "kind": "College Campus"
  },
  {
    "key": "gasouthern",
    "name": "Demo — Georgia Southern University",
    "market": "Statesboro, GA",
    "kind": "College Campus"
  }
];
const campaigns = [
  {key:"home", name:"Demo — VIA VIA | Talent Referrals", advertiser:"Demo — Talent Partner", value:250, end:"2026-09-30"},
  {key:"fitness", name:"Demo — VIA VIA | Service Provider Introductions", advertiser:"Demo — Service Partner", value:120, end:"2026-10-31"},
  {key:"cafe", name:"Demo — VIA VIA | Customer Introductions", advertiser:"Demo — Customer Growth Partner", value:35, end:"2026-11-30"}
];
const placements = [
  {
    "key": "alabama-talent",
    "location": 0,
    "campaign": 0,
    "name": "Career Fair Welcome Display",
    "cost": 600,
    "scans": 8,
    "clickEvery": 3,
    "convertEvery": 8,
    "end": "2026-09-30"
  },
  {
    "key": "alabama-services",
    "location": 0,
    "campaign": 1,
    "name": "Student Services Partner Display",
    "cost": 450,
    "scans": 6,
    "clickEvery": 4,
    "convertEvery": 10,
    "end": "2026-10-31"
  },
  {
    "key": "alabama-customers",
    "location": 0,
    "campaign": 2,
    "name": "Campus Referral Invitation Cards",
    "cost": 300,
    "scans": 9,
    "clickEvery": 2,
    "convertEvery": 12,
    "end": "2026-11-30"
  },
  {
    "key": "auburn-talent",
    "location": 1,
    "campaign": 0,
    "name": "Career Fair Welcome Display",
    "cost": 625,
    "scans": 9,
    "clickEvery": 4,
    "convertEvery": 10,
    "end": "2026-09-30"
  },
  {
    "key": "auburn-services",
    "location": 1,
    "campaign": 1,
    "name": "Student Services Partner Display",
    "cost": 475,
    "scans": 7,
    "clickEvery": 2,
    "convertEvery": 12,
    "end": "2026-10-31"
  },
  {
    "key": "auburn-customers",
    "location": 1,
    "campaign": 2,
    "name": "Campus Referral Invitation Cards",
    "cost": 325,
    "scans": 10,
    "clickEvery": 3,
    "convertEvery": 8,
    "end": "2026-11-30"
  },
  {
    "key": "uab-talent",
    "location": 2,
    "campaign": 0,
    "name": "Career Fair Welcome Display",
    "cost": 650,
    "scans": 10,
    "clickEvery": 2,
    "convertEvery": 12,
    "end": "2026-09-30"
  },
  {
    "key": "uab-services",
    "location": 2,
    "campaign": 1,
    "name": "Student Services Partner Display",
    "cost": 500,
    "scans": 8,
    "clickEvery": 3,
    "convertEvery": 8,
    "end": "2026-10-31"
  },
  {
    "key": "uab-customers",
    "location": 2,
    "campaign": 2,
    "name": "Campus Referral Invitation Cards",
    "cost": 350,
    "scans": 11,
    "clickEvery": 4,
    "convertEvery": 10,
    "end": "2026-11-30"
  },
  {
    "key": "uah-talent",
    "location": 3,
    "campaign": 0,
    "name": "Career Fair Welcome Display",
    "cost": 675,
    "scans": 8,
    "clickEvery": 3,
    "convertEvery": 8,
    "end": "2026-09-30"
  },
  {
    "key": "uah-services",
    "location": 3,
    "campaign": 1,
    "name": "Student Services Partner Display",
    "cost": 525,
    "scans": 6,
    "clickEvery": 4,
    "convertEvery": 10,
    "end": "2026-10-31"
  },
  {
    "key": "uah-customers",
    "location": 3,
    "campaign": 2,
    "name": "Campus Referral Invitation Cards",
    "cost": 375,
    "scans": 9,
    "clickEvery": 2,
    "convertEvery": 12,
    "end": "2026-11-30"
  },
  {
    "key": "georgia-talent",
    "location": 4,
    "campaign": 0,
    "name": "Career Fair Welcome Display",
    "cost": 700,
    "scans": 9,
    "clickEvery": 4,
    "convertEvery": 10,
    "end": "2026-09-30"
  },
  {
    "key": "georgia-services",
    "location": 4,
    "campaign": 1,
    "name": "Student Services Partner Display",
    "cost": 550,
    "scans": 7,
    "clickEvery": 2,
    "convertEvery": 12,
    "end": "2026-10-31"
  },
  {
    "key": "georgia-customers",
    "location": 4,
    "campaign": 2,
    "name": "Campus Referral Invitation Cards",
    "cost": 400,
    "scans": 10,
    "clickEvery": 3,
    "convertEvery": 8,
    "end": "2026-11-30"
  },
  {
    "key": "gatech-talent",
    "location": 5,
    "campaign": 0,
    "name": "Career Fair Welcome Display",
    "cost": 725,
    "scans": 10,
    "clickEvery": 2,
    "convertEvery": 12,
    "end": "2026-09-30"
  },
  {
    "key": "gatech-services",
    "location": 5,
    "campaign": 1,
    "name": "Student Services Partner Display",
    "cost": 575,
    "scans": 8,
    "clickEvery": 3,
    "convertEvery": 8,
    "end": "2026-10-31"
  },
  {
    "key": "gatech-customers",
    "location": 5,
    "campaign": 2,
    "name": "Campus Referral Invitation Cards",
    "cost": 425,
    "scans": 11,
    "clickEvery": 4,
    "convertEvery": 10,
    "end": "2026-11-30"
  },
  {
    "key": "gastate-talent",
    "location": 6,
    "campaign": 0,
    "name": "Career Fair Welcome Display",
    "cost": 750,
    "scans": 8,
    "clickEvery": 3,
    "convertEvery": 8,
    "end": "2026-09-30"
  },
  {
    "key": "gastate-services",
    "location": 6,
    "campaign": 1,
    "name": "Student Services Partner Display",
    "cost": 600,
    "scans": 6,
    "clickEvery": 4,
    "convertEvery": 10,
    "end": "2026-10-31"
  },
  {
    "key": "gastate-customers",
    "location": 6,
    "campaign": 2,
    "name": "Campus Referral Invitation Cards",
    "cost": 450,
    "scans": 9,
    "clickEvery": 2,
    "convertEvery": 12,
    "end": "2026-11-30"
  },
  {
    "key": "gasouthern-talent",
    "location": 7,
    "campaign": 0,
    "name": "Career Fair Welcome Display",
    "cost": 775,
    "scans": 9,
    "clickEvery": 4,
    "convertEvery": 10,
    "end": "2026-09-30"
  },
  {
    "key": "gasouthern-services",
    "location": 7,
    "campaign": 1,
    "name": "Student Services Partner Display",
    "cost": 625,
    "scans": 7,
    "clickEvery": 2,
    "convertEvery": 12,
    "end": "2026-10-31"
  },
  {
    "key": "gasouthern-customers",
    "location": 7,
    "campaign": 2,
    "name": "Campus Referral Invitation Cards",
    "cost": 475,
    "scans": 10,
    "clickEvery": 3,
    "convertEvery": 8,
    "end": "2026-11-30"
  }
];
const available = [
  {
    "location": 0,
    "name": "Career Fair Referral Booth",
    "cost": 450,
    "unit": "Per Event",
    "term": 1,
    "termUnit": "Events",
    "description": "Illustrative campus referral-acquisition placement. No university affiliation, endorsement or actual inventory is implied. Start the VIA VIA onboarding exercise here."
  },
  {
    "location": 1,
    "name": "Student Organization Sponsor",
    "cost": 600,
    "unit": "Per Campaign",
    "term": 1,
    "termUnit": "Semesters",
    "description": "Illustrative campus referral-acquisition placement. No university affiliation, endorsement or actual inventory is implied. "
  },
  {
    "location": 2,
    "name": "Campus Newsletter Referral Feature",
    "cost": 250,
    "unit": "Per Campaign",
    "term": 1,
    "termUnit": "Issues",
    "description": "Illustrative campus referral-acquisition placement. No university affiliation, endorsement or actual inventory is implied. "
  },
  {
    "location": 3,
    "name": "Campus Networking Event Sponsor",
    "cost": 350,
    "unit": "Per Event",
    "term": 1,
    "termUnit": "Events",
    "description": "Illustrative campus referral-acquisition placement. No university affiliation, endorsement or actual inventory is implied. "
  },
  {
    "location": 4,
    "name": "Career Fair Referral Booth",
    "cost": 450,
    "unit": "Per Event",
    "term": 1,
    "termUnit": "Events",
    "description": "Illustrative campus referral-acquisition placement. No university affiliation, endorsement or actual inventory is implied. "
  },
  {
    "location": 5,
    "name": "Student Organization Sponsor",
    "cost": 600,
    "unit": "Per Campaign",
    "term": 1,
    "termUnit": "Semesters",
    "description": "Illustrative campus referral-acquisition placement. No university affiliation, endorsement or actual inventory is implied. "
  },
  {
    "location": 6,
    "name": "Campus Newsletter Referral Feature",
    "cost": 250,
    "unit": "Per Campaign",
    "term": 1,
    "termUnit": "Issues",
    "description": "Illustrative campus referral-acquisition placement. No university affiliation, endorsement or actual inventory is implied. "
  },
  {
    "location": 7,
    "name": "Campus Networking Event Sponsor",
    "cost": 350,
    "unit": "Per Event",
    "term": 1,
    "termUnit": "Events",
    "description": "Illustrative campus referral-acquisition placement. No university affiliation, endorsement or actual inventory is implied. "
  }
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
    await client.query("SELECT pg_advisory_xact_lock(2026091834)");
    await client.query(`CREATE TABLE IF NOT EXISTS vivid_evaluation_fixtures (
      fixture_key TEXT PRIMARY KEY, organization_id INTEGER NOT NULL,
      manifest JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const prior = await client.query("SELECT manifest FROM vivid_evaluation_fixtures WHERE fixture_key=$1",[KEY]);
    if (prior.rows.length) { await client.query("COMMIT"); return {alreadyLoaded:true,...prior.rows[0].manifest}; }
    const existing = await client.query("SELECT id FROM users WHERE LOWER(TRIM(email))=$1",['jvac@acqnet.com']);
    if(existing.rows.length) throw new Error("Jim email already exists; review ownership before loading.");
    const duplicate = await client.query("SELECT id FROM organizations WHERE name=$1 OR slug=$2",
      ['VIA VIA','via-via-demo']);
    if(duplicate.rows.length) throw new Error("Jim demo organization already exists without fixture marker.");
    const user=await client.query(`INSERT INTO users(name,email,password,role,account_status,company_name)
      VALUES('James Vaccarino','jvac@acqnet.com',NULL,'customer','pending','VIA VIA') RETURNING id`);
    OWNER=Number(user.rows[0].id);
    const org=await client.query(`INSERT INTO organizations(customer_id,name,organization_type,contact_name,contact_email,
      notes,is_active,slug,public_heading,public_description)
      VALUES($1,'VIA VIA','Evaluation','James Vaccarino','jvac@acqnet.com',$2,true,
      'via-via-demo','Explore VIA VIA’s Vivid demonstration',$2) RETURNING id`,[OWNER,NOTICE]);
    ORG=Number(org.rows[0].id);
    const membership=await client.query(`INSERT INTO organization_users(organization_id,user_id,role,is_active)
      VALUES($1,$2,'organization_admin',true) RETURNING id`,[ORG,OWNER]);
    const program=await client.query(`INSERT INTO organization_programs(organization_id,name,description,program_type)
      VALUES($1,'VIA VIA Evaluation (TEST)',$2,'advertising') RETURNING id`,[ORG,NOTICE]);
    PROGRAM=Number(program.rows[0].id);
    if(![ORG,OWNER,PROGRAM].every(x=>Number.isSafeInteger(x)&&x>0))throw new Error("Invalid new account identifiers");
    await client.query(`INSERT INTO organization_user_invitations(organization_id,user_id,organization_user_id,email,token_hash,expires_at)
      VALUES($1,$2,$3,'jvac@acqnet.com',$4,CURRENT_TIMESTAMP+INTERVAL '7 days')`,
      [ORG,OWNER,membership.rows[0].id,'752e07bd756013f71cd256fff554088c38274a2d029234a4d806b34712356da1']);
    const manifest = {fixture:KEY,start:START,end:END,organizationId:ORG,advertiserAccountId:OWNER,programId:PROGRAM,locations:[],campaigns:[],placements:[],opportunities:[],contracts:[],totals:{scans:0,clicks:0,conversions:0,revenue:0}};
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
        VALUES($1,$2,$3,$4,$5,'https://justviavia.com/',$6,true,$7::date,$7::date,$8::date,$7::date,false) RETURNING id`,
        [c.name,c.advertiser,a.rows[0].id,OWNER,ORG,c.value,START,c.end]);
      const dest = await client.query(`INSERT INTO campaign_destinations(campaign_id,name,destination_type,destination_url,estimated_value,display_order,is_active)
        VALUES($1,'VIA VIA — add an instrumented campaign landing page','website','https://justviavia.com/',$2,1,true) RETURNING id`,[r.rows[0].id,c.value]);
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
        VALUES($1,$2,${PROGRAM},$3,$4,$5,$6,$7,$7,'Per Campaign',$8,'Days','Approved',$9,true) RETURNING id`,
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
      VALUES($1,$2,'event','Demo — VIA VIA Campus Referral Evening','community','2026-09-25T21:00:00Z','2026-09-26T01:00:00Z','America/New_York',$3,90,true)`,
      [manifest.placements[2].id,manifest.campaigns[2].id,NOTICE]);
    for(let i=0;i<available.length;i++){
      const o=available[i], locationId=manifest.locations[o.location].id;
      const params=[ORG,locationId,`Demo — ${o.name}`,`${NOTICE} ${o.description}`,locations[o.location].kind,o.cost,o.unit,o.term,o.termUnit,20+i];
      let r;
      if(o.existing){
        r=await client.query(`UPDATE organization_opportunities SET title=$3,description=$4,category=$5,price=$6,annual_price=$6,
          pricing_unit=$7,suggested_term_length=$8,suggested_term_unit=$9,display_order=$10
          WHERE organization_id=$1 AND space_id=$2 AND id=$11 AND status='Available'
          AND title LIKE 'Jim Evaluation%' AND NOT EXISTS(SELECT 1 FROM organization_advertising_requests WHERE opportunity_id=$11)
          RETURNING id`,[...params,o.existing]);
        if(r.rows.length!==1)throw new Error("Evaluation opportunity changed or has a request; no fixture loaded.");
      }else r=await client.query(`INSERT INTO organization_opportunities(organization_id,space_id,program_id,title,description,category,price,annual_price,
        pricing_unit,suggested_term_length,suggested_term_unit,display_order,status,is_active)
        VALUES($1,$2,${PROGRAM},$3,$4,$5,$6,$6,$7,$8,$9,$10,'Available',true) RETURNING id`,params);
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
      VALUES($1,$2,$3,$4,'Demo historical customer','jim-evaluation@example.invalid','DEMO — no telephone',$5,
       'https://justviavia.com/',$6,$7,$8,'Per Campaign',$9,'Days','Approved','Campaign Created',
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
  try{client=await pool.connect(); const result=await seed(client);console.log("Jim evaluation fixture:",JSON.stringify(result));}
  finally{if(client)client.release();await pool.end();}
}
if(require.main===module)main().catch(error=>{
  // An optional fixture must never prevent the production application starting.
  console.error("Jim evaluation was NOT loaded:",error.message);
});
module.exports={KEY,START,END,locations,campaigns,placements,available,buildEvents,seed};
