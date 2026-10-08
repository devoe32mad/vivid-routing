"use strict";
const { Pool } = require("pg");

const KEY = "hfhs-enterprise-demo-2026-10-v1";
const SLUG = "henry-ford-health-demo";

const SECTION_COPY = {
  "Fundraising & Events": "Support signature fundraising experiences through polished sponsorship opportunities that make it easy for sponsors to understand benefits, submit a request, provide assets, track fulfillment, and receive measurable post-event reporting.",
  "Trade Shows & Conferences": "Turn conference and trade show inventory into a modern sponsorship experience. Sponsors can explore booths and high-traffic event assets, complete onboarding, and see measurable engagement after the event.",
  "CME & Medical Education": "Give exhibitors and sponsors a clearer way to participate in medical education programming while creating a structured path from opportunity selection through fulfillment and performance reporting.",
  "Community & Health Activations": "Package community-facing health and wellness opportunities in one place, with measurable engagement tied to screenings, registrations, content interactions, and other approved outcomes.",
  "Sports & Strategic Partnerships": "Demonstrate how larger partnerships and premium activations can be organized, fulfilled, and measured across individual assets while rolling results up to one enterprise partnership view."
};

const COPY = {
  "Pink Ball — Event Sponsor": {
    desc: "A premier sponsorship opportunity for a signature Henry Ford Health fundraising experience. Sponsors receive meaningful event visibility and recognition while Vivid streamlines the request, onboarding, creative collection, fulfillment, and post-event reporting process.",
    category: "Fundraising & Events",
    unit: "Per Event"
  },
  "Pink Ball — Diamond Sponsor": {
    desc: "A high-visibility sponsorship tier for organizations seeking a strong presence at the Pink Ball. Vivid gives sponsors a clear view of included benefits, simplifies onboarding and asset submission, and creates a measurable record of sponsorship performance.",
    category: "Fundraising & Events",
    unit: "Per Event"
  },
  "Pink Ball — Bar Sponsor": {
    desc: "A high-traffic event activation centered on the guest bar experience. This example shows how a specific physical sponsorship asset can be sold online, fulfilled with sponsor creative, measured through engagement, and reported back to the sponsor after the event.",
    category: "Event Activation",
    unit: "Per Event"
  },
  "Conference Exhibit Booth": {
    desc: "A professional exhibit booth opportunity for organizations that want direct attendee engagement in a conference setting. Vivid can manage booth selection, sponsor onboarding, creative assets, fulfillment requirements, QR-based engagement, follow-up actions, and post-event reporting.",
    category: "Trade Show Booth",
    unit: "Custom"
  },
  "Conference Registration Sponsor": {
    desc: "A premium sponsorship at one of the highest-traffic touchpoints of a conference. Registration-area branding can be paired with measurable calls to action so the sponsor sees more than exposure — they can see engagement and downstream response.",
    category: "Conference Sponsorship",
    unit: "Custom"
  },
  "Conference Lanyard Sponsor": {
    desc: "An always-visible attendee branding opportunity that travels throughout the event. Vivid can connect the sponsorship to trackable activations, sponsor fulfillment, attendee engagement, and a concise post-event performance summary.",
    category: "Conference Sponsorship",
    unit: "Custom"
  },
  "CME Exhibitor": {
    desc: "A structured exhibitor opportunity within a professional medical education environment. Vivid helps manage sponsor onboarding and creates a measurable connection between exhibit participation, content engagement, information requests, and approved follow-up actions.",
    category: "CME & Medical Education",
    unit: "Starting At"
  },
  "Clinical Symposium Session Sponsor": {
    desc: "A sponsorship concept aligned with a focused clinical education session. The experience can combine sponsor recognition, session-related content, attendee engagement, and measurable follow-up in one Vivid record.",
    category: "CME & Medical Education",
    unit: "Custom"
  },
  "Networking Reception Sponsor": {
    desc: "A premium networking activation for sponsors that want visibility in a relationship-driven setting. Vivid can manage sponsor assets and fulfillment while measuring engagement tied to the reception and related follow-up.",
    category: "CME & Medical Education",
    unit: "Custom"
  },
  "Community Health Screening Activation": {
    desc: "A community-facing health activation designed to connect real-world participation with measurable digital engagement. Vivid can track interactions from signage and QR scans through screening registration, educational content, or other approved downstream actions.",
    category: "Community Health",
    unit: "Custom"
  },
  "Community Wellness Partner": {
    desc: "A sponsorship concept supporting community wellness programming with clear sponsor visibility and measurable participation. Vivid provides one place to manage the opportunity, sponsor assets, fulfillment, engagement, and results.",
    category: "Community Health",
    unit: "Custom"
  },
  "Mobile Health Event Sponsor": {
    desc: "A flexible sponsorship opportunity built around a mobile or community health event. Vivid can connect event signage, sponsor messaging, attendee engagement, and approved follow-up actions into one performance record.",
    category: "Community Health",
    unit: "Custom"
  },
  "Arena Health Activation": {
    desc: "A major-partnership activation concept for a sports or arena environment. Vivid can measure individual physical touchpoints, digital calls to action, and downstream engagement while rolling the results into a single partnership performance view.",
    category: "Sports & Strategic Partnerships",
    unit: "Custom"
  },
  "Youth Health Program Sponsor": {
    desc: "A strategic sponsorship concept supporting youth health, sports, or community programming. Vivid helps organize sponsorship benefits, activations, engagement, and measurable outcomes so the partnership is easier to evaluate and renew.",
    category: "Sports & Strategic Partnerships",
    unit: "Custom"
  },
  "Destination: Grand Experience Sponsor": {
    desc: "A flagship enterprise sponsorship concept illustrating how a premium Destination: Grand or Future of Health experience could be packaged, onboarded, fulfilled, and measured through Vivid. Individual assets can be tracked separately and rolled into one executive partnership view.",
    category: "Future of Health",
    unit: "Custom"
  }
};

