# Square production read-only pilot

This release adds a separate live OAuth connection and a rolling 90-day payment/refund report. It is NOT a production checkout launch or a replacement for Vivid conversion ROI reporting.

## Activation

In the Square Developer Console, open Vivid Spots, choose Production and register this OAuth redirect URL:

https://vivid-routing-production.up.railway.app/integrations/square/production/callback

Set these private Railway service variables (do not commit or paste secrets into chat):

- SQUARE_PRODUCTION_APPLICATION_ID: production OAuth application ID, starting sq0idp-
- SQUARE_PRODUCTION_APPLICATION_SECRET: production OAuth application secret
- SQUARE_PRODUCTION_TOKEN_KEY: a new cryptographically random 32-byte key encoded as base64; preserve it across deployments, do not reuse the Sandbox key
- SQUARE_PRODUCTION_REDIRECT_URL: the exact HTTPS callback above
- SQUARE_PRODUCTION_ENABLED: true, set after the other values are ready
- SQUARE_PRODUCTION_AUTO_SYNC: defaults enabled; false disables background polling

On a trusted local Node runtime, generate the key with:

    node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"

After deployment, an authorized Vivid advertiser manager opens:

https://vivid-routing-production.up.railway.app/integrations/square/production/customers/17

Connect only the real merchant intended for this advertiser. Square requests MERCHANT_PROFILE_READ, PAYMENTS_READ and ORDERS_READ. No payment/refund/order write permissions are requested. Each merchant can belong to one Vivid advertiser connection. OAuth requires merchant sign-in and consent.

## Verify

- Connection shows the intended production merchant; locations agree with Square.
- Sales report agrees with Square for the displayed payment creation window and currency.
- Pending/failed payments are excluded from collected amounts; only completed refunds reduce net.
- Matching requires an exact payment/order reference, one owned scan in the prior 30 days, and a non-test campaign. Ordinary Square sales without this reference remain unmatched.
- Background sync updates in about five minutes; failures retain the prior snapshot and show retry status.
- Sandbox data, tokens, state, jobs and reports remain separate. Production token ciphertext is bound to both environment and advertiser.

## Limits and remaining rollout work

The report replaces a rolling 90-day snapshot; it is not a durable lifetime ledger. It supports at most 2,000 payments per import and a bounded execution time; larger imports fail without replacing prior results. Refunds on payments outside the window are outside this report. Totals include tax/tips and are net of refunds, not processing fees. Currency totals are kept separate.

Live hosted checkout, automatic reference propagation for real purchases, durable incremental history, webhook revocation handling, deduplication against conversion events and integration into executive ROI remain separate work. No real charge is created by this release. Do not advertise the full purchase attribution integration as launched until these and a real merchant pilot are verified.

## Rollback

Set SQUARE_PRODUCTION_ENABLED=false and redeploy to remove live routes and stop workers. This leaves stored data intact. To revoke access, use Disconnect while enabled or revoke Vivid in Square. Keep the encryption key if reconnection to stored data is needed.

## Validation

Run node --test square-sandbox.test.js square-production.test.js. The route and API tests use mocked Square/SQL responses; a real merchant connection and PostgreSQL activation still require live verification.
