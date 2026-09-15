const { Pool } = require("pg");
const express = require("express");

const MCA_SLUG = "mason-classical-academy-concept";
const MCA_PATH = `/advertise/${MCA_SLUG}`;

async function seedMasonConcept() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pool.query(`
      ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS slug TEXT;

      ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS public_heading TEXT;

      ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS public_description TEXT;

      ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS public_logo_url TEXT;
    `);

    await pool.query(`
      INSERT INTO organizations (
        name,
        organization_type,
        contact_name,
        contact_email,
        website,
        notes,
        slug,
        public_heading,
        public_description,
        is_active,
        created_at,
        updated_at
      )
      SELECT
        'Mason Classical Academy',
        'Public Charter School',
        'Vivid Concept Marketplace',
        'mike@vividspots.com',
        'https://masonacademy.com/',
        'PRIVATE VIVID CONCEPT — NOT APPROVED BY MASON CLASSICAL ACADEMY',
        $1,
        'Explore Mason Classical Academy Partnership Opportunities',
        'See how campus, athletics, events, and community sponsorship opportunities could be organized, requested, and measured in one marketplace.',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1
        FROM organizations
        WHERE LOWER(TRIM(slug)) = $1
      )
    `, [MCA_SLUG]);

    await pool.query(`
      UPDATE organizations
      SET
        contact_email = 'mike@vividspots.com',
        website = 'https://masonacademy.com/',
        notes = 'PRIVATE VIVID CONCEPT — NOT APPROVED BY MASON CLASSICAL ACADEMY',
        public_heading = 'Explore Mason Classical Academy Partnership Opportunities',
        public_description = 'See how campus, athletics, events, and community sponsorship opportunities could be organized, requested, and measured in one marketplace.',
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(TRIM(slug)) = $1
    `, [MCA_SLUG]);

    await pool.query(`
      WITH mason AS (
        SELECT id
        FROM organizations
        WHERE LOWER(TRIM(slug)) = $1
        LIMIT 1
      ),
      inventory (name, location) AS (
        VALUES
          (
            'Vanderbilt Campus',
            '7170 Vanderbilt Beach Road, Naples, FL 34119'
          ),
          (
            'Northbrooke Campus',
            '2647 Professional Circle, Naples, FL 34119'
          )
      )
      INSERT INTO spaces (
        organization_id,
        name,
        location,
        annual_impressions,
        placement_cost,
        is_archived,
        created_at
      )
      SELECT
        mason.id,
        inventory.name,
        inventory.location,
        0,
        0,
        false,
        CURRENT_TIMESTAMP
      FROM mason
      CROSS JOIN inventory
      WHERE NOT EXISTS (
        SELECT 1
        FROM spaces existing
        WHERE existing.organization_id = mason.id
          AND LOWER(TRIM(existing.name)) =
              LOWER(TRIM(inventory.name))
      )
    `, [MCA_SLUG]);

    await pool.query(`
      WITH mason AS (
        SELECT id
        FROM organizations
        WHERE LOWER(TRIM(slug)) = $1
        LIMIT 1
      ),
      programs (
        name,
        description,
        program_type,
        audience_scope,
        display_order
      ) AS (
        VALUES
          (
            'Campus',
            'Reach families and the school community through visible campus and car-line placements.',
            'advertising',
            'location',
            1
          ),
          (
            'Athletics',
            'Support Gryphon athletics through gym, team, and event sponsorship opportunities.',
            'sponsorship',
            'location',
            2
          ),
          (
            'Events & Community',
            'Connect with the MCA community through signature events and special programs.',
            'general',
            'location',
            3
          )
      )
      INSERT INTO organization_programs (
        organization_id,
        name,
        description,
        program_type,
        audience_scope,
        display_order,
        is_active,
        created_at,
        updated_at
      )
      SELECT
        mason.id,
        programs.name,
        programs.description,
        programs.program_type,
        programs.audience_scope,
        programs.display_order,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM mason
      CROSS JOIN programs
      ON CONFLICT (organization_id, name)
      DO UPDATE SET
        description = EXCLUDED.description,
        program_type = EXCLUDED.program_type,
        audience_scope = EXCLUDED.audience_scope,
        display_order = EXCLUDED.display_order,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
    `, [MCA_SLUG]);

    await pool.query(`
      WITH mason AS (
        SELECT id
        FROM organizations
        WHERE LOWER(TRIM(slug)) = $1
        LIMIT 1
      ),
      inventory (
        location_name,
        program_name,
        title,
        description,
        category,
        display_order
      ) AS (
        VALUES
          (
            'Vanderbilt Campus',
            'Campus',
            'Morning and Afternoon Car-Line Visibility',
            'A visible placement concept designed to reach MCA families during daily arrival and dismissal traffic.',
            'Car Line',
            1
          ),
          (
            'Vanderbilt Campus',
            'Campus',
            'Campus Entrance Partnership',
            'A prominent welcome-area concept for an approved community partner near the primary campus entrance.',
            'Campus Signage',
            2
          ),
          (
            'Vanderbilt Campus',
            'Events & Community',
            'Family Event Partnership',
            'Support an approved MCA family or student event with coordinated physical and digital visibility.',
            'Community Event',
            1
          ),
          (
            'Northbrooke Campus',
            'Athletics',
            'Gymnasium Partnership',
            'A concept sponsorship for the new gym, connecting an approved business with MCA athletic events and families.',
            'Gymnasium',
            1
          ),
          (
            'Northbrooke Campus',
            'Athletics',
            'Athletic Program Sponsorship',
            'Support an approved MCA athletic program with measurable season-long physical and digital engagement.',
            'Athletics',
            2
          ),
          (
            'Northbrooke Campus',
            'Campus',
            'Secondary Campus Visibility',
            'An approved placement concept reaching MCA students, families, faculty, and visitors at the secondary campus.',
            'Campus Signage',
            1
          ),
          (
            'Northbrooke Campus',
            'Events & Community',
            'MCA Angler Tournament Sponsorship',
            'A consolidated marketplace concept for tournament sponsorship or underwriting opportunities.',
            'Signature Event',
            1
          ),
          (
            'Northbrooke Campus',
            'Events & Community',
            'School Supply Program Partnership',
            'Support MCA school supplies through an approved community partnership with trackable engagement.',
            'Community Support',
            2
          )
      )
      INSERT INTO organization_opportunities (
        organization_id,
        space_id,
        program_id,
        title,
        description,
        category,
        annual_price,
        price,
        pricing_unit,
        suggested_term_length,
        suggested_term_unit,
        status,
        display_order,
        is_active,
        created_at,
        updated_at
      )
      SELECT
        mason.id,
        location.id,
        program.id,
        inventory.title,
        inventory.description,
        inventory.category,
        0,
        NULL,
        NULL,
        1,
        'Custom',
        'Available',
        inventory.display_order,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM mason
      JOIN spaces location
        ON location.organization_id = mason.id
      JOIN inventory
        ON LOWER(TRIM(inventory.location_name)) =
           LOWER(TRIM(location.name))
      JOIN organization_programs program
        ON program.organization_id = mason.id
       AND LOWER(TRIM(program.name)) =
           LOWER(TRIM(inventory.program_name))
      WHERE NOT EXISTS (
        SELECT 1
        FROM organization_opportunities existing
        WHERE existing.organization_id = mason.id
          AND LOWER(TRIM(existing.title)) =
              LOWER(TRIM(inventory.title))
      )
    `, [MCA_SLUG]);
  } finally {
    await pool.end();
  }
}