const EXTRA_CARDS = [
  {
    programName:"Fundraising & Events",
    title:"The Medallion — Program Book Advertising",
    description:"A real Henry Ford Health advertising opportunity drawn from the 2026 Medallion sponsorship materials. This example shows how program-book inventory can move from emailed artwork and manual coordination into a Vivid card with specifications, deadline tracking, creative upload, fulfillment status, and post-event sponsor reporting.",
    category:"Fundraising Event Advertising",
    price:800,
    annualPrice:800,
    pricingUnit:"Full-page Color",
    termLength:1,
    termUnit:"Issue",
    displayOrder:4
  },
  {
    programName:"Trade Shows & Conferences",
    title:"Networking Break Sponsor",
    description:"An illustrative conference sponsorship for a high-traffic networking break. Vivid can present the opportunity, collect sponsor assets, manage fulfillment, connect signage or QR engagement to follow-up actions, and provide a post-event performance summary.",
    category:"Conference Sponsorship",
    price:0,
    annualPrice:0,
    pricingUnit:"Custom",
    termLength:1,
    termUnit:"Event",
    displayOrder:4
  },
  {
    programName:"CME & Medical Education",
    title:"Breast Oncology Symposium — Exhibitor",
    description:"A research-based example using Henry Ford Health's current 2026 CME calendar. The Annual Henry Ford Health Breast Oncology Symposium is open to exhibitors; Vivid could turn that participation into a clear marketplace card with exhibitor onboarding, creative and compliance requirements, fulfillment tracking, and measurable engagement.",
    category:"CME Exhibitor",
    price:2000,
    annualPrice:2000,
    pricingUnit:"Starting At",
    termLength:1,
    termUnit:"Event",
    displayOrder:4
  },
  {
    programName:"Community & Health Activations",
    title:"Family Health Fair Sponsor",
    description:"An illustrative community-facing sponsorship designed for family wellness, education, screenings, and outreach. Vivid can connect the physical activation to measurable registration, content engagement, and other approved follow-up actions while keeping sponsor fulfillment in one place.",
    category:"Community Health",
    price:0,
    annualPrice:0,
    pricingUnit:"Custom",
    termLength:1,
    termUnit:"Event",
    displayOrder:4
  },
  {
    programName:"Sports & Strategic Partnerships",
    title:"Pistons Fit — Community Activation",
    description:"An illustrative strategic-partnership card based on Henry Ford Health's public-facing sports and community health relationships. Vivid can show how an individual activation is packaged and measured while rolling performance into the broader partnership portfolio.",
    category:"Sports & Strategic Partnerships",
    price:0,
    annualPrice:0,
    pricingUnit:"Custom",
    termLength:1,
    termUnit:"Activation",
    displayOrder:4
  }
];

