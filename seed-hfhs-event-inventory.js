"use strict";
const { Pool } = require("pg");

const SLUG="henry-ford-health-demo";

const EVENTS = [
  {
    program:"Fundraising & Events",
    name:"Pink Ball 2026",
    location:"Country Club of Jackson · Jackson, MI",
    date:"2026-04-18",
    description:"Henry Ford Health's 2026 Pink Ball benefiting critical upgrades and priority needs within Henry Ford Jackson Hospital's Heart and Vascular Services.",
    opportunities:[
      {title:"Event Sponsor",price:15000,unit:"Per Event",category:"Pink Ball",order:1,description:"Published 2026 Pink Ball Event Sponsor package. Includes exclusive event signage, recognition in event marketing and printed/digital materials, a Henry Ford Health event-page link, spoken-program recognition, and two VIP tables of eight."},
      {title:"Diamond Sponsor",price:10000,unit:"Per Event",category:"Pink Ball",order:2,description:"Published 2026 Pink Ball Diamond Sponsor package. Includes event marketing recognition, exclusive event signage, printed/digital recognition, a website link, spoken-program recognition, and one priority table of eight."},
      {title:"Bar Sponsor — Have a Drink on Me",price:7500,unit:"Per Event",category:"Pink Ball",order:3,description:"Published Pink Ball bar sponsorship. Includes branding on bar/signature-drink signage and VIP drink tokens, printed/digital recognition, website link, spoken-program recognition, and one priority table of eight."},
      {title:"Valet Sponsor — I Can’t Drive 55",price:7500,unit:"Per Event",category:"Pink Ball",order:4,description:"Published Pink Ball valet sponsorship. Includes valet-poster branding, logo on valet-staff T-shirts, printed/digital recognition, website link, spoken-program recognition, and one priority table of eight."},
      {title:"Silent Auction Sponsor",price:7500,unit:"Per Event",category:"Pink Ball",order:5,description:"Published Pink Ball silent-auction sponsorship. Includes auction signage, bid-sheet branding, printed/digital recognition, website link, spoken-program recognition, and one priority table of eight."},
      {title:"Table Host",price:2000,unit:"Per Event",category:"Pink Ball",order:6,description:"Published Pink Ball Table Host opportunity. Includes one table of eight and company or personal-name recognition in event materials."}
    ]
  },
  {
    program:"Fundraising & Events",
    name:"The Medallion 2026",
    location:"The Palazzo Grande · Shelby Township, MI",
    date:"2026-03-07",
    description:"Henry Ford Macomb's 2026 Medallion gala benefiting the Henry Ford Macomb Tower Campaign.",
    opportunities:[
      {title:"Presenting / Premier Sponsorship",price:50000,unit:"Per Event",category:"The Medallion",order:1,description:"Top-tier Medallion sponsorship example based on Henry Ford Health's 2026 sponsorship materials, combining premium event recognition, hospitality, and prominent sponsor visibility."},
      {title:"Program Book — Full Page Color",price:800,unit:"Per Issue",category:"Program Advertising",order:2,description:"Published Medallion program-book advertising option. Full-page color ad; Henry Ford Health specified PDF-preferred artwork and a February 13 artwork deadline."},
      {title:"Program Book — Full Page B&W",price:500,unit:"Per Issue",category:"Program Advertising",order:3,description:"Published Medallion full-page black-and-white program advertising opportunity."},
      {title:"Program Book — Half Page B&W",price:300,unit:"Per Issue",category:"Program Advertising",order:4,description:"Published Medallion half-page black-and-white program advertising opportunity."}
    ]
  },

  {
    program:"Trade Shows & Conferences",
    name:"4th Annual Obesity Symposium",
    location:"Saint John's Resort · Plymouth, MI",
    date:"2026-09-11",
    description:"Henry Ford Health's 4th Annual Obesity Symposium, publicly listed as open to exhibitors.",
    opportunities:[
      {title:"Exhibit Booth",price:2000,unit:"Starting At",category:"Exhibitor",order:1,description:"HFHS CME exhibit opportunities begin at $2,000. Exhibitors receive a display area outside the educational meeting room and an opportunity to interact with healthcare professionals."},
      {title:"Registration Sponsor",price:1000,unit:"Per Event",category:"Conference Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative Vivid inventory example for a high-traffic registration-area sponsorship. Pricing and availability would be set by Henry Ford Health."},
      {title:"Lanyard Sponsor",price:750,unit:"Per Event",category:"Conference Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative attendee-lanyard sponsorship inventory. Vivid would manage availability, creative assets, fulfillment, and measurable engagement."},
      {title:"Networking Break Sponsor",price:1000,unit:"Per Event",category:"Conference Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative sponsorship of a networking or refreshment break. Pricing and benefits would be confirmed by Henry Ford Health."}
    ]
  },
  {
    program:"Trade Shows & Conferences",
    name:"Live in the D Advanced Endoscopy Course",
    location:"Ford Hall · Henry Ford Hospital · Detroit, MI",
    date:"2026-09-18",
    description:"Henry Ford Health's Advanced Endoscopy Course, publicly listed as open to exhibitors.",
    opportunities:[
      {title:"Exhibit Booth",price:2000,unit:"Starting At",category:"Exhibitor",order:1,description:"HFHS CME exhibit opportunities begin at $2,000. Exhibitors use the dedicated exhibitor process and complete the required commercial promotion agreement."},
      {title:"Registration Sponsor",price:1000,unit:"Per Event",category:"Conference Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative Vivid registration sponsorship opportunity for this course."},
      {title:"Coffee / Break Sponsor",price:750,unit:"Per Event",category:"Conference Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative event-break sponsorship inventory with sponsor recognition and measurable engagement."},
      {title:"Educational Materials Sponsor",price:750,unit:"Per Event",category:"Conference Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative sponsor opportunity tied to attendee materials or approved event resources."}
    ]
  },
  {
    program:"Trade Shows & Conferences",
    name:"6th Annual Sinus and Nasal Symposium",
    location:"The War Memorial · Grosse Pointe, MI",
    date:"2026-10-02",
    description:"Henry Ford Health's 6th Annual Sinus and Nasal Symposium, publicly listed as open to exhibitors.",
    opportunities:[
      {title:"Exhibit Booth",price:2000,unit:"Starting At",category:"Exhibitor",order:1,description:"HFHS CME exhibit opportunities begin at $2,000, with limited exhibit space outside the educational room."},
      {title:"Lanyard Sponsor",price:750,unit:"Per Event",category:"Conference Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative lanyard inventory for attendee visibility."},
      {title:"Lunch Sponsor",price:1500,unit:"Per Event",category:"Conference Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative lunch sponsorship opportunity for the symposium."},
      {title:"Networking Break Sponsor",price:1000,unit:"Per Event",category:"Conference Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative networking-break sponsorship with fulfillment and performance reporting through Vivid."}
    ]
  },
  {
    program:"Trade Shows & Conferences",
    name:"Henry Ford + MSU Annual Cancer Research Symposium",
    location:"The Henry · Dearborn, MI",
    date:"2026-10-29",
    description:"Henry Ford + MSU Annual Cancer Research Symposium, scheduled October 29–30, 2026 and publicly listed as open to exhibitors.",
    opportunities:[
      {title:"Exhibit Booth",price:2000,unit:"Starting At",category:"Exhibitor",order:1,description:"HFHS CME exhibit opportunities begin at $2,000 and allow industry representatives to showcase products and services outside the educational meeting room."},
      {title:"Registration Sponsor",price:1000,unit:"Per Event",category:"Conference Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative high-traffic registration sponsorship."},
      {title:"Networking Reception Sponsor",price:2000,unit:"Per Event",category:"Conference Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative networking-reception sponsorship inventory."},
      {title:"Program / Digital Guide Sponsor",price:1000,unit:"Per Event",category:"Conference Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative program or digital-guide sponsorship for attendee visibility."}
    ]
  },

  {
    program:"CME & Medical Education",
    name:"Annual Breast Oncology Symposium",
    location:"Dearborn Inn · Dearborn, MI",
    date:"2026-10-09",
    description:"Henry Ford Health's Annual Breast Oncology Symposium, publicly listed as open to exhibitors.",
    opportunities:[
      {title:"CME Exhibit Booth",price:2000,unit:"Starting At",category:"CME Exhibitor",order:1,description:"HFHS CME exhibit opportunities begin at $2,000. Exhibit registration and commercial promotion requirements apply."},
      {title:"Networking Reception Sponsor",price:2000,unit:"Per Event",category:"CME Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative reception sponsorship associated with the symposium."},
      {title:"Attendee Materials Sponsor",price:750,unit:"Per Event",category:"CME Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative sponsorship for approved attendee materials or resources."},
      {title:"Coffee / Break Sponsor",price:750,unit:"Per Event",category:"CME Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative break sponsorship with sponsor recognition and Vivid fulfillment tracking."}
    ]
  },
  {
    program:"CME & Medical Education",
    name:"5th Annual Motown Women's Heart Symposium",
    location:"Westin Book Cadillac · Detroit, MI",
    date:"2026-10-16",
    description:"Henry Ford Health's 5th Annual Motown Women's Heart Symposium, publicly listed as open to exhibitors.",
    opportunities:[
      {title:"CME Exhibit Booth",price:2000,unit:"Starting At",category:"CME Exhibitor",order:1,description:"HFHS CME exhibit opportunities begin at $2,000 and provide a designated exhibit area for engagement with healthcare professionals."},
      {title:"Registration Sponsor",price:1000,unit:"Per Event",category:"CME Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative registration sponsorship."},
      {title:"Lunch Sponsor",price:1500,unit:"Per Event",category:"CME Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative lunch sponsorship inventory."},
      {title:"Networking Sponsor",price:1500,unit:"Per Event",category:"CME Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative networking sponsorship with measurable engagement."}
    ]
  },
  {
    program:"CME & Medical Education",
    name:"Annual Thoracic Cancer Symposium",
    location:"Dearborn Inn · Dearborn, MI",
    date:"2026-11-06",
    description:"Henry Ford Health's Annual Thoracic Cancer Symposium, publicly listed as open to exhibitors.",
    opportunities:[
      {title:"CME Exhibit Booth",price:2000,unit:"Starting At",category:"CME Exhibitor",order:1,description:"HFHS CME exhibit opportunities begin at $2,000."},
      {title:"Registration Sponsor",price:1000,unit:"Per Event",category:"CME Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative registration sponsorship inventory."},
      {title:"Coffee / Break Sponsor",price:750,unit:"Per Event",category:"CME Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative refreshment-break sponsorship."},
      {title:"Program Sponsor",price:1000,unit:"Per Event",category:"CME Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative event-program sponsorship."}
    ]
  },
  {
    program:"CME & Medical Education",
    name:"GU Cancer Symposium",
    location:"Ford Hall · Henry Ford Hospital · Detroit, MI",
    date:"2026-12-04",
    description:"Henry Ford Health's GU Cancer Symposium, publicly listed as open to exhibitors.",
    opportunities:[
      {title:"CME Exhibit Booth",price:2000,unit:"Starting At",category:"CME Exhibitor",order:1,description:"HFHS CME exhibit opportunities begin at $2,000."},
      {title:"Registration Sponsor",price:1000,unit:"Per Event",category:"CME Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative event-registration sponsorship."},
      {title:"Networking Break Sponsor",price:1000,unit:"Per Event",category:"CME Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative networking-break sponsorship."},
      {title:"Attendee Materials Sponsor",price:750,unit:"Per Event",category:"CME Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative attendee-materials sponsorship."}
    ]
  },

  {
    program:"Community & Health Activations",
    name:"Warren Golf Classic",
    location:"Cherry Creek Golf Course · Shelby Township, MI",
    date:"2026-09-15",
    description:"Henry Ford Health's Warren Golf Classic, benefiting enhancement of the Cardiology Department.",
    opportunities:[
      {title:"Presenting Sponsor",price:5000,unit:"Per Event",category:"Golf Sponsorship",order:1,description:"Illustrative demo price; not an approved HFHS rate. Illustrative premium tournament sponsorship. Final pricing and benefits would be configured from Henry Ford Health's approved sponsorship package."},
      {title:"Hole Sponsor",price:500,unit:"Per Event",category:"Golf Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative hole sponsorship inventory with course signage and measurable sponsor engagement."},
      {title:"Beverage Sponsor",price:1000,unit:"Per Event",category:"Golf Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative beverage or hospitality sponsorship for the golf outing."},
      {title:"Cart Sponsor",price:1500,unit:"Per Event",category:"Golf Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative golf-cart sponsorship with branded visibility throughout the event."},
      {title:"Lunch Sponsor",price:1500,unit:"Per Event",category:"Golf Sponsorship",order:5,description:"Illustrative demo price; not an approved HFHS rate. Illustrative lunch sponsorship inventory."},
      {title:"Registration Sponsor",price:1000,unit:"Per Event",category:"Golf Sponsorship",order:6,description:"Illustrative demo price; not an approved HFHS rate. Illustrative registration-area sponsorship and attendee touchpoint."}
    ]
  },
  {
    program:"Community & Health Activations",
    name:"Providence Golf",
    location:"Indianwood Golf & Country Club · Lake Orion, MI",
    date:"2026-06-01",
    description:"Henry Ford Health Providence Golf benefiting the Care of the Poor Fund and Believe in Miracles Fund.",
    opportunities:[
      {title:"Presenting Sponsor",price:5000,unit:"Per Event",category:"Golf Sponsorship",order:1,description:"Illustrative demo price; not an approved HFHS rate. Illustrative premium tournament sponsorship."},
      {title:"Hole Sponsor",price:500,unit:"Per Event",category:"Golf Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative hole sponsorship with on-course visibility."},
      {title:"Beverage Sponsor",price:1000,unit:"Per Event",category:"Golf Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative beverage sponsorship."},
      {title:"Cart Sponsor",price:1500,unit:"Per Event",category:"Golf Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative golf-cart sponsorship."},
      {title:"Lunch Sponsor",price:1500,unit:"Per Event",category:"Golf Sponsorship",order:5,description:"Illustrative demo price; not an approved HFHS rate. Illustrative meal sponsorship."}
    ]
  },
  {
    program:"Community & Health Activations",
    name:"Hit'em Fore Hospice Golf Outing",
    location:"Country Club of Jackson · Jackson, MI",
    date:"2026-09-28",
    description:"Henry Ford Health's Hit'em Fore Hospice Golf Outing benefiting Henry Ford Jackson Hospice and compassionate end-of-life care.",
    opportunities:[
      {title:"Presenting Sponsor",price:5000,unit:"Per Event",category:"Golf Sponsorship",order:1,description:"Illustrative demo price; not an approved HFHS rate. Illustrative premium outing sponsorship."},
      {title:"Hole Sponsor",price:500,unit:"Per Event",category:"Golf Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative hole sponsorship."},
      {title:"Beverage Sponsor",price:1000,unit:"Per Event",category:"Golf Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative beverage sponsorship."},
      {title:"Cocktail Reception Sponsor",price:2000,unit:"Per Event",category:"Golf Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative sponsorship of the published cocktail-reception portion of the event."},
      {title:"Dinner Sponsor",price:2500,unit:"Per Event",category:"Golf Sponsorship",order:5,description:"Illustrative demo price; not an approved HFHS rate. Illustrative sponsorship of the published dinner/program portion of the outing."}
    ]
  },
  {
    program:"Community & Health Activations",
    name:"Rochester Golf Classic",
    location:"Great Oaks Country Club · Rochester Hills, MI",
    date:"2026-07-13",
    description:"Henry Ford Health's Rochester Golf Classic, for which HFHS publicly invites community partners to sponsor the event.",
    opportunities:[
      {title:"Presenting Sponsor",price:5000,unit:"Per Event",category:"Golf Sponsorship",order:1,description:"Illustrative demo price; not an approved HFHS rate. Illustrative premium tournament sponsorship."},
      {title:"Hole Sponsor",price:500,unit:"Per Event",category:"Golf Sponsorship",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative hole sponsorship."},
      {title:"Beverage Sponsor",price:1000,unit:"Per Event",category:"Golf Sponsorship",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative beverage sponsorship."},
      {title:"Cart Sponsor",price:1500,unit:"Per Event",category:"Golf Sponsorship",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative cart sponsorship."},
      {title:"Awards / Dinner Sponsor",price:2500,unit:"Per Event",category:"Golf Sponsorship",order:5,description:"Illustrative demo price; not an approved HFHS rate. Illustrative closing-event sponsorship."}
    ]
  },

  {
    program:"Sports & Strategic Partnerships",
    name:"Destination Grand Ball 2026",
    location:"The Station at Michigan Central · Detroit, MI",
    date:"2026-10-09",
    description:"Destination Grand Ball 2026 benefiting Destination: Grand and the expansion of Henry Ford Hospital.",
    opportunities:[
      {title:"Grand Sponsor",price:5000,unit:"Per Event",category:"Destination Grand",order:1,description:"Illustrative demo price; not an approved HFHS rate. Published sponsorship category for Destination Grand Ball 2026. Pricing and detailed benefits would be loaded from the approved HFHS sponsorship package."},
      {title:"Registration Sponsor",price:1000,unit:"Per Event",category:"Destination Grand",order:2,description:"Illustrative demo price; not an approved HFHS rate. Published Destination Grand Ball sponsorship category."},
      {title:"Bar Sponsor",price:2000,unit:"Per Event",category:"Destination Grand",order:3,description:"Illustrative demo price; not an approved HFHS rate. Published Destination Grand Ball sponsorship category."},
      {title:"Reception Sponsor",price:2500,unit:"Per Event",category:"Destination Grand",order:4,description:"Illustrative demo price; not an approved HFHS rate. Published Destination Grand Ball sponsorship category."},
      {title:"Entertainment Sponsor",price:2500,unit:"Per Event",category:"Destination Grand",order:5,description:"Illustrative demo price; not an approved HFHS rate. Published Destination Grand Ball sponsorship category."},
      {title:"Red Carpet Experience Sponsor",price:1500,unit:"Per Event",category:"Destination Grand",order:6,description:"Illustrative demo price; not an approved HFHS rate. Published Destination Grand Ball sponsorship category."}
    ]
  },
  {
    program:"Sports & Strategic Partnerships",
    name:"Future of Health: Detroit",
    location:"Detroit, MI",
    date:null,
    description:"Henry Ford Health's $3 billion Future of Health: Detroit development partnership with Tom Gores and the Detroit Pistons and Henry Ford Health + Michigan State University Health Sciences.",
    opportunities:[
      {title:"Philanthropic Partnership",price:5000,unit:"Per Event",category:"Future of Health",order:1,description:"Illustrative demo price; not an approved HFHS rate. Research-based philanthropic partnership concept tied to Henry Ford Health's public statement that philanthropic partners will play an essential role in Future of Health: Detroit."},
      {title:"Community Experience Sponsor",price:1500,unit:"Per Event",category:"Future of Health",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative Vivid sponsorship inventory for approved community-facing experiences within the broader development."},
      {title:"Health Innovation Experience Sponsor",price:2500,unit:"Per Event",category:"Future of Health",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative sponsorship concept for an approved health-innovation activation."}
    ]
  },
  {
    program:"Sports & Strategic Partnerships",
    name:"Ambassador Club 2026 — Racing for the Future",
    location:"M1 Concourse · Pontiac, MI",
    date:"2026-08-20",
    description:"Henry Ford Macomb Hospital Ambassador Club's 2026 Racing for the Future event, supporting continued campus transformation.",
    opportunities:[
      {title:"Presenting Sponsor",price:5000,unit:"Per Event",category:"Ambassador Club",order:1,description:"Illustrative demo price; not an approved HFHS rate. Illustrative premium sponsorship based on HFHS's public invitation for community partners to sponsor the event."},
      {title:"Track Experience Sponsor",price:2500,unit:"Per Event",category:"Ambassador Club",order:2,description:"Illustrative demo price; not an approved HFHS rate. Illustrative M1 Concourse experience sponsorship."},
      {title:"Hospitality Sponsor",price:2000,unit:"Per Event",category:"Ambassador Club",order:3,description:"Illustrative demo price; not an approved HFHS rate. Illustrative hospitality sponsorship."},
      {title:"Registration Sponsor",price:1000,unit:"Per Event",category:"Ambassador Club",order:4,description:"Illustrative demo price; not an approved HFHS rate. Illustrative registration sponsorship."}
    ]
  }
];

function slugify(v){return String(v).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}

async function main(){
  if(!process.env.DATABASE_URL) return;
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  let client;
  try{
    client=await pool.connect();
    const orgResult=await client.query("SELECT id,customer_id FROM organizations WHERE slug=$1 LIMIT 1",[SLUG]);
    if(!orgResult.rows.length) throw new Error("HFHS demo organization not found.");
    const orgId=Number(orgResult.rows[0].id), ownerId=Number(orgResult.rows[0].customer_id);
    await client.query("BEGIN");

    const programs=await client.query("SELECT id,name FROM organization_programs WHERE organization_id=$1",[orgId]);
    const programMap=new Map(programs.rows.map(r=>[r.name,Number(r.id)]));

    // Archive the first-generation category placeholder spaces so only the event hierarchy is public.
    await client.query(
      `UPDATE spaces SET is_archived=true
        WHERE organization_id=$1
          AND name IN (
            'Fundraising & Signature Events','Trade Shows & Conferences','CME & Medical Education',
            'Community Health Activations','Sports & Strategic Partnerships'
          )`,
      [orgId]
    );

    for(const event of EVENTS){
      const programId=programMap.get(event.program);
      if(!programId) throw new Error("Missing program: "+event.program);

      let space=await client.query(
        "SELECT id FROM spaces WHERE organization_id=$1 AND LOWER(TRIM(name))=LOWER(TRIM($2)) LIMIT 1",
        [orgId,event.name]
      );
      let spaceId;
      if(space.rows.length){
        spaceId=Number(space.rows[0].id);
        await client.query(
          `UPDATE spaces SET location=$3,description=$4,is_archived=false,live_date=COALESCE($5::date,live_date)
            WHERE id=$1 AND organization_id=$2`,
          [spaceId,orgId,event.location,event.description,event.date]
        );
      }else{
        const inserted=await client.query(
          `INSERT INTO spaces(user_id,organization_id,name,location,description,live_date,is_archived,annual_impressions,placement_cost,created_at)
           VALUES($1,$2,$3,$4,$5,$6::date,false,0,0,CURRENT_TIMESTAMP) RETURNING id`,
          [ownerId,orgId,event.name,event.location,event.description,event.date]
        );
        spaceId=Number(inserted.rows[0].id);
      }

      for(const opp of event.opportunities){
        const existing=await client.query(
          `SELECT id FROM organization_opportunities
            WHERE organization_id=$1 AND space_id=$2
              AND LOWER(TRIM(title))=LOWER(TRIM($3))
            LIMIT 1`,
          [orgId,spaceId,opp.title]
        );
        if(existing.rows.length){
          await client.query(
            `UPDATE organization_opportunities
                SET program_id=$4,description=$5,category=$6,price=$7,annual_price=$7,
                    pricing_unit=$8,suggested_term_length=1,suggested_term_unit='Event',
                    status=COALESCE(status,'Available'),display_order=$9,is_active=true,updated_at=CURRENT_TIMESTAMP
              WHERE id=$1 AND organization_id=$2 AND space_id=$3`,
            [existing.rows[0].id,orgId,spaceId,programId,opp.description,opp.category,opp.price,opp.unit,opp.order]
          );
        }else{
          await client.query(
            `INSERT INTO organization_opportunities(
              organization_id,space_id,program_id,title,description,category,price,annual_price,pricing_unit,
              suggested_term_length,suggested_term_unit,status,display_order,is_active,created_at,updated_at)
             VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,1,'Event','Available',$9,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
            [orgId,spaceId,programId,opp.title,opp.description,opp.category,opp.price,opp.unit,opp.order]
          );
        }
      }
    }

    await client.query("COMMIT");
    console.log("HFHS EVENT INVENTORY HIERARCHY: loaded",EVENTS.length,"events.");
    await require("./seed-hfhs-linked-demo").main();
    await require("./restore-hfhs-demo-history").main();
    await require("./trim-hfhs-demo").main();
    await require("./sponsorship-operations").main();
  }catch(e){
    if(client){try{await client.query("ROLLBACK");}catch(_){}}
    console.error("HFHS EVENT INVENTORY HIERARCHY ERROR:",e.message);
  }finally{
    if(client)client.release();
    await pool.end();
  }
}
if(require.main===module) main();
module.exports={EVENTS};