function installConceptProtection() {
  const createExpressApp = express;

  function createAppWithMasonConcept(...args) {
    const app = createExpressApp(...args);

    app.use((req, res, next) => {
      if (
        !String(req.path || "").toLowerCase().startsWith(MCA_PATH)
      ) {
        return next();
      }

      res.set(
        "X-Robots-Tag",
        "noindex, nofollow, noarchive"
      );

      const originalSend = res.send.bind(res);

      res.send = body => {
        if (typeof body !== "string") {
          return originalSend(body);
        }

        const notice = `
          <div style="
            padding:12px 18px;
            color:#5b4100;
            background:#fff4cc;
            border-bottom:1px solid #ead27a;
            text-align:center;
            font-family:Arial,sans-serif;
            font-size:14px;
            font-weight:700;
            line-height:1.45;
          ">
            Private Vivid concept demonstration — not yet approved,
            endorsed, or published by Mason Classical Academy.
          </div>
        `;

        body = body
          .replace(
            /<head>/i,
            '<head><meta name="robots" content="noindex,nofollow,noarchive">'
          )
          .replace(/<body([^>]*)>/i, `<body$1>${notice}`);

        return originalSend(body);
      };

      return next();
    });

    return app;
  }

  Object.assign(createAppWithMasonConcept, createExpressApp);

  require.cache[
    require.resolve("express")
  ].exports = createAppWithMasonConcept;
}

async function start() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  await seedMasonConcept();
  installConceptProtection();
  require("./asset-bootstrap");
}

start().catch(error => {
  console.error("MCA MARKETPLACE CONCEPT ERROR:", error);
  process.exitCode = 1;
});
