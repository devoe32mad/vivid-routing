"use strict";
const { Pool } = require("pg");

const SLUG = "henry-ford-health-demo";

const CARDS = [
  // Fundraising & Events
  {
    old:"Pink Ball — Event Sponsor",
    title:"Pink Ball — Event Sponsor",
    program:"Fundraising & Events",
    category:"Fundraising Event",
    price:15000, unit:"Per Event", order:1,
    description:"2026 Pink Ball at the Country Club of Jackson on April 18, 2026. Proceeds support critical upgrades and priority needs within Henry Ford Jackson Hospital’s Heart and Vascular Services. The published Event Sponsor package is $15,000 and includes exclusive event signage, recognition in event marketing and printed/digital materials, a website link on the Henry Ford Health event page, spoken-program recognition, and two VIP tables of eight. Sponsor-benefit deadline: March 27, 2026."
  },
  {
    old:"Pink Ball — Diamond Sponsor",
    title:"Pink Ball — Diamond Sponsor",
    program:"Fundraising & Events",
    category:"Fundraising Event",
    price:10000, unit:"Per Event", order:2,
    description:"2026 Pink Ball at the Country Club of Jackson on April 18, 2026, benefiting Henry Ford Jackson Hospital Heart and Vascular Services. Henry Ford Health publicly lists the Diamond Sponsor at $10,000, including event marketing recognition, exclusive event signage, printed and digital recognition, a link on the event web page, spoken-program recognition, and one table of eight with priority seating. Sponsor-benefit deadline: March 27, 2026."
  },
  {
    old:"Pink Ball — Bar Sponsor",
    title:"Pink Ball — Bar Sponsor",
    program:"Fundraising & Events",
    category:"Event Activation",
    price:7500, unit:"Per Event", order:3,
    description:"Henry Ford Health’s published 2026 Pink Ball 'Have a Drink on Me' Bar Sponsor is $7,500. Benefits include company name/logo on bar and signature-drink signage, branding on VIP drink tokens, recognition in printed and digital materials, a website link on the event page, spoken-program recognition, and one table of eight with priority seating. The event is April 18, 2026 at the Country Club of Jackson."
  },
  {
    old:"The Medallion — Program Book Advertising",
    title:"The Medallion — Program Book Advertising",
    program:"Fundraising & Events",
    category:"Fundraising Event Advertising",
    price:800, unit:"Full-page Color", order:4,
    description:"The Medallion 2026, Henry Ford Macomb’s gala benefiting the Henry Ford Macomb Tower Campaign, was held March 7, 2026 at The Palazzo Grande in Shelby Township. Published program-book advertising included a full-page color ad for $800, full-page black-and-white for $500, and half-page black-and-white for $300. Henry Ford Health specified PDF-preferred artwork, correct page size/orientation, and a February 13 artwork deadline."
  },

  // Trade Shows & Conferences
  {
    old:"Conference Exhibit Booth",
    title:"4th Annual Obesity Symposium — Exhibitor",
    program:"Trade Shows & Conferences",
    category:"Conference Exhibitor",
    price:2000, unit:"Starting At", order:1,
    description:"Henry Ford Health lists the 4th Annual Obesity Symposium for September 11, 2026 at Saint John’s Resort in Plymouth, Michigan, as open to exhibitors. HFHS CME exhibit opportunities begin at $2,000. Exhibitors receive recognition and a display area outside the educational meeting room to interact with healthcare professionals. Space is limited and offered first come, first served."
  },
  {
    old:"Conference Registration Sponsor",
    title:"Live in the D Advanced Endoscopy Course — Exhibitor",
    program:"Trade Shows & Conferences",
    category:"Conference Exhibitor",
    price:2000, unit:"Starting At", order:2,
    description:"Henry Ford Health lists the Live in the D Advanced Endoscopy Course for September 18, 2026 at Ford Hall, Henry Ford Hospital in Detroit, as open to exhibitors. HFHS CME exhibit opportunities begin at $2,000. Exhibitors must register through the exhibitor process, complete the commercial promotion agreement, and meet payment deadlines before the event."
  },
  {
    old:"Conference Lanyard Sponsor",
    title:"6th Annual Sinus and Nasal Symposium — Exhibitor",
    program:"Trade Shows & Conferences",
    category:"Conference Exhibitor",
    price:2000, unit:"Starting At", order:3,
    description:"Henry Ford Health lists the 6th Annual Henry Ford Sinus and Nasal Symposium for October 2, 2026 at The War Memorial in Grosse Pointe as open to exhibitors. HFHS CME exhibit opportunities begin at $2,000. The public exhibitor guidelines note limited space, separate exhibit areas outside educational rooms, and required registration and commercial promotion agreements."
  },
  {
    old:"Networking Break Sponsor",
    title:"Henry Ford + MSU Annual Cancer Research Symposium — Exhibitor",
    program:"Trade Shows & Conferences",
    category:"Conference Exhibitor",
    price:2000, unit:"Starting At", order:4,
    description:"Henry Ford Health lists the Henry Ford + MSU Annual Cancer Research Symposium for October 29–30, 2026 at The Henry in Dearborn as open to exhibitors. HFHS CME exhibit opportunities begin at $2,000. The exhibitor program is designed for healthcare-industry representatives to showcase products and services outside the educational meeting room while engaging attendees."
  },

  // CME & Medical Education
  {
    old:"CME Exhibitor",
    title:"Annual Breast Oncology Symposium — Exhibitor",
    program:"CME & Medical Education",
    category:"CME Exhibitor",
    price:2000, unit:"Starting At", order:1,
    description:"Henry Ford Health lists the Annual Breast Oncology Symposium for October 9, 2026 at the Dearborn Inn in Dearborn, Michigan, as open to exhibitors. CME exhibit opportunities begin at $2,000. Formal invitations are typically sent 9–10 weeks before the symposium; exhibit registration is due 10 days before the event, and the commercial promotion agreement is due one week before."
  },
  {
    old:"Clinical Symposium Session Sponsor",
    title:"5th Annual Motown Women’s Heart Symposium — Exhibitor",
    program:"CME & Medical Education",
    category:"CME Exhibitor",
    price:2000, unit:"Starting At", order:2,
    description:"Henry Ford Health lists the 5th Annual Motown Women’s Heart Symposium for October 16, 2026 at the Westin Book Cadillac in Detroit as open to exhibitors. HFHS CME exhibit opportunities begin at $2,000. Exhibitors can host a display for the duration of the event in the designated exhibit area and interact with healthcare professionals."
  },
  {
    old:"Networking Reception Sponsor",
    title:"Annual Thoracic Cancer Symposium — Exhibitor",
    program:"CME & Medical Education",
    category:"CME Exhibitor",
    price:2000, unit:"Starting At", order:3,
    description:"Henry Ford Health lists the Annual Thoracic Cancer Symposium for November 6, 2026 at the Dearborn Inn in Dearborn as open to exhibitors. HFHS CME exhibit opportunities begin at $2,000. Exhibitors must use the dedicated exhibitor registration process and comply with Henry Ford Health and ACCME privacy and promotional requirements."
  },
  {
    old:"Breast Oncology Symposium — Exhibitor",
    title:"GU Cancer Symposium — Exhibitor",
    program:"CME & Medical Education",
    category:"CME Exhibitor",
    price:2000, unit:"Starting At", order:4,
    description:"Henry Ford Health lists the GU Cancer Symposium for December 4, 2026 at Ford Hall, Henry Ford Hospital in Detroit, as open to exhibitors. HFHS CME exhibit opportunities begin at $2,000. The public guidelines state that only representatives from exhibit-sponsoring companies may attend the listed CME sessions."
  },

  // Community & Health Activations
  {
    old:"Community Health Screening Activation",
    title:"Warren Golf Classic — Sponsorship",
    program:"Community & Health Activations",
    category:"Community Fundraising",
    price:0, unit:"Custom", order:1,
    description:"Henry Ford Health’s Warren Golf Classic is scheduled for September 15, 2026 at Cherry Creek Golf Course in Shelby Township. The beneficiary is enhancement of the Cardiology Department. Henry Ford Health publicly invites community partners to sponsor the event and directs prospective sponsors to its sponsorship-level details and event contact."
  },
  {
    old:"Community Wellness Partner",
    title:"Providence Golf — Sponsorship",
    program:"Community & Health Activations",
    category:"Community Fundraising",
    price:0, unit:"Custom", order:2,
    description:"Henry Ford Health’s Providence Golf event was held June 1, 2026 at Indianwood Golf & Country Club in Lake Orion. Beneficiaries are the Care of the Poor Fund and Believe in Miracles Fund at Henry Ford Providence Novi and Southfield Hospitals, supporting patients facing emergency financial needs and oncology-related financial hardship. HFHS publicly invites community partners to sponsor the event."
  },
  {
    old:"Mobile Health Event Sponsor",
    title:"Hit’em Fore Hospice Golf Outing — Sponsorship",
    program:"Community & Health Activations",
    category:"Community Fundraising",
    price:0, unit:"Custom", order:3,
    description:"Henry Ford Health’s Hit’em Fore Hospice Golf Outing is scheduled for September 28, 2026 at the Country Club of Jackson. Proceeds benefit Henry Ford Jackson Hospice and compassionate end-of-life care. The event includes registration/lunch, shotgun start, cocktail reception, dinner, program and awards, and HFHS publicly directs supporters to review available sponsorship levels and benefits."
  },
  {
    old:"Family Health Fair Sponsor",
    title:"Rochester Golf Classic — Sponsorship",
    program:"Community & Health Activations",
    category:"Community Fundraising",
    price:0, unit:"Custom", order:4,
    description:"Henry Ford Health’s Rochester Golf Classic was held July 13, 2026 at Great Oaks Country Club in Rochester Hills. HFHS publicly invites community partners to sponsor the event in support of its mission-driven approach to care and links directly to sponsorship levels and details."
  },

  // Sports & Strategic Partnerships
  {
    old:"Arena Health Activation",
    title:"Destination Grand Ball — Registration Sponsor",
    program:"Sports & Strategic Partnerships",
    category:"Strategic Fundraising",
    price:0, unit:"Custom", order:1,
    description:"Destination Grand Ball 2026 is scheduled for October 9, 2026 at The Station at Michigan Central in Detroit. Proceeds benefit Destination: Grand, Henry Ford Hospital’s expansion. Henry Ford Health publicly lists Registration Sponsor among the event’s sponsorship categories, alongside Grand, Event, Diamond, Entertainment, Reception, Bar, Red Carpet Experience and VIP Registration sponsors."
  },
  {
    old:"Youth Health Program Sponsor",
    title:"Destination Grand Ball — Bar Sponsor",
    program:"Sports & Strategic Partnerships",
    category:"Strategic Fundraising",
    price:0, unit:"Custom", order:2,
    description:"Destination Grand Ball 2026 supports Destination: Grand and the expansion of Henry Ford Hospital in Detroit. Henry Ford Health publicly lists Bar Sponsor as one of the event’s sponsorship categories. The event is October 9, 2026 at The Station at Michigan Central, with cocktail reception, dinner, program and afterglow."
  },
  {
    old:"Destination: Grand Experience Sponsor",
    title:"Future of Health: Detroit — Philanthropic Partnership",
    program:"Sports & Strategic Partnerships",
    category:"Future of Health",
    price:0, unit:"Custom", order:3,
    description:"Future of Health: Detroit is Henry Ford Health’s $3 billion community development partnership with Tom Gores and the Detroit Pistons and Henry Ford Health + Michigan State University Health Sciences. The vision includes a new academic hospital, medical research center, mixed-income housing, retail, green space and recreation. Henry Ford Health publicly states that philanthropic partners will play an essential role and directs interested partners to the Development Office."
  },
  {
    old:"Pistons Fit — Community Activation",
    title:"Ambassador Club 2026 — Sponsorship",
    program:"Sports & Strategic Partnerships",
    category:"Strategic Fundraising",
    price:0, unit:"Custom", order:4,
    description:"The Henry Ford Macomb Hospital Ambassador Club’s 2026 'Racing for the Future' event was scheduled for August 20, 2026 at M1 Concourse in Pontiac. Proceeds support the continued campus transformation of Macomb County’s first all-private-room hospital. Henry Ford Health publicly invites community partners to become sponsors and provides sponsorship-level details through its event page."
  }
];

