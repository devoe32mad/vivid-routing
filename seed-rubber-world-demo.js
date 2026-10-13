"use strict";
const { Pool } = require("pg");

const KEY = "rubber-world-enterprise-demo-2026-10-v1";
const EMAIL = "rubber-world-demo@example.invalid";
const CONTACT = "Michael DeVoe";
const ORG_NAME = "Rubber World Magazine — Vivid Demo";
const SLUG = "rubber-world-demo";
const START = "2026-09-14";
const END = "2026-10-13";
const CONTRACT_END = "2026-11-12";
const NOTICE = "PRIVATE VIVID DEMONSTRATION — illustrative advertising inventory and simulated performance data for discussion with Rubber World. This is not an official Rubber World marketplace, offer, endorsement, invoice, or performance claim.";

const programs = [
  {
    "key": "print",
    "name": "Print Issues",
    "type": "publication",
    "description": "Print advertising by issue, placement and advertiser, with dynamic QR engagement and renewal visibility.",
    "location": "October 2026 \u2014 Print Issue",
    "market": "Print"
  },
  {
    "key": "digital",
    "name": "Digital Editions",
    "type": "publication",
    "description": "Linked advertising in digital editions, connected to advertiser activity and campaign outcomes.",
    "location": "October 2026 \u2014 Digital Edition",
    "market": "Digital"
  },
  {
    "key": "website",
    "name": "Website Advertising",
    "type": "publication",
    "description": "Website advertising placements with campaign links, advertiser reporting and contract visibility.",
    "location": "October 2026 \u2014 Website Inventory",
    "market": "Website"
  }
];
const opportunities = [
  {
    "program": "print",
    "title": "Inside Front Cover",
    "price": 2800,
    "unit": "Per Issue",
    "term": 1,
    "termUnit": "Issues",
    "category": "Print",
    "label": "PRINT",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  },
  {
    "program": "print",
    "title": "Full Page Color",
    "price": 2200,
    "unit": "Per Issue",
    "term": 1,
    "termUnit": "Issues",
    "category": "Print",
    "label": "PRINT",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  },
  {
    "program": "print",
    "title": "Half Page Color",
    "price": 1300,
    "unit": "Per Issue",
    "term": 1,
    "termUnit": "Issues",
    "category": "Print",
    "label": "PRINT",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  },
  {
    "program": "print",
    "title": "Back Cover",
    "price": 3200,
    "unit": "Per Issue",
    "term": 1,
    "termUnit": "Issues",
    "category": "Print",
    "label": "PRINT",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  },
  {
    "program": "digital",
    "title": "Opening Spread",
    "price": 1800,
    "unit": "Per Issue",
    "term": 1,
    "termUnit": "Issues",
    "category": "Digital",
    "label": "DIGITAL",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  },
  {
    "program": "digital",
    "title": "Linked Full Page",
    "price": 1400,
    "unit": "Per Issue",
    "term": 1,
    "termUnit": "Issues",
    "category": "Digital",
    "label": "DIGITAL",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  },
  {
    "program": "digital",
    "title": "Product Spotlight",
    "price": 900,
    "unit": "Per Issue",
    "term": 1,
    "termUnit": "Issues",
    "category": "Digital",
    "label": "DIGITAL",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  },
  {
    "program": "digital",
    "title": "Edition Package",
    "price": 2400,
    "unit": "Per Issue",
    "term": 1,
    "termUnit": "Issues",
    "category": "Digital",
    "label": "DIGITAL",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  },
  {
    "program": "website",
    "title": "Homepage Banner",
    "price": 1600,
    "unit": "Per Month",
    "term": 1,
    "termUnit": "Months",
    "category": "Website",
    "label": "WEBSITE",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  },
  {
    "program": "website",
    "title": "Article Banner",
    "price": 1000,
    "unit": "Per Month",
    "term": 1,
    "termUnit": "Months",
    "category": "Website",
    "label": "WEBSITE",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  },
  {
    "program": "website",
    "title": "Product Directory Feature",
    "price": 750,
    "unit": "Per Month",
    "term": 1,
    "termUnit": "Months",
    "category": "Website",
    "label": "WEBSITE",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  },
  {
    "program": "website",
    "title": "Monthly Display Package",
    "price": 2500,
    "unit": "Per Month",
    "term": 1,
    "termUnit": "Months",
    "category": "Website",
    "label": "WEBSITE",
    "description": "Illustrative advertising placement and sample rate for discussion. Includes advertiser setup, campaign destination, creative fulfillment and placement reporting. Confirm specifications and pricing with Rubber World."
  }
];
const measured = [
  {
    "program": "print",
    "name": "Full Page \u2014 Materials Supplier",
    "cost": 1500,
    "value": 1200,
    "scans": 8,
    "clickEvery": 3,
    "convertEvery": 6
  },
  {
    "program": "print",
    "name": "Half Page \u2014 Equipment Manufacturer",
    "cost": 2000,
    "value": 1200,
    "scans": 11,
    "clickEvery": 3,
    "convertEvery": 6
  },
  {
    "program": "digital",
    "name": "Linked Ad \u2014 Materials Supplier",
    "cost": 1500,
    "value": 1200,
    "scans": 8,
    "clickEvery": 3,
    "convertEvery": 6
  },
  {
    "program": "digital",
    "name": "Product Spotlight \u2014 Testing Laboratory",
    "cost": 2000,
    "value": 1200,
    "scans": 11,
    "clickEvery": 3,
    "convertEvery": 6
  },
  {
    "program": "website",
    "name": "Homepage Banner \u2014 Equipment Manufacturer",
    "cost": 1500,
    "value": 1200,
    "scans": 8,
    "clickEvery": 3,
    "convertEvery": 6
  },
  {
    "program": "website",
    "name": "Directory Feature \u2014 Testing Laboratory",
    "cost": 2000,
    "value": 1200,
    "scans": 11,
    "clickEvery": 3,
    "convertEvery": 6
  }
];

