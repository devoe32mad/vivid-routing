const { Pool } = require("pg");

const ORG_ID = 13;

const schools = [
  {
    key: "barron",
    name: "Barron Collier High School",
    address: "5600 Cougar Drive, Naples, FL 34109",
    aliases: ["barron collier high school", "barron collier hs", "barron collier"],
    opportunities: [
      {
        title: "All-Sports Cougar Sponsorship",
        description: "Barron Collier all-sports Cougar sponsorship package with prominent athletic signage and sponsor recognition. Published package price is $10,000 per year. The sponsorship packet linked from the current BCH website is labeled 2024-25, so current pricing and availability should be confirmed with the school.",
        category: "Athletics Sponsorship",
        price: 10000,
        annual: 10000,
        unit: "year",
        order: 1
      },
      {
        title: "All-Sports Blue Sponsorship",
        description: "Barron Collier all-sports Blue sponsorship package with athletic signage and sponsor recognition. Published package price is $7,500 per year. The sponsorship packet linked from the current BCH website is labeled 2024-25, so current pricing and availability should be confirmed with the school.",
        category: "Athletics Sponsorship",
        price: 7500,
        annual: 7500,
        unit: "year",
        order: 2
      },
      {
        title: "All-Sports Gray Sponsorship",
        description: "Barron Collier all-sports Gray sponsorship package with fence or gym visibility and sponsor recognition. Published package price is $2,500 per year. The sponsorship packet linked from the current BCH website is labeled 2024-25, so current pricing and availability should be confirmed with the school.",
        category: "Athletics Sponsorship",
        price: 2500,
        annual: 2500,
        unit: "year",
        order: 3
      },
      {
        title: "Stadium Fence Banner",
        description: "One-year Barron Collier banner sponsorship for a 3 ft x 5 ft banner on the stadium fence. Published price is $500. The banner agreement linked from the current BCH website references the 2024-25 school year, so current pricing and availability should be confirmed with the school.",
        category: "Athletics Sponsorship",
        price: 500,
        annual: 500,
        unit: "year",
        order: 4
      },
      {
        title: "Gym Banner",
        description: "One-year Barron Collier banner sponsorship for a 3 ft x 5 ft banner in the gym. Published price is $500. The banner agreement linked from the current BCH website references the 2024-25 school year, so current pricing and availability should be confirmed with the school.",
        category: "Athletics Sponsorship",
        price: 500,
        annual: 500,
        unit: "year",
        order: 5
      }
    ]
  },
  {
    key: "gulf",
    name: "Gulf Coast High School",
    address: "7878 Shark Way, Naples, FL 34119",
    aliases: ["gulf coast high school", "gulf coast hs", "gulf coast"],
    opportunities: [
      {
        title: "Gymnasium Scoreboard Advertisement",
        description: "Company logo and advertisement displayed on the Gulf Coast High School home gymnasium scoreboards. The school advertises exposure across 125+ home events, performing arts activity, and additional leased events. Published sponsorship cost: $7,500.",
        category: "Athletics Sponsorship",
        price: 7500,
        annual: 7500,
        unit: "sponsorship",
        order: 1
      },
      {
        title: "Ticket Sponsor",
        description: "Company logo and advertisement displayed on event tickets at Gulf Coast High School. The school advertises exposure across 125+ home events, performing arts activity, and additional leased events. Published sponsorship cost: $7,500.",
        category: "Athletics Sponsorship",
        price: 7500,
        annual: 7500,
        unit: "sponsorship",
        order: 2
      },
      {
        title: "Outdoor Banner",
        description: "4 ft x 6 ft Gulf Coast High School banner sponsorship with exposure connected to soccer, lacrosse, football, band activity, and other school events. Published sponsorship cost: $750.",
        category: "Athletics Sponsorship",
        price: 750,
        annual: 750,
        unit: "sponsorship",
        order: 3
      },
      {
        title: "Gym LED Commercial",
        description: "20-second commercial displayed on the Gulf Coast High School gymnasium LED video board, including volleyball and basketball events and other school activity. Published sponsorship cost: $2,500.",
        category: "Athletics Sponsorship",
        price: 2500,
        annual: 2500,
        unit: "sponsorship",
        order: 4
      }
    ]
  }
];

