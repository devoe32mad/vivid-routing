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
Meta, LinkedIn, GA4 and TikTok Ads follow the same read-only evidence boundary. TikTok remains hidden in the roadmap until its application variables are valid; it never presents a dead connection control.

## Recommended connector order

1. Complete TikTok application approval and production authorization testing.
2. Add YouTube organic analytics; paid YouTube remains part of Google Ads.
3. Add Pinterest, Reddit Ads and Snapchat based on production API access.
4. Add Search Console and Shopify for organic search and commerce evidence.
5. Add Mailchimp/Klaviyo, call tracking, HubSpot/Salesforce and additional POS providers.

## TikTok Ads setup

The connector requires these deployment variables:

- `TIKTOK_ADS_OBSERVATION_ENABLED=true`
- `TIKTOK_ADS_APP_ID`
- `TIKTOK_ADS_APP_SECRET`
- `TIKTOK_ADS_TOKEN_KEY` — a base64-encoded 32-byte encryption key
- `TIKTOK_ADS_REDIRECT_URL` — exactly `https://<production-host>/admin/connectors/tiktok-ads/callback`
- `TIKTOK_ADS_AUTO_SYNC=false` only when automatic hourly collection should be disabled

The TikTok developer application must register the exact redirect URL and receive the reporting/account permissions required by TikTok. Vivid requests read-only account, campaign, delivery, spend, video-engagement and reported-outcome data. It does not create or modify advertising.

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
- TikTok API for Business: https://business-api.tiktok.com/portal
- Shopify orders and access scopes: https://shopify.dev/docs/api/admin-graphql/latest/objects/Order
- Search Console reporting: https://developers.google.com/webmaster-tools/v1/how-tos/search_analytics

## Validation

`node --test test/marketing-command-center.test.js ai-readiness.test.js test/cross-channel-recommendation.test.js test/marketplace-campaign-builder.test.js`

Tests cover date validation, identity/session boundaries, rejection before metric
reads, real PostgreSQL aggregation, optional Square columns, non-additive revenue,
escaped content and actual startup installer composition. The dashboard itself makes no external API calls. Explicit Google connection and import
actions call Google OAuth and reporting endpoints and write private evidence to Vivid;
they never change Google campaigns or spending.
