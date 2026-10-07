"use strict";
const { Pool } = require("pg");

const KEY = "hfhs-enterprise-demo-2026-10-v1";
const EMAIL = "michaelandrewdevoe@gmail.com";
const CONTACT = "Michael DeVoe";
const ORG_NAME = "Henry Ford Health System — Vivid Demo";
const SLUG = "henry-ford-health-demo";
const START = "2026-09-08";
const END = "2026-10-07";
const NOTICE = "PRIVATE VIVID DEMONSTRATION — illustrative sponsorship inventory and simulated performance data for discussion with Henry Ford Health. This is not an official Henry Ford Health marketplace, offer, endorsement, invoice, or performance claim.";

const programs = [
  {
    key:"events", name:"Fundraising & Events", type:"sponsorship",
    description:"Event sponsorship inventory, hospitality and named activations with measurable fulfillment and sponsor performance.",
    location:"Fundraising & Signature Events", market:"Detroit, MI"
  },
  {
    key:"trade", name:"Trade Shows & Conferences", type:"sponsorship",
    description:"Exhibit booths and conference sponsorship inventory, from registration and lanyards to high-traffic attendee activations.",
    location:"Trade Shows & Conferences", market:"Detroit, MI"
  },
  {
    key:"cme", name:"CME & Medical Education", type:"sponsorship",
    description:"Medical education exhibitor and sponsorship opportunities with trackable attendee engagement.",
    location:"CME & Medical Education", market:"Michigan"
  },
  {
    key:"community", name:"Community & Health Activations", type:"sponsorship",
    description:"Community wellness, screening and outreach activations measured from physical engagement through downstream action.",
    location:"Community Health Activations", market:"Southeast Michigan"
  },
  {
    key:"strategic", name:"Sports & Strategic Partnerships", type:"sponsorship",
    description:"Major partnership and destination activations with portfolio-level performance reporting.",
    location:"Sports & Strategic Partnerships", market:"Detroit, MI"
  }
];

