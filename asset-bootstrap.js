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