function escapeXml(v){
  return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function cardSvg(label, title, index){
  const palettes=[
    ["#0b3b68","#3276a8"],["#6f163d","#df5f96"],["#12372a","#4f8b72"],
    ["#4a2d6f","#9b72bd"],["#49351a","#bd8f4b"]
  ];
  const p=palettes[index%palettes.length];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs>
  <rect width="1200" height="650" fill="url(#g)"/>
  <circle cx="980" cy="115" r="190" fill="rgba(255,255,255,.08)"/><circle cx="1050" cy="520" r="260" fill="rgba(255,255,255,.06)"/>
  <text x="70" y="110" font-family="Arial" font-size="32" fill="#d9ecff" font-weight="700">VIVID ENTERPRISE DEMO</text>
  <text x="70" y="315" font-family="Arial" font-size="64" fill="white" font-weight="800">${escapeXml(label)}</text>
  <foreignObject x="70" y="350" width="920" height="170"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial;color:white;font-size:34px;font-weight:700;line-height:1.2">${escapeXml(title)}</div></foreignObject>
  <text x="70" y="590" font-family="Arial" font-size="26" fill="#e9f4ff">Rubber World advertising marketplace concept</text>
  </svg>`);
}
function buildEvents(p,index,campaignId,qrId,destinationId){
  const out=[]; let seq=0;
  for(let day=0;day<30;day++){
    const d=new Date(`${START}T14:00:00.000Z`); d.setUTCDate(d.getUTCDate()+day);
    const count=p.scans + ((day+index)%4);
    for(let j=0;j<count;j++){
      seq++;
      const at=new Date(d.getTime()+j*260000);
      const clickId=`${KEY}:${index}:${day}:${j}`;
      const base={campaign_id:campaignId,qr_id:qrId,vivid_click_id:clickId,vivid_session_id:clickId};
      out.push({...base,type:"scan",value:0,created_at:at.toISOString(),campaign_destination_id:null});
      if(seq%p.clickEvery===0){
        out.push({...base,type:"destination_click",value:0,created_at:new Date(+at+15000).toISOString(),campaign_destination_id:destinationId});
        if((seq/p.clickEvery)%p.convertEvery===0){
          out.push({...base,type:"conversion",value:p.value,created_at:new Date(+at+120000).toISOString(),campaign_destination_id:destinationId});
        }
      }
    }
  }
  return out;
}

async function reconcilePending(client,manifest){
  await client.query(`INSERT INTO organization_advertising_requests(
    organization_id,location_id,opportunity_id,business_name,contact_name,email,phone,
    campaign_name,destination_url,campaign_notes,opportunity_name,price,pricing_unit,
    suggested_term_length,suggested_term_unit,status,setup_status,created_vivid_user_id,
    submitted_at,created_at,updated_at)
    SELECT o.id,oo.space_id,oo.id,'Demo Advertiser — Pending Package','Vivid Demo',
      $3::text,'DEMO','Rubber World — Pending '||oo.title,'https://example.com/',$4,
      oo.title,oo.price,oo.pricing_unit,oo.suggested_term_length,oo.suggested_term_unit,
      'Pending','Demo Pending',o.customer_id,$6::date,$6::date,CURRENT_TIMESTAMP
    FROM organization_opportunities oo JOIN organizations o ON o.id=oo.organization_id
    JOIN users u ON u.id=o.customer_id
    WHERE o.id=$1 AND o.customer_id=$2 AND u.email=$3::text AND o.slug=$5::text AND oo.status='Pending'
      AND NOT EXISTS(SELECT 1 FROM organization_advertising_requests ar
        WHERE ar.organization_id=o.id AND ar.opportunity_id=oo.id)
  `,[manifest.organizationId,manifest.ownerId,EMAIL,NOTICE,SLUG,END]);
}

async function seed(client){
  await client.query("BEGIN");
  try{
    await client.query("SELECT pg_advisory_xact_lock(2026101301)");
    await client.query(`CREATE TABLE IF NOT EXISTS vivid_evaluation_fixtures(
      fixture_key TEXT PRIMARY KEY, organization_id INTEGER NOT NULL,
      manifest JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const prior=await client.query("SELECT manifest FROM vivid_evaluation_fixtures WHERE fixture_key=$1",[KEY]);
    if(prior.rows.length){
      const manifest=prior.rows[0].manifest;
      await require('./rubber-world-catalogue').expand(client,manifest,{EMAIL,SLUG,NOTICE,START});
      await reconcilePending(client,manifest);
      await client.query('UPDATE vivid_evaluation_fixtures SET manifest=$1::jsonb WHERE organization_id=$2 AND fixture_key=$3',[JSON.stringify(manifest),manifest.organizationId,KEY]);
      await client.query("COMMIT"); return {alreadyLoaded:true,...manifest};
    }

    let ownerResult=await client.query("SELECT id,name,email FROM users WHERE LOWER(TRIM(email))=$1 ORDER BY id LIMIT 1",[EMAIL]);
    let ownerCreated=false;
    if(ownerResult.rows.length) throw new Error("Demo owner already exists without fixture marker; review before loading.");
    if(!ownerResult.rows.length){
      ownerResult=await client.query(`INSERT INTO users(name,email,password,role,account_status,company_name)
        VALUES($1,$2,NULL,'customer','pending',$3) RETURNING id,name,email`,[CONTACT,EMAIL,ORG_NAME]);
      ownerCreated=true;
    }
    const owner=Number(ownerResult.rows[0].id);

    const duplicate=await client.query("SELECT id FROM organizations WHERE slug=$1 OR LOWER(TRIM(name))=LOWER(TRIM($2)) LIMIT 1",[SLUG,ORG_NAME]);
    if(duplicate.rows.length) throw new Error("RUBBER WORLD demo organization exists without fixture marker; review before loading.");

    const orgResult=await client.query(`INSERT INTO organizations(customer_id,name,organization_type,contact_name,contact_email,notes,is_active,slug,public_heading,public_description)
      VALUES($1,$2,'Enterprise',$3,$4,$5,true,$6,
      'Rubber World Advertising Marketplace — Vivid Demonstration',
      'Explore illustrative print issues, digital editions and website placements. Sample rates and activity are demonstration data, not Rubber World offers or reported results.')
      RETURNING id`,[owner,ORG_NAME,CONTACT,EMAIL,NOTICE,SLUG]);
    const org=Number(orgResult.rows[0].id);

    const existingMembership=await client.query("SELECT id FROM organization_users WHERE organization_id=$1 AND user_id=$2 LIMIT 1",[org,owner]);
    if(!existingMembership.rows.length){
      await client.query("INSERT INTO organization_users(organization_id,user_id,role,is_active) VALUES($1,$2,'organization_admin',true)",[org,owner]);
    }

    const manifest={fixture:KEY,organizationId:org,ownerId:owner,ownerCreated,programs:[],locations:[],opportunities:[],campaigns:[],placements:[],totals:{scans:0,clicks:0,conversions:0,revenue:0}};

    for(let i=0;i<programs.length;i++){
      const p=programs[i];
      const pr=await client.query(`INSERT INTO organization_programs(organization_id,name,description,program_type,audience_scope,display_order,is_active,created_at,updated_at)
        VALUES($1,$2,$3,$4,'organization',$5,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`,[org,p.name,p.description,p.type,i+1]);
      const programId=Number(pr.rows[0].id);
      const sr=await client.query(`INSERT INTO spaces(user_id,organization_id,name,location,description,live_date,created_at)
        VALUES($1,$2,$3,$4,$5,$6::date,$6::date) RETURNING id`,[owner,org,p.location,p.market,`${NOTICE} ${p.description}`,START]);
      manifest.programs.push({key:p.key,id:programId,name:p.name});
      manifest.locations.push({key:p.key,id:Number(sr.rows[0].id),name:p.location});
    }

    const getProgram=key=>manifest.programs.find(x=>x.key===key);
    const getLocation=key=>manifest.locations.find(x=>x.key===key);

    for(let i=0;i<opportunities.length;i++){
      const o=opportunities[i], program=getProgram(o.program), location=getLocation(o.program), photo=cardSvg(o.label,o.title,i);
      const r=await client.query(`INSERT INTO organization_opportunities(
        organization_id,space_id,program_id,title,description,category,price,annual_price,pricing_unit,
        suggested_term_length,suggested_term_unit,status,display_order,is_active,photo_data,photo_mime_type,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,'Available',$11,true,$12,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        RETURNING id`,[
          org,location.id,program.id,o.title,`${NOTICE}\n\n${o.description}`,o.category,(o.price ?? 0),o.unit,o.term,o.termUnit,i+1,photo,"image/svg+xml"
        ]);
      if(i%4===3) await client.query("UPDATE organization_opportunities SET status='Pending' WHERE id=$1 AND organization_id=$2",[r.rows[0].id,org]);
      manifest.opportunities.push({id:Number(r.rows[0].id),program:o.program,title:o.title,price:o.price});
    }

    // One test campaign per marketplace family powers the real Vivid dashboard.
    const campaigns={};
    for(let i=0;i<programs.length;i++){
      const p=programs[i], sample=measured.find(x=>x.program===p.key), location=getLocation(p.key);
      const advertiser=await client.query(`INSERT INTO advertisers(customer_id,organization_id,name,notes,relationship_status,is_active)
        VALUES($1,$2,$3,$4,'Active',true) RETURNING id`,[owner,org,`Demo Advertiser — ${p.name}`,NOTICE]);
      const campaign=await client.query(`INSERT INTO campaigns(name,advertiser,advertiser_id,user_id,organization_id,campaign_url,
        avg_customer_value,is_test,start_date,live_date,end_date,created_at,is_archived)
        VALUES($1,$2,$3,$4,$5,'https://example.com/',$6,true,$7::date,$7::date,$8::date,$7::date,false) RETURNING id`,[
          `RUBBER WORLD Demo — ${p.name}`,`Demo Advertiser — ${p.name}`,advertiser.rows[0].id,owner,org,sample.value,START,END
        ]);
      const dest=await client.query(`INSERT INTO campaign_destinations(campaign_id,name,destination_type,destination_url,estimated_value,display_order,is_active)
        VALUES($1,$2,'website','https://example.com/',$3,1,true) RETURNING id`,[campaign.rows[0].id,`${p.name} — demonstration destination`,sample.value]);
      campaigns[p.key]={id:Number(campaign.rows[0].id),advertiserId:Number(advertiser.rows[0].id),destinationId:Number(dest.rows[0].id)};
      manifest.campaigns.push({program:p.key,id:Number(campaign.rows[0].id),name:`RUBBER WORLD Demo — ${p.name}`});
    }

    for(let i=0;i<measured.length;i++){
      const m=measured[i], program=getProgram(m.program), location=getLocation(m.program), campaign=campaigns[m.program];
      const qr=await client.query(`INSERT INTO qr_codes(space_id,name,description,is_active,is_archived,annual_cost,total_cost,annual_impressions,live_date,end_date,created_at)
        VALUES($1,$2,$3,true,false,$4,$4,0,$5::date,$6::date,$5::date) RETURNING id`,[location.id,`RUBBER WORLD Demo — ${m.name}`,NOTICE,m.cost,START,CONTRACT_END]);
      const qrId=Number(qr.rows[0].id);
      await client.query(`INSERT INTO qr_campaigns(qr_id,campaign_id,contract_days,is_active,started_at,assigned_at)
        VALUES($1,$2,30,true,$3::date,$3::date)`,[qrId,campaign.id,START]);
      const activeOpp=await client.query(`INSERT INTO organization_opportunities(organization_id,space_id,program_id,qr_id,title,description,category,
        price,annual_price,pricing_unit,suggested_term_length,suggested_term_unit,status,display_order,is_active)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,'Per Campaign',30,'Days','Sold',$9,true) RETURNING id`,[
          org,location.id,program.id,qrId,`RUBBER WORLD Demo Active — ${m.name}`,NOTICE,program.name,m.cost,100+i
        ]);
      const contract=await client.query(`INSERT INTO contracts(customer_id,organization_id,advertiser_id,location_id,qr_id,opportunity_id,
        contract_name,contract_type,start_date,end_date,expiration_date,renewal_date,total_contract_value,billing_frequency,status,source_type,notes,created_at,activated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,'Advertising',$8::date,$9::date,$9::date,$9::date-7,$10,'One-Time','Active','Manual',$11,$8::date,$8::date) RETURNING id`,[
          owner,org,campaign.advertiserId,location.id,qrId,activeOpp.rows[0].id,`RUBBER WORLD Demo — ${m.name}`,START,CONTRACT_END,m.cost,NOTICE
        ]);
      const events=buildEvents(m,i,campaign.id,qrId,campaign.destinationId);
      await client.query(`INSERT INTO events(campaign_id,qr_id,type,value,created_at,vivid_click_id,vivid_session_id,campaign_destination_id)
        SELECT campaign_id,qr_id,type,value,created_at,vivid_click_id,vivid_session_id,campaign_destination_id
        FROM jsonb_to_recordset($1::jsonb) AS x(campaign_id integer,qr_id integer,type text,value numeric,created_at timestamp,
          vivid_click_id text,vivid_session_id text,campaign_destination_id integer)`,[JSON.stringify(events)]);
      const totals={scans:0,clicks:0,conversions:0,revenue:0};
      for(const e of events){
        if(e.type==="scan") totals.scans++;
        if(e.type==="destination_click") totals.clicks++;
        if(e.type==="conversion"){totals.conversions++;totals.revenue+=Number(e.value||0);}
      }
      Object.keys(totals).forEach(k=>manifest.totals[k]+=totals[k]);
      await client.query(`INSERT INTO organization_advertising_requests(
        organization_id,location_id,opportunity_id,business_name,contact_name,email,phone,
        campaign_name,destination_url,campaign_notes,opportunity_name,price,pricing_unit,
        suggested_term_length,suggested_term_unit,status,setup_status,created_vivid_user_id,
        created_contract_id,created_qr_id,created_campaign_id,approved_at,submitted_at,created_at,updated_at)
        VALUES($1,$2,$3,$4,'Demo Advertiser Contact','rubber-world-demo@example.invalid','DEMO',$5,'https://example.com/',$6,$7,$8,'Per Campaign',
        30,'Days','Approved','Campaign Created',$9,$10,$11,$12,$13::date,$13::date,$13::date,$13::date)`,[
          org,location.id,activeOpp.rows[0].id,`Demo Advertiser — ${program.name}`,manifest.campaigns.find(x=>x.program===m.program).name,
          NOTICE,`RUBBER WORLD Demo Active — ${m.name}`,m.cost,owner,contract.rows[0].id,qrId,campaign.id,START
        ]);
      manifest.placements.push({program:m.program,qrId,campaignId:campaign.id,name:m.name,cost:m.cost,...totals});
    }

    await require('./rubber-world-catalogue').expand(client,manifest,{EMAIL,SLUG,NOTICE,START});
    await reconcilePending(client,manifest);
    await client.query("INSERT INTO vivid_evaluation_fixtures(fixture_key,organization_id,manifest) VALUES($1,$2,$3::jsonb)",[KEY,org,JSON.stringify(manifest)]);
    await client.query("COMMIT");
    return manifest;
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main(){
  if(!process.env.DATABASE_URL){ console.log("RUBBER WORLD ENTERPRISE DEMO: DATABASE_URL not set; skipped."); return; }
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  let client;
  try{
    client=await pool.connect();
    const result=await seed(client);
    console.log("RUBBER WORLD ENTERPRISE DEMO:",JSON.stringify(result));
  }finally{
    if(client) client.release();
    await pool.end();
  }
}

if(require.main===module) main().catch(error=>{
  // Demo data must never prevent the production application from starting.
  console.error("RUBBER WORLD ENTERPRISE DEMO ERROR:",error);
});
module.exports={KEY,EMAIL,ORG_NAME,SLUG,START,END,programs,opportunities,measured,buildEvents,seed};