async function run() {
  if (!process.env.DATABASE_URL) return;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orgResult = await client.query(
      "SELECT id, name FROM organizations WHERE id = $1 LIMIT 1",
      [ORG_ID]
    );

    if (!orgResult.rows.length) {
      throw new Error("CCPS installer stopped: organization 13 does not exist.");
    }

    const orgName = String(orgResult.rows[0].name || "").trim().toLowerCase();
    const isCcps =
      orgName === "ccps" ||
      (orgName.includes("collier") && (orgName.includes("school") || orgName.includes("public")));
    if (!isCcps) {
      throw new Error(
        `CCPS installer stopped: organization 13 is "${orgResult.rows[0].name}", not a recognized CCPS organization.`
      );
    }

    let programResult = await client.query(
      `SELECT id, name
         FROM organization_programs
        WHERE organization_id = $1
          AND (
            LOWER(name) LIKE '%athletic%'
            OR LOWER(name) LIKE '%sponsor%'
          )
        ORDER BY CASE WHEN LOWER(name) LIKE '%athletic%' THEN 0 ELSE 1 END, id
        LIMIT 1`,
      [ORG_ID]
    );

    let programId;
    if (programResult.rows.length) {
      programId = programResult.rows[0].id;
    } else {
      const insertedProgram = await client.query(
        `INSERT INTO organization_programs (
           organization_id, name, description, program_type, audience_scope,
           display_order, is_active, created_at, updated_at
         )
         VALUES (
           $1, 'Athletics Sponsorship',
           'School athletics sponsorship and advertising opportunities.',
           'sponsorship', 'location', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         )
         RETURNING id`,
        [ORG_ID]
      );
      programId = insertedProgram.rows[0].id;
    }

    const created = [];
    const skipped = [];

    for (const school of schools) {
      const spaceResult = await client.query(
        `SELECT id, name
           FROM spaces
          WHERE organization_id = $1
            AND LOWER(TRIM(name)) = ANY($2::text[])
          ORDER BY id
          LIMIT 1`,
        [ORG_ID, school.aliases]
      );

      let spaceId;
      if (spaceResult.rows.length) {
        spaceId = spaceResult.rows[0].id;
      } else {
        const insertedSpace = await client.query(
          `INSERT INTO spaces (
             organization_id, name, location, annual_impressions,
             placement_cost, is_archived, created_at
           )
           VALUES ($1, $2, $3, 0, 0, false, CURRENT_TIMESTAMP)
           RETURNING id`,
          [ORG_ID, school.name, school.address]
        );
        spaceId = insertedSpace.rows[0].id;
      }

      for (const opp of school.opportunities) {
        const exists = await client.query(
          `SELECT id
             FROM organization_opportunities
            WHERE organization_id = $1
              AND space_id = $2
              AND LOWER(TRIM(title)) = LOWER(TRIM($3))
            LIMIT 1`,
          [ORG_ID, spaceId, opp.title]
        );

        if (exists.rows.length) {
          skipped.push({ id: exists.rows[0].id, school: school.name, title: opp.title });
          continue;
        }

        const inserted = await client.query(
          `INSERT INTO organization_opportunities (
             organization_id, space_id, program_id, title, description,
             category, annual_price, price, pricing_unit,
             suggested_term_length, suggested_term_unit,
             status, display_order, is_active, created_at, updated_at
           )
           VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             1, $10,
             'Available', $11, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
           )
           RETURNING id`,
          [
            ORG_ID, spaceId, programId, opp.title, opp.description,
            opp.category, opp.annual, opp.price, opp.unit,
            opp.unit === "year" ? "Year" : "Sponsorship",
            opp.order
          ]
        );

        created.push({
          id: inserted.rows[0].id,
          school: school.name,
          title: opp.title,
          price: opp.price
        });
      }
    }

    await client.query("COMMIT");
    console.log("CCPS MARKETPLACE OPPORTUNITIES:", JSON.stringify({ created, skipped }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(error => {
  console.error("CCPS MARKETPLACE OPPORTUNITIES ERROR:", error);
  process.exitCode = 1;
});
