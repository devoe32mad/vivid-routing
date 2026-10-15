# PAC World private Vivid demonstration

Native page/helper/export snapshot: `7d814a81f87ae1356826236d87f99eea40ea198b` (98 routes). Publisher behavior follows the reviewed Rubber World implementation. Standalone service; no production startup scripts, database, mailer, payments or external account credentials.

Run `npm ci && npm start`. Set `PAC_DEMO_DATA_DIR` to a dedicated persistent directory. Successful core mutations are serialized, atomically journaled, and replayed into isolated PGlite on startup. Invalid actions roll back. Railway mounts a PAC-only volume at `/data`; no other service shares it. Without the variable, local tests use ephemeral data. The private invitation is hashed; the session cookie is restricted to `/demo/pac-world` and renews when the invitation is reopened after restart.

Sources reviewed October 15, 2026:
- https://www.pacw.org/advertising
- https://www.pacw.org/wp-content/uploads/2025/12/PACWorld2026MediaKit.pdf
- https://www.pacw.org/wp-content/uploads/2025/12/PACWorld-2026-Ad-Insertion-Order_editable.pdf
- Representative June 2026 cover: https://www.pacw.org/wp-content/uploads/2026/07/C1-Cover_June_2026_OK.jpg
- Official SB1 example: https://www.pacw.org/wp-content/uploads/2020/08/SB1-300x250-1.png
- Logo: https://www.pacw.org/wp-content/uploads/2020/08/pacworld-logo-3.png

Published inventory: five print formats across four 2026 issues; six quarterly website banners. Historical placements are separated and blocked from booking. Proposed 2027 dates and prices are explicitly estimates using 2026 benchmarks, and require sample publisher confirmation. USD rates are per insertion or calendar quarter, never CPM. Three insertions use the two-insertion tier as a demo estimate. All capacity, advertisers, contracts, rep assignments and results are sample data. The four full-page examples share one $15,040 agreement; December has no simulated scans. Advertiser analytics represent simulated outcomes, not publisher revenue.

Working flows: select specific issues; submit and approve; one-step advertiser setup with optional QR; one agreement with separate artwork URLs/approval, deadlines, delivery dates and evidence; renewal draft; rep assignment; destination updates. Changes persist on the dedicated volume. PDF/XLSX/CSV exports include reps and fulfillment. Private QR previews require a review session. Account integrations, payments, emails and remaining native settings are labeled view-only. This is a shared reviewer workspace, not a multi-account authentication implementation.

Checks: `PAC_DEMO_TOKEN=... PORT=3129 node verify.mjs`; `PAC_DEMO_TOKEN=... PORT=3128 node crawl-check.mjs`. To test restart restoration, run verify then persistence-check.mjs in separate processes with the same fresh PAC_DEMO_DATA_DIR. Covers both QR options, issue pricing, fulfillment, renewal, destination edits, seven exports, rollback of invalid requests, archive blocking, access boundaries, and 180 linked pages.