const opportunities = [
  {program:"events", title:"Pink Ball — Event Sponsor", price:15000, unit:"Per Event", term:1, termUnit:"Events", category:"Fundraising Event", label:"PINK BALL", description:"Publicly advertised Pink Ball Event Sponsor level used here to demonstrate a digital purchase and onboarding journey. Includes event recognition and sponsor benefits; Vivid would manage availability, sponsor assets, fulfillment and performance reporting."},
  {program:"events", title:"Pink Ball — Diamond Sponsor", price:10000, unit:"Per Event", term:1, termUnit:"Events", category:"Fundraising Event", label:"DIAMOND", description:"Publicly advertised Pink Ball Diamond Sponsor level used to demonstrate a measurable sponsorship package and streamlined sponsor onboarding."},
  {program:"events", title:"Pink Ball — Bar Sponsor", price:7500, unit:"Per Event", term:1, termUnit:"Events", category:"Event Activation", label:"BAR ACTIVATION", description:"Publicly advertised Pink Ball bar sponsorship used to demonstrate how a specific high-traffic physical activation can be sold, fulfilled and measured."},

  {program:"trade", title:"Conference Exhibit Booth", price:null, unit:"Per Event", term:1, termUnit:"Events", category:"Trade Show Booth", label:"EXHIBIT BOOTH", description:"Illustrative booth sponsorship card. Sponsor selects booth opportunity, submits company and creative assets, receives fulfillment reminders, and gets a real Vivid performance dashboard after the event."},
  {program:"trade", title:"Conference Registration Sponsor", price:null, unit:"Per Event", term:1, termUnit:"Events", category:"Conference Sponsorship", label:"REGISTRATION", description:"Illustrative registration-area sponsorship with trackable signage, QR engagement and attendee actions."},
  {program:"trade", title:"Conference Lanyard Sponsor", price:null, unit:"Per Event", term:1, termUnit:"Events", category:"Conference Sponsorship", label:"LANYARD", description:"Illustrative high-frequency attendee branding opportunity. Vivid would track the associated activation touchpoints and sponsor outcomes."},

  {program:"cme", title:"CME Exhibitor", price:2000, unit:"Starting At", term:1, termUnit:"Events", category:"Medical Education", label:"CME EXHIBITOR", description:"Demonstration based on Henry Ford's publicly advertised CME exhibit opportunities beginning at $2,000. Vivid connects exhibit engagement to trackable follow-up actions."},
  {program:"cme", title:"Clinical Symposium Session Sponsor", price:null, unit:"Per Event", term:1, termUnit:"Events", category:"Medical Education", label:"SESSION", description:"Illustrative session sponsorship with measured content engagement, booth traffic and post-event follow-up."},
  {program:"cme", title:"Networking Reception Sponsor", price:null, unit:"Per Event", term:1, termUnit:"Events", category:"Medical Education", label:"RECEPTION", description:"Illustrative networking reception sponsorship with sponsor fulfillment and engagement measurement."},

  {program:"community", title:"Community Health Screening Activation", price:null, unit:"Per Activation", term:1, termUnit:"Activations", category:"Community Health", label:"SCREENING", description:"Illustrative community activation tying physical signage and QR engagement to screening registration or other approved downstream actions."},
  {program:"community", title:"Community Wellness Partner", price:null, unit:"Per Program", term:1, termUnit:"Programs", category:"Community Health", label:"WELLNESS", description:"Illustrative community wellness partnership with measurable participation and follow-up engagement."},
  {program:"community", title:"Mobile Health Event Sponsor", price:null, unit:"Per Event", term:1, termUnit:"Events", category:"Community Health", label:"MOBILE HEALTH", description:"Illustrative mobile health event sponsorship showing how an activation can be sold, fulfilled and measured inside Vivid."},

  {program:"strategic", title:"Arena Health Activation", price:null, unit:"Custom", term:1, termUnit:"Campaigns", category:"Strategic Partnership", label:"ARENA", description:"Illustrative sports-partnership activation designed to show how multiple physical assets can roll into one partnership performance view."},
  {program:"strategic", title:"Youth Health Program Sponsor", price:null, unit:"Custom", term:1, termUnit:"Programs", category:"Strategic Partnership", label:"YOUTH HEALTH", description:"Illustrative community sports and health sponsorship with measurable program participation and downstream engagement."},
  {program:"strategic", title:"Destination: Grand Experience Sponsor", price:null, unit:"Custom", term:1, termUnit:"Campaigns", category:"Future of Health", label:"DESTINATION GRAND", description:"Illustrative flagship activation showing how Vivid could package, fulfill and measure a major Future of Health / Destination: Grand sponsorship experience."}
];

