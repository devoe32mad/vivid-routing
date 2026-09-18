# Square Sandbox connection

This first increment connects a Square test merchant to an existing Vivid advertiser and lists its Square locations. It does not import orders, calculate attribution, add campaign revenue, or enable production Square accounts. Routes are disabled unless explicitly enabled. No credentials are committed.

## Deployment configuration

After deploying this change, configure these server-side Railway variables:

- `SQUARE_SANDBOX_ENABLED=true`
- `SQUARE_SANDBOX_APPLICATION_ID=sandbox-sq0idb-V1Ja_ei-W3eJXPJuNZW5eQ`
- `SQUARE_SANDBOX_APPLICATION_SECRET`: copy privately from Square's Sandbox OAuth page.
- `SQUARE_SANDBOX_TOKEN_KEY`: a dedicated cryptographically random 32-byte key encoded as base64. Generate privately with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Preserve this key; replacing it makes saved connections unreadable.
- `SQUARE_SANDBOX_REDIRECT_URL=https://vivid-routing-production.up.railway.app/integrations/square/sandbox/callback`

Register that exact redirect URL in Square's Sandbox OAuth settings. This is a planned route, not a claim that it is deployed. The startup installer mounts the module after existing session and authentication setup. Invalid enabled configuration fails startup, so add all variables together before enabling.

## Manual acceptance test

1. Use a dedicated Vivid test advertiser account. Sign in as its primary advertiser user or a Vivid super admin.
2. Open `/integrations/square/sandbox/customers/ADVERTISER_CUSTOMER_ID`, substituting the Vivid customer ID (not the organization ID or Square location ID).
3. Open the Default Test Account's Sandbox Square Dashboard in another tab so Square has a Sandbox seller session.
4. Click Connect Square test account and grant merchant-profile read permission. Return to Vivid and verify the merchant is shown.
5. Open View Square test locations. Expected default location: `LYVBV2FCXDHJY`.
6. Verify a different advertiser and an anonymous session cannot access the connection page or locations.
7. Disconnect, verify Square revocation succeeds and Vivid removes the connection, then reconnect.
8. Validate token renewal with an expiring Sandbox connection. Never alter production tokens or use real seller data for this test.

Run automated checks with `node --test square-sandbox.test.js`. These use mocked Square and database operations. They do not replace the live Sandbox acceptance test or Postgres migration test.

## Remaining integration work

Order/payment/refund retrieval and permission expansion; signed webhook handling including revoked authorizations; a merchant/location mapping UI; transaction persistence and deduplication; explicit order-to-click attribution; report drilldowns; production rollout. No sales should be attributed just because they share a location or timestamp with a scan.

Reference: https://developer.squareup.com/docs/oauth-api/overview
