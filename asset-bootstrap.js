const path = require("path");
const express = require("express");
const { Pool } = require("pg");

const createExpressApp = express;

function createAppWithAssets(...args) {
  const app = createExpressApp(...args);

  app.use(
    "/assets",
    createExpressApp.static(
      path.join(__dirname, "assets")
    )
  );

  return app;
}

Object.assign(createAppWithAssets, createExpressApp);

require.cache[
  require.resolve("express")
].exports = createAppWithAssets;

require("./server");

async function polishSjnMarketplace() {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pool.query(`
      UPDATE organization_opportunities oo
      SET
        title = CASE
          WHEN oo.title = 'Car Line Fence Sponsorhip'
            THEN 'Car Line Fence Sponsorship'
          ELSE oo.title
        END,
        category = CASE
          WHEN oo.category = 'Campus Visibilty'
            THEN 'Campus Visibility'
          ELSE oo.category
        END,
        pricing_unit = CASE
          WHEN LOWER(TRIM(COALESCE(oo.pricing_unit, ''))) IN (
            'per year', 'year', 'annual'
          ) THEN 'year'
          ELSE oo.pricing_unit
        END,
        suggested_term_unit = CASE
          WHEN oo.suggested_term_length = 1
            AND LOWER(TRIM(COALESCE(oo.suggested_term_unit, ''))) = 'years'
            THEN 'Year'
          WHEN oo.suggested_term_length = 1
            AND LOWER(TRIM(COALESCE(oo.suggested_term_unit, ''))) = 'issues'
            THEN 'Issue'
          ELSE oo.suggested_term_unit
        END,
        updated_at = CURRENT_TIMESTAMP
      FROM organizations o
      WHERE oo.organization_id = o.id
        AND (
          LOWER(COALESCE(o.website, '')) LIKE '%sjnceltics.org%'
          OR LOWER(COALESCE(o.name, '')) LIKE '%john neumann%'
        )
    `);

    await pool.query(`
      WITH sjn_athletics_space AS (
        SELECT
          existing.organization_id,
          existing.space_id,
          existing.program_id
        FROM organization_opportunities existing
        WHERE existing.id = 22
          AND existing.organization_id = 23
          AND existing.space_id = 44
          AND existing.program_id = 2
          AND existing.title = 'Baseball Stadium Partnership'
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
        sas.organization_id,
        sas.space_id,
        sas.program_id,
        'Football Stadium Partnership',
        'Build year-round visibility with SJN families, fans, alumni, and community supporters through a prominent football stadium sponsorship measured through Vivid.',
        'Athletics',
        1000,
        1000,
        'year',
        1,
        'Year',
        'Available',
        4,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM sjn_athletics_space sas
      WHERE NOT EXISTS (
        SELECT 1
        FROM organization_opportunities existing
        WHERE existing.organization_id = sas.organization_id
          AND existing.program_id = sas.program_id
          AND LOWER(TRIM(existing.title)) =
              LOWER('Football Stadium Partnership')
      )
    `);
  } catch (error) {
    console.error(
      "SJN MARKETPLACE POLISH ERROR:",
      error
    );
  } finally {
    await pool.end();
  }
}

setTimeout(polishSjnMarketplace, 3000);