const measured = [
  {program:"events", name:"Pink Ball — Bar Activation", cost:7500, value:450, scans:11, clickEvery:3, convertEvery:7},
  {program:"events", name:"Pink Ball — Event Signage", cost:15000, value:450, scans:9, clickEvery:4, convertEvery:8},
  {program:"trade", name:"Conference Exhibit Booth", cost:5000, value:1200, scans:13, clickEvery:3, convertEvery:8},
  {program:"trade", name:"Registration Area Sponsor", cost:7500, value:1200, scans:8, clickEvery:3, convertEvery:9},
  {program:"cme", name:"CME Exhibitor Engagement", cost:2000, value:1800, scans:10, clickEvery:3, convertEvery:8},
  {program:"cme", name:"Clinical Symposium Session", cost:7500, value:1800, scans:7, clickEvery:3, convertEvery:9},
  {program:"community", name:"Community Screening Activation", cost:10000, value:250, scans:15, clickEvery:2, convertEvery:10},
  {program:"community", name:"Wellness Program Activation", cost:7500, value:250, scans:12, clickEvery:3, convertEvery:9},
  {program:"strategic", name:"Arena Health Activation", cost:25000, value:900, scans:16, clickEvery:3, convertEvery:10},
  {program:"strategic", name:"Destination: Grand Experience", cost:50000, value:900, scans:14, clickEvery:4, convertEvery:10}
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
  <text x="70" y="590" font-family="Arial" font-size="26" fill="#e9f4ff">Henry Ford Health sponsorship marketplace concept</text>
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

async function seed(client){
  await client.query("BEGIN");
  try{
    await client.query("SELECT pg_advisory_xact_lock(2026100701)");
    await client.query(`CREATE TABLE IF NOT EXISTS vivid_evaluation_fixtures(
      fixture_key TEXT PRIMARY KEY, organization_id INTEGER NOT NULL,
      manifest JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const prior=await client.query("SELECT manifest FROM vivid_evaluation_fixtures WHERE fixture_key=$1",[KEY]);
    if(prior.rows.length){ await client.query("COMMIT"); return {alreadyLoaded:true,...prior.rows[0].manifest}; }

    let ownerResult=await client.query("SELECT id,name,email FROM users WHERE LOWER(TRIM(email))=$1 ORDER BY id LIMIT 1",[EMAIL]);
    let ownerCreated=false;
    if(!ownerResult.rows.length){
      ownerResult=await client.query(`INSERT INTO users(name,email,password,role,account_status,company_name)
        VALUES($1,$2,NULL,'customer','pending',$3) RETURNING id,name,email`,[CONTACT,EMAIL,ORG_NAME]);
      ownerCreated=true;
    }
    const owner=Number(ownerResult.rows[0].id);

    const duplicate=await client.query("SELECT id FROM organizations WHERE slug=$1 OR LOWER(TRIM(name))=LOWER(TRIM($2)) LIMIT 1",[SLUG,ORG_NAME]);
    if(duplicate.rows.length) throw new Error("HFHS demo organization exists without fixture marker; review before loading.");

    const orgResult=await client.query(`INSERT INTO organizations(customer_id,name,organization_type,contact_name,contact_email,notes,is_active,slug,public_heading,public_description)
      VALUES($1,$2,'Enterprise',$3,$4,$5,true,$6,
      'Henry Ford Health Sponsorship Marketplace — Vivid Demonstration',
      'Explore sponsorship and activation opportunities across events, conferences, medical education, community health and strategic partnerships. Select a card to experience the Vivid onboarding workflow. PRIVATE DEMONSTRATION ONLY.')
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
      manifest.opportunities.push({id:Number(r.rows[0].id),program:o.program,title:o.title,price:o.price});
    }

    // One test campaign per marketplace family powers the real Vivid dashboard.
    const campaigns={};
    for(let i=0;i<programs.length;i++){
      const p=programs[i], sample=measured.find(x=>x.program===p.key), location=getLocation(p.key);
      const advertiser=await client.query(`INSERT INTO advertisers(customer_id,organization_id,name,notes,relationship_status,is_active)
        VALUES($1,$2,$3,$4,'Active',true) RETURNING id`,[owner,org,`Demo Sponsor — ${p.name}`,NOTICE]);
      const campaign=await client.query(`INSERT INTO campaigns(name,advertiser,advertiser_id,user_id,organization_id,campaign_url,
        avg_customer_value,is_test,start_date,live_date,end_date,created_at,is_archived)
        VALUES($1,$2,$3,$4,$5,'https://www.henryford.com/',$6,true,$7::date,$7::date,$8::date,$7::date,false) RETURNING id`,[
          `HFHS Demo — ${p.name}`,`Demo Sponsor — ${p.name}`,advertiser.rows[0].id,owner,org,sample.value,START,END
        ]);
      const dest=await client.query(`INSERT INTO campaign_destinations(campaign_id,name,destination_type,destination_url,estimated_value,display_order,is_active)
        VALUES($1,$2,'website','https://www.henryford.com/',$3,1,true) RETURNING id`,[campaign.rows[0].id,`${p.name} — demonstration destination`,sample.value]);
      campaigns[p.key]={id:Number(campaign.rows[0].id),advertiserId:Number(advertiser.rows[0].id),destinationId:Number(dest.rows[0].id)};
      manifest.campaigns.push({program:p.key,id:Number(campaign.rows[0].id),name:`HFHS Demo — ${p.name}`});
    }

    for(let i=0;i<measured.length;i++){
      const m=measured[i], program=getProgram(m.program), location=getLocation(m.program), campaign=campaigns[m.program];
      const qr=await client.query(`INSERT INTO qr_codes(space_id,name,description,is_active,is_archived,annual_cost,total_cost,annual_impressions,live_date,end_date,created_at)
        VALUES($1,$2,$3,true,false,$4,$4,0,$5::date,$6::date,$5::date) RETURNING id`,[location.id,`HFHS Demo — ${m.name}`,NOTICE,m.cost,START,END]);
      const qrId=Number(qr.rows[0].id);
      await client.query(`INSERT INTO qr_campaigns(qr_id,campaign_id,contract_days,is_active,started_at,assigned_at)
        VALUES($1,$2,30,true,$3::date,$3::date)`,[qrId,campaign.id,START]);
      const activeOpp=await client.query(`INSERT INTO organization_opportunities(organization_id,space_id,program_id,qr_id,title,description,category,
        price,annual_price,pricing_unit,suggested_term_length,suggested_term_unit,status,display_order,is_active)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,'Per Campaign',30,'Days','Approved',$9,true) RETURNING id`,[
          org,location.id,program.id,qrId,`HFHS Demo Active — ${m.name}`,NOTICE,program.name,m.cost,100+i
        ]);
      const contract=await client.query(`INSERT INTO contracts(customer_id,organization_id,advertiser_id,location_id,qr_id,opportunity_id,
        contract_name,contract_type,start_date,end_date,expiration_date,renewal_date,total_contract_value,billing_frequency,status,source_type,notes,created_at,activated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,'Advertising',$8::date,$9::date,$9::date,$9::date-7,$10,'One-Time','Active','Manual',$11,$8::date,$8::date) RETURNING id`,[
          owner,org,campaign.advertiserId,location.id,qrId,activeOpp.rows[0].id,`HFHS Demo — ${m.name}`,START,END,m.cost,NOTICE
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
        VALUES($1,$2,$3,$4,'Demo Sponsor Contact','hfhs-demo@example.invalid','DEMO',$5,'https://www.henryford.com/',$6,$7,$8,'Per Campaign',
        30,'Days','Approved','Campaign Created',$9,$10,$11,$12,$13::date,$13::date,$13::date,$13::date)`,[
          org,location.id,activeOpp.rows[0].id,`Demo Sponsor — ${program.name}`,manifest.campaigns.find(x=>x.program===m.program).name,
          NOTICE,`HFHS Demo Active — ${m.name}`,m.cost,owner,contract.rows[0].id,qrId,campaign.id,START
        ]);
      manifest.placements.push({program:m.program,qrId,campaignId:campaign.id,name:m.name,cost:m.cost,...totals});
    }

    await client.query("INSERT INTO vivid_evaluation_fixtures(fixture_key,organization_id,manifest) VALUES($1,$2,$3::jsonb)",[KEY,org,JSON.stringify(manifest)]);
    await client.query("COMMIT");
    return manifest;
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main(){
  if(!process.env.DATABASE_URL){ console.log("HFHS ENTERPRISE DEMO: DATABASE_URL not set; skipped."); return; }
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  let client;
  try{
    client=await pool.connect();
    const result=await seed(client);
    console.log("HFHS ENTERPRISE DEMO:",JSON.stringify(result));
  }finally{
    if(client) client.release();
    await pool.end();
  }
}

if(require.main===module) main().catch(error=>{
  // Demo data must never prevent the production application from starting.
  console.error("HFHS ENTERPRISE DEMO ERROR:",error);
});
module.exports={KEY,EMAIL,ORG_NAME,SLUG,START,END,programs,opportunities,measured,buildEvents,seed};