async function main(){
  if(!process.env.DATABASE_URL) return;
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
  let client;
  try{
    client=await pool.connect();
    const org=await client.query("SELECT id FROM organizations WHERE slug=$1 LIMIT 1",[SLUG]);
    if(!org.rows.length) throw new Error("HFHS demo organization not found");
    const orgId=Number(org.rows[0].id);
    await client.query("BEGIN");
    for(const c of CARDS){
      const program=await client.query("SELECT id FROM organization_programs WHERE organization_id=$1 AND name=$2 LIMIT 1",[orgId,c.program]);
      if(!program.rows.length) throw new Error("Program not found: "+c.program);
      const r=await client.query(
        `UPDATE organization_opportunities
            SET title=$4,description=$5,category=$6,price=$7,annual_price=$7,
                pricing_unit=$8,display_order=$9,updated_at=CURRENT_TIMESTAMP
          WHERE organization_id=$1 AND program_id=$2
            AND (title=$3 OR title=$4)
            AND status='Available'
          RETURNING id`,
        [orgId,program.rows[0].id,c.old,c.title,c.description,c.category,c.price,c.unit,c.order]
      );
      if(r.rows.length!==1) throw new Error("Expected one card for "+c.old+" / "+c.title+", got "+r.rows.length);
    }
    await client.query("COMMIT");
    console.log("HFHS PUBLIC CONTEXT: updated",CARDS.length,"cards.");
  }catch(e){
    if(client){try{await client.query("ROLLBACK");}catch(_){}}
    console.error("HFHS PUBLIC CONTEXT ERROR:",e.message);
  }finally{
    if(client)client.release();
    await pool.end();
  }
}
if(require.main===module) main();
module.exports={CARDS};