async function polish(client) {
  const fixture = await client.query(
    "SELECT organization_id, manifest FROM vivid_evaluation_fixtures WHERE fixture_key=$1 LIMIT 1",
    [KEY]
  );
  if (!fixture.rows.length) {
    console.log("HFHS POLISH: fixture not loaded; skipped.");
    return;
  }

  const orgId = Number(fixture.rows[0].organization_id);
  const org = await client.query(
    "SELECT id, slug FROM organizations WHERE id=$1 AND slug=$2 LIMIT 1",
    [orgId, SLUG]
  );
  if (!org.rows.length) throw new Error("HFHS POLISH: organization identity mismatch.");

  await client.query("BEGIN");
  try {
    await client.query(
      `UPDATE organizations
          SET public_heading=$2,
              public_description=$3,
              notes=$4
        WHERE id=$1`,
      [
        orgId,
        "Henry Ford Health Sponsorship Marketplace — Vivid Demonstration",
        "Explore sponsorship and activation opportunities across fundraising events, conferences, medical education, community health, and strategic partnerships. Select an opportunity to see how Vivid can streamline sponsor discovery, requests, onboarding, fulfillment, performance reporting, and renewal.\n\nPRIVATE DEMONSTRATION ONLY — illustrative marketplace and performance data prepared for discussion; not an official Henry Ford Health offer or endorsement.",
        "PRIVATE VIVID DEMONSTRATION — research-driven sponsorship marketplace concept prepared for discussion with Henry Ford Health."
      ]
    );

    for (const [name, description] of Object.entries(SECTION_COPY)) {
      await client.query(
        `UPDATE organization_programs
            SET description=$3, updated_at=CURRENT_TIMESTAMP
          WHERE organization_id=$1 AND name=$2`,
        [orgId, name, description]
      );
    }

    for (const [title, data] of Object.entries(COPY)) {
      const result = await client.query(
        `UPDATE organization_opportunities
            SET description=$3,
                category=$4,
                pricing_unit=$5,
                updated_at=CURRENT_TIMESTAMP
          WHERE organization_id=$1
            AND title=$2
            AND status='Available'
          RETURNING id`,
        [orgId, title, data.desc, data.category, data.unit]
      );
      if (result.rows.length !== 1) {
        throw new Error(`HFHS POLISH: expected one available opportunity for "${title}", found ${result.rows.length}.`);
      }
    }


    // HFHS POLISH EXTRA CARDS
    for (const card of EXTRA_CARDS) {
      const programResult = await client.query(
        `SELECT id FROM organization_programs
          WHERE organization_id=$1 AND name=$2
          LIMIT 1`,
        [orgId, card.programName]
      );
      if (!programResult.rows.length) {
        throw new Error(`HFHS POLISH: program not found for "${card.title}".`);
      }
      const programId = Number(programResult.rows[0].id);

      const spaceResult = await client.query(
        `SELECT id FROM spaces
          WHERE organization_id=$1
          ORDER BY CASE
            WHEN LOWER(name) LIKE '%' || LOWER($2) || '%' THEN 0
            ELSE 1
          END, id
          LIMIT 1`,
        [orgId, card.programName.replace(" & "," ")]
      );
      if (!spaceResult.rows.length) {
        throw new Error(`HFHS POLISH: location not found for "${card.title}".`);
      }
      const spaceId = Number(spaceResult.rows[0].id);

      await client.query(
        `INSERT INTO organization_opportunities(
           organization_id,space_id,program_id,title,description,category,
           price,annual_price,pricing_unit,suggested_term_length,suggested_term_unit,
           status,display_order,is_active,created_at,updated_at
         )
         SELECT
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
           'Available',$12,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
         WHERE NOT EXISTS(
           SELECT 1 FROM organization_opportunities
           WHERE organization_id=$1
             AND LOWER(TRIM(title))=LOWER(TRIM($4))
         )`,
        [
          orgId,spaceId,programId,card.title,card.description,card.category,
          card.price,card.annualPrice,card.pricingUnit,card.termLength,card.termUnit,
          card.displayOrder
        ]
      );
    }

    await client.query("COMMIT");
    console.log("HFHS POLISH: all 15 marketplace opportunities updated.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("HFHS POLISH: DATABASE_URL not set; skipped.");
    return;
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  let client;
  try {
    client = await pool.connect();
    await polish(client);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    // Presentation polish must never block the production application.
    console.error("HFHS POLISH ERROR:", error.message);
  });
}

module.exports = { polish, COPY, SECTION_COPY };
