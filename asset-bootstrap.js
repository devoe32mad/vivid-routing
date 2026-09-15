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

  app.use((req, res, next) => {
    const originalSend = res.send.bind(res);

    const normalizeMarketplaceWording = body =>
      body
        .replace(/\bper\s+per\s+year\b/gi, "per year")
        .replace(/\bper\s+per\s+event\b/gi, "per event")
        .replace(/>\s*year\s*</gi, match =>
          match.replace(/year/i, "Per Year")
        )
        .replace(/\b1\s+Years\b/g, "1 Year")
        .replace(/\b1\s+Issues\b/g, "1 Issue")
        .replace(
          /\.marketplace-card-description\s*\{[\s\S]*?\}/g,
          `.marketplace-card-description {
              display:block;
              overflow:visible;
              margin:12px 0 0;
              color:#6b7b72;
              font-size:14px;
              line-height:1.55;
            }`
        )
        .replace(
          /Saint John Neumann High School-Main Campus/g,
          "Saint John Neumann High School – Main Campus"
        )
        .replace(
          /Website to Promote/g,
          "Website or Social Page to Promote"
        )
        .replace(
          /\/org-opportunity\/24\/photo/g,
          "/assets/sjn-marketplace/car-line-opportunity.jpg"
        )
        .replace(
          /\/org-opportunity\/20\/photo/g,
          "/assets/sjn-marketplace/football-stadium-opportunity.jpg"
        );

    const escapeHtml = value =>
      String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    res.send = body => {
      if (
        typeof body === "string" &&
        (
          req.path === "/org-marketplace" ||
          req.path.startsWith("/advertise/")
        )
      ) {
        body = normalizeMarketplaceWording(body);

        if (
          req.path.startsWith("/advertise/") &&
          String(req.query.program_id || "") === "3"
        ) {
          body = body.replace(
            /<small>Per Year<\/small>/g,
            "<small>1 Issue</small>"
          );
        }

        const opportunityMatch = req.path.match(
          /^\/advertise\/[^/]+\/location\/\d+\/opportunity\/(\d+)$/
        );

        if (
          opportunityMatch &&
          process.env.DATABASE_URL
        ) {
          const opportunityId = Number(
            opportunityMatch[1]
          );
          const detailPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
          });

          detailPool.query(
            `
              SELECT description
              FROM organization_opportunities
              WHERE id = $1
              LIMIT 1
            `,
            [opportunityId]
          )
            .then(result => {
              const description = String(
                result.rows[0]?.description || ""
              ).trim();

              if (description) {
                const investmentMarker = `
                    <div class="summary-row">
                      <div class="summary-label">
                        Investment
                      </div>`;

                const descriptionHtml = `
                    <div class="summary-row">
                      <div class="summary-label">
                        Opportunity Details
                      </div>

                      <div class="summary-value" style="font-weight:normal;">
                        ${escapeHtml(description)}
                      </div>
                    </div>

`;

                body = body.replace(
                  investmentMarker,
                  descriptionHtml + investmentMarker
                );
              }

              originalSend(body);
            })
            .catch(error => {
              console.error(
                "MARKETPLACE DESCRIPTION ERROR:",
                error
              );
              originalSend(body);
            })
            .finally(() => detailPool.end());

          return res;
        }
      }

      return originalSend(body);
    };

    next();
  });

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
      UPDATE organization_opportunities
      SET
        title = CASE
          WHEN id = 21
            THEN 'Gymnasium Partnership – Placement A'
          WHEN id = 23
            THEN 'Gymnasium Partnership – Placement B'
          ELSE title
        END,
        description = CASE
          WHEN id = 22
            THEN 'Reach Saint John Neumann families, students, alumni, and visiting teams throughout the baseball season, including games and other baseball events, with measurable engagement and performance reporting.'
          WHEN id = 24
            THEN 'Prominent fence signage visible to families, students, faculty, visitors, and daily car-line traffic at Saint John Neumann Catholic High School. Estimated audience: 300 cars daily and 700 students and faculty. Approximately 150,000 impressions annually, plus an estimated 30,000 impressions during football and soccer games.'
          ELSE description
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = 23
        AND id IN (21, 22, 23, 24)
    `);

    await pool.query(`
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
        23,
        44,
        2,
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
      WHERE NOT EXISTS (
        SELECT 1
        FROM organization_opportunities existing
        WHERE existing.organization_id = 23
          AND existing.program_id = 2
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
