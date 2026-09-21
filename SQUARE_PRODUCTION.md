# Square live tracked offers and verified sales

## Current release scope

A connected merchant can opt into Square-hosted checkout for fixed-price USD offers. Only an eligible non-test Vivid campaign scan can open an offer. The order carries that scan's click ID. Completed payments are matched to the advertiser and scan; ordinary sales stay unmatched. Matched completed USD payments now project into native conversion events used by campaign, QR, customer-action and executive revenue/ROI reports. The Square report remains the payment audit trail; its totals are not separately added again.

On September 21, 2026, a $1 live purchase matched campaign 66, QR 60 and scan 39609. Native conversion reporting was missing at that point; this change backfills it on the next successful sync. Deployed native report verification and the live refund check remain pending.

## Configuration

Keep the existing private Railway variables:

- SQUARE_PRODUCTION_APPLICATION_ID
- SQUARE_PRODUCTION_APPLICATION_SECRET
- SQUARE_PRODUCTION_TOKEN_KEY (32 random bytes encoded as base64, preserved across deploys)
- SQUARE_PRODUCTION_REDIRECT_URL=https://vivid-routing-production.up.railway.app/integrations/square/production/callback
- SQUARE_PRODUCTION_ENABLED=true
- SQUARE_PRODUCTION_AUTO_SYNC (optional; false disables polling)

Sandbox and production credentials, tables, state and routes are separate. Never put secrets in source, screenshots or chat.

## Merchant setup

1. Open `/integrations/square/production/customers/ADVERTISER_ID` as that advertiser's authorized manager. Connect the correct merchant. Default OAuth remains MERCHANT_PROFILE_READ, PAYMENTS_READ, ORDERS_READ.
2. Choose Configure tracked live checkout. The explicit authorization action additionally requests ORDERS_WRITE and PAYMENTS_WRITE, as required by Square CreatePaymentLink. Existing read-only connections are not silently upgraded. The app exposes no refund-creation endpoint.
3. Configure a non-test campaign, active USD Square location, offer name and final total. Enable only a merchant-approved offer. This version supports one fixed-price offer per campaign, USD $1–$10,000, one item, no shipping, no added tax or tips. Any applicable tax must be included in the configured total; agree fulfillment with the merchant.
4. Use the displayed destination `/integrations/square/production/buy/ADVERTISER_ID/CAMPAIGN_ID` in a Website Customer Action. Leave conversion URL empty and value 0. The Vivid QR routing appends vivid_click_id.
5. A buyer opens the QR and customer action, reviews the offer, then pays on Square. No Vivid account is required for the buyer. A return URL alone does not create or confirm a sale.

The first checkout request freezes its price, merchant, order body and idempotency key. Retrying the same scan reuses the same checkout. A new purchase starts from a new scan. Updating an offer affects new checkout requests. Disabling an offer blocks new requests through Vivid; already-issued Square payment links remain valid and must be managed in Square if withdrawal is needed.

## Durable sync and reporting

- Initial import covers payment creation in the previous 90 days. Existing production snapshots migrate into the ledger without overwriting newer records.
- Later imports use payment/refund updated timestamps with a one-day overlap for eventual consistency, including newly changed old payments. Refunds are read independently and their parent payment is refreshed.
- Each page and its cursor commit in one PostgreSQL statement, fenced by the current connection and unexpired sync lease. Interrupted jobs resume from a committed page. Per-customer/merchant/payment keys deduplicate retries.
- Imported records remain after 90 days. No automatic transaction deletion. Changing merchants hides the prior merchant's records from the current report.
- Amounts use integer currency minor units. Currency totals remain separate; only COMPLETED payments and COMPLETED refunds affect net collections. Tax/tips are included; processor fees are not deducted.
- Attribution requires one exact, unambiguous payment/order reference, an owned scan before the payment within 30 days, and a non-test campaign. Current test/deleted/transferred campaigns are excluded from attributed report totals.
- Campaign links drill into verified sales. UTC date filters, 50-row transaction pages and CSV export use the same verified records. CSV neutralizes spreadsheet formula prefixes.
- The report marks an incomplete sync window as catching up. Five-minute polling is eventually consistent, not a real-time guarantee.

Native reporting uses one event per advertiser/merchant/payment, timestamped at purchase. Its value is collected USD less completed refunds, without processor-fee deductions. Partial and full refunds revise that original value; a fully refunded purchase remains one historical conversion with zero revenue. Existing estimates for the same scan and customer action are retained as superseded records and excluded from conversion totals. Other actions remain unchanged. Non-USD payments stay in the currency-separated Square report. Existing campaign cost allocation and payment-date reporting apply; refunds restate the original purchase period. Reconciliation retries after failure and backfills retained payments, so no new purchase is needed. Disconnecting a merchant preserves historical conversion events.

This release does not automatically identify unrelated in-store purchases: those need a register redemption/order-reference workflow. General shopping carts, catalog inventory, shipping, disputes, and webhook revocation notifications are not included in this fixed-offer release.

## Acceptance

1. Merchant grants checkout scopes and enables an agreed real offer on a non-test campaign.
2. Fresh QR scan -> offer -> Square payment. The sale must show COMPLETED with the correct campaign, scan, QR, merchant and order reference.
3. Refresh/retry must leave one payment record. Verify another ordinary Square sale remains unmatched.
4. Merchant issues an agreed refund in Square; the next sync reduces the same campaign's net. Cross-check Square totals and CSV.
5. Check unauthorized advertiser access, no-login buyer flow and mobile presentation in the deployed app.

Do not charge a card or issue a live refund without the participant's explicit consent.

## Tests

`node --test square-production.test.js square-sandbox.test.js`

Database-backed flow tests use PGlite (PostgreSQL in WASM), not a SQL-string mock:

```
npm install --prefix /tmp/vivid-square-tests @electric-sql/pglite
NODE_PATH=/tmp/vivid-square-tests/node_modules node --test square-production-flow.test.js square-production-conversions.test.js
```

Tests cover page interruption/resume, snapshot migration, old-payment refunds, expired leases, merchant separation, forged scans, server-owned prices, timeout retries, disabled offers and OAuth opt-in. Square API responses are simulated; live merchant acceptance is still required.

## Rollback

Set SQUARE_PRODUCTION_ENABLED=false and redeploy to stop routes/workers while retaining data. Disable individual offers for new Vivid checkout requests. Disconnect revokes OAuth access, but is not a payment-link deletion tool. Keep the token encryption key.

## API references

- https://developer.squareup.com/reference/square/checkout-api/create-payment-link
- https://developer.squareup.com/reference/square/payments-api/list-payments
- https://developer.squareup.com/reference/square/refunds-api/list-payment-refunds

