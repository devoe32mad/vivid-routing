# PAC World private Vivid demonstration

Native page/helper/export snapshot: `7d814a81f87ae1356826236d87f99eea40ea198b` (98 routes). Publisher behavior follows Rubber World; isolated runtime adapted from Canterbury.

Run `npm ci && npm start`. No production database connection, pg client, mailer or external service credentials. An in-memory PGlite database contains fictional records and resets on restart. Invitation token is hashed in source; cookies are restricted to `/demo/pac-world`. No production startup scripts run.

Inventory: official 2026 PAC World media kit and advertising page, reviewed October 15, 2026. 20 print placements (5 formats × 4 issues), 6 website banners. Rates are USD; web rates are per calendar quarter, not CPM. Repeat-insertion quantities use media kit discounts. Future dates/rates require confirmation; historical issue availability is illustrative. Images are rendered excerpts from the official media kit. Advertising coordinator Angela Sayegh is published; assigned reps are fictional.

Working sample flows: request, publisher approval, advertiser setup with optional QR, agreement, insertion fulfillment, renewal draft, sales rep reassignment, campaign destination change. PDF/XLSX/CSV exports. No mail, payment, legal acceptance, live analytics or live account integrations. Other native setup/settings forms are view-only. Changes are shared within this private demo instance and reset on restart.

Checks: `PAC_DEMO_TOKEN=... PORT=3129 node verify.mjs`; `PAC_DEMO_TOKEN=... PORT=3128 node crawl-check.mjs`. Tests cover both QR paths, 4-insertion pricing, fulfillment, renewal, destination change, seven exports, access boundaries and 180 linked pages.
