# Google Ads reporting connector

Implemented September 22, 2026. This release adds advertiser-owned authorization,
manual imports and dashboard evidence. It does not activate a live account by itself.

## What an advertiser can do

Open `/admin/connectors/google-ads` from the Marketing Command Center. Enter a
Google customer ID (and manager ID only when needed), continue to Google, and
authorize an account they can access. The callback verifies that the selected
account is a production advertising account. Multiple accounts can be connected
separately. Automatic account discovery is a later improvement.

Open a connected account, choose up to 31 days, and import reports. The dashboard
then displays campaign channel, spend, impressions, clicks, reported conversions
and reported value. Each account has import history, reporting timezone, currency
and a last-successful-import timestamp. A disconnect action removes that account’s
credentials and imported reports; it does not modify Google campaigns. Google-side
application access can separately be revoked in the user’s Google Account.

Imports are manual in this release. There is no background scheduler, automatic
retry, campaign creation, bid update, budget change, or conversion upload.

## Production activation

The code is disabled by default. Railway’s production `vivid-routing` service had
no `GOOGLE_ADS_` variable names when inspected on September 22, 2026. No secrets
were read or changed during that inspection.

1. Use a Vivid-owned Google Cloud project with Google Ads API enabled and access
   approved for production accounts. Configure the Google OAuth consent/branding
   details and verification as required by Google. External testing accounts must
   be allowed in the OAuth application while it remains in testing.
2. Create a Web application OAuth client with this exact redirect URI:
   `https://vivid-routing-production.up.railway.app/admin/connectors/google-ads/callback`.
3. Set these variables in the Railway **vivid-routing production service**. Keep
   client secrets and encryption keys out of source, chat, screenshots and logs.

| Variable | Required value |
| --- | --- |
| `GOOGLE_ADS_CLIENT_ID` | The web OAuth client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | Its secret, stored only in Railway |
| `GOOGLE_ADS_TOKEN_KEY` | A unique cryptographically random 32-byte key, base64 encoded |
| `GOOGLE_ADS_REDIRECT_URI` | The exact HTTPS redirect URI above |
| `GOOGLE_ADS_API_VERSION` | `v25` (also the default); review compatibility before changing |
| `GOOGLE_ADS_OBSERVATION_ENABLED` | `true`, only when ready for account authorization |

The encryption key must survive deploys. Replacing it without migrating encrypted
credentials requires affected accounts to reconnect. Do not reuse Square’s key.
Invalid or incomplete configuration disables the connector without preventing
the rest of Vivid from starting. Setting the enable flag to false stops new
connections/imports and hides private Google reports from the dashboard; stored
credentials remain until removed while the connector is enabled.

4. After merge/deploy, sign into the advertiser portal and authorize the pilot
   account. Import a short date range and compare campaign values against Google
   Ads using the same dates, account timezone and conversion columns.
5. Re-import the range, check stable counts, and test reconnect/disconnect before
   broad rollout. These live checks require an authorized Google account and have
   not been performed by the fixture tests.

Google’s current migration guidance says developer tokens were sunset September
9, 2026 and access now belongs to the Cloud project. This implementation does not
require or send a developer token. Some general Google documentation still shows
the old header; use the specific migration guide linked below.

## Read-only enforcement and privacy

Google uses the broader `https://www.googleapis.com/auth/adwords` OAuth scope;
this is **not a provider-issued reporting-only token**. The consent screen may
describe campaign management permission. The Vivid client exposes only two fixed
GAQL reads (customer metadata and daily campaign metrics), plus OAuth token
exchange/refresh. No caller-controlled endpoint or GAQL is accepted. A Google
user with read-only account access provides a further provider-side restriction.

Connections belong to the signed-in `users.id`. Neither a supplied owner ID,
super-admin status, advertiser contact email nor an enterprise relationship grants
access to another owner’s connection. The new `google_ads_private_*` tables are
separate from the earlier enterprise `marketing_*` setup tables. No private Google
metrics enter the enterprise Evidence Passport or enterprise dashboard. Explicit
campaign-level consent and sharing are future work; the importer does not write
to existing Vivid events, passport learning records, or anonymized learning pools.

OAuth state is session-bound, user-bound, ten-minute-lived and stored as a hash.
State consumption is atomic with credential storage. Disconnect invalidates
pending states. Credentials use AES-256-GCM with owner/account binding. CSRF
tokens protect connect/import/disconnect; responses use no-store and no-referrer.
Provider error bodies, authorization codes and credentials are not logged or
rendered. Reports use fixed Google hosts, reject redirects, enforce per-request
timeouts and stop after bounded pagination. Simultaneous imports on a connection
are rejected using a database row lock.

## Reconciliation boundary

Google conversions retain fractions and adjustments; monetary costs are stored
as exact integer micros. A successful import replaces the entire date window in a
single database transaction, including rows that disappeared since the previous
import. A failed fetch leaves the previous report intact and records a sanitized
failure. A database failure rolls back the snapshot and its success audit together.
Reports preserve source account/campaign, channel, dates, currency, timezone,
payload hash, API version and the import record that produced each row.

Google attribution claims are never added to Vivid/Square sales. Square remains a
subset of recorded Vivid conversions. There is no cross-provider transaction-level
deduplication yet. Conversion action definitions and attribution windows are not
imported; the UI discloses this. Do not infer incremental lift, blended ROAS, CAC,
or campaign/channel rankings from these reports. Missing dates are not treated as
zero activity. Separate currencies/timezones remain separate rows.

Next work: pilot verification, account picker, scheduled refresh with bounded
backoff, explicit enterprise campaign sharing, attribution metadata and
transaction-level reconciliation, then Meta and LinkedIn adapters.

## Validation

Run:

```sh
node --test test/google-ads-readonly.test.js test/marketing-command-center.test.js test/google-ads-observation.test.js test/install-google-ads-observation.test.js
```

Tests use stubbed Google HTTP responses and real PostgreSQL SQL via PGlite. They
cover tenant boundaries, state replay, CSRF, encryption, pagination, data types,
repeat imports, restatements, empty results, failure preservation, rollback,
token renewal, disconnection, XSS and the actual startup installer chain. They
make no Google account or production database changes.

## Official references checked September 22, 2026

- OAuth web-server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Ads scope and manager header: https://developers.google.com/google-ads/api/rest/auth
- Report search/pagination: https://developers.google.com/google-ads/api/rest/common/search
- API release notes: https://developers.google.com/google-ads/api/docs/release-notes
- Developer-token migration (updated September 11): https://developers.google.com/google-ads/api/docs/api-policy/developer-token
