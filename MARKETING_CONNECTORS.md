# Marketing Command Center: first release

The advertiser page is `/admin/marketing-command-center`. The enterprise page is
`/org-marketing-command-center/advertiser/:advertiserId?organization_id=:organizationId`, linked from each advertiser Evidence Passport.

This release reads owned Vivid campaigns and dated events. It shows matched Square
events as a subset of Vivid conversions, not a second revenue total. It does not
read a merchant's full transaction ledger into enterprise views. It does not infer
account ownership from contact email or matching advertiser names. Even platform
administrators see only their own advertiser campaigns on the advertiser page.

Suggestions are deterministic checks based on measured scans, intent and recorded
conversions. They do not forecast outcomes or recommend automatic spending.
Google Ads advertiser-owned OAuth and manual read-only reporting imports are implemented behind
`GOOGLE_ADS_OBSERVATION_ENABLED`. See [Google Ads setup](GOOGLE_ADS_READONLY.md).
Production account access still requires application configuration and live verification.
The earlier enterprise setup remains separate and does not grant access to private advertiser imports.
Meta, LinkedIn and the other catalog entries are explicitly planned, with no fake connect buttons.

## Recommended connector order

1. Complete Google Ads read-only account authorization and reporting; use existing Vivid and Square conversion evidence.
2. Meta Ads and LinkedIn Ads; add GA4 to understand website outcomes.
3. Search Console and Shopify for organic search and commerce evidence.
4. Mailchimp/Klaviyo, call tracking, HubSpot/Salesforce sales outcomes.
5. Additional POS providers and paid-media platforms based on customer demand.

Physical placements (billboards, magazines, Valpak, sponsorships and events) need
cost records and campaign-specific QR/URL/offer/call identifiers. Do not assume a
provider API exists. A reviewed CSV import is a future fallback, not implemented here.

## Next implementation gates

- Provider authorization, app approval where required, encrypted credentials, scoped account selection, read-only transport and sync audits.
- Advertiser-owned external accounts with explicit, campaign-level sharing to enterprises; enterprise inventory relationships never imply access to all advertiser media accounts.
- Preserve source, external account/campaign IDs, currency, timezone, date range, attribution window, conversion definition and last successful sync.
- Display provider-reported conversions separately from verified sales. Reconcile transaction/event identities before presenting combined revenue.
- Comparable period costs, deduplicated outcomes and sufficient evidence before budget/CAC/ROI or vertical rankings.
- Reauthorization/disconnection, retry and pagination handling, stale data and partial-period indicators.

## Official references checked September 22, 2026

- GA4 reporting and custom dashboards: https://developers.google.com/analytics/devguides/reporting/data/v1
- LinkedIn ads reporting (`r_ads_reporting`): https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/ads-reporting
- Shopify orders and access scopes: https://shopify.dev/docs/api/admin-graphql/latest/objects/Order
- Search Console reporting: https://developers.google.com/webmaster-tools/v1/how-tos/search_analytics

## Validation

`node --test test/marketing-command-center.test.js ai-readiness.test.js test/cross-channel-recommendation.test.js test/marketplace-campaign-builder.test.js`

Tests cover date validation, identity/session boundaries, rejection before metric
reads, real PostgreSQL aggregation, optional Square columns, non-additive revenue,
escaped content and actual startup installer composition. The dashboard itself makes no external API calls. Explicit Google connection and import
actions call Google OAuth and reporting endpoints and write private evidence to Vivid;
they never change Google campaigns or spending.
