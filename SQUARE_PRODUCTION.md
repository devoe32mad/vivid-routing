# Square live tracked offers and verified sales

## Current release scope

A connected merchant can opt into Square-hosted checkout for fixed-price USD offers. Only an eligible non-test Vivid campaign scan can open an offer. The order carries that scan's click ID. Completed payments are matched to the advertiser and scan; ordinary sales stay unmatched. Matched completed USD payments now project into native conversion events used by campaign, QR, customer-action and executive revenue/ROI reports. The Square report remains the payment audit trail; its totals are not separately added again.

On September 21, 2026, a $1 live purchase matched campaign 66, QR 60 and scan 39609. Native conversion reporting was subsequently fixed and the user confirmed it in Vivid. A live refund was not requested.

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

The in-store pilot below adds explicit claim-code attribution. Ordinary in-store purchases without an eligible approved code remain unmatched. General shopping carts, catalog inventory, shipping, disputes, and webhook revocation notifications are not included in this fixed-offer release.

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



## In-store redemption pilot (September 22, 2026)

A live iPhone Square POS card purchase confirmed that an item note is returned by RetrieveOrder on the completed order, with the exact payment ID in its tender. The diagnostic note `Vivid-POS-Check-01` is not a redemption code and must stay unmatched. No diagnostic card data or access tokens are stored in this implementation.

### Merchant setup and checkout

1. From Square live connection, open **Configure in-store offers** (`/integrations/square/production/customers/17/instore` for the pilot). Existing payment/order read permissions suffice. No extra Square write permissions are requested or used.
2. Select a non-test campaign and an active USD Square location. Enter the offer name and terms, including eligible products, exclusions and the discount staff must apply. Enable claims only for an agreed offer. This supports different basket items through merchant-checked terms; Vivid does not automatically enforce catalog eligibility or apply/verify the discount.
3. Put the displayed `/integrations/square/production/claim/ADVERTISER_ID/CAMPAIGN_ID` destination into one Website Customer Action with value 0 and no conversion page. Assign/schedule the campaign on the intended QR. The form does not rewrite routing or existing online offers.
4. Customer opens the campaign QR and claims the offer in Vivid. An eligible scan produces one random 40-bit code, formatted `V-7K3M9R2X` (eight base32 characters plus `V-`, omitting 0/O and 1/I). Repeated claims from the same scan return the same code. Claims do not produce conversion events. Claims expire after seven days, capped by the original scan's 30-day attribution window. This is single use per claim, not a one-per-person offer limit.
5. At the counter an authorized Vivid advertiser manager opens **Validate an in-store code** (`/customers/ADVERTISER_ID/instore/redeem` under the Square production root), selects the actual checkout location and enters the customer code. Vivid shows frozen terms and checks ownership, location, expiration and prior redemption. No new cashier role is granted automatically.
6. Staff confirms eligibility and approves the checkout, reserving a 30-minute payment window (or the claim expiry, if earlier). Repeating approval resumes that same window, never extends it. Staff manually applies the benefit in Square and puts only the complete code in an eligible item's note. A used or expired code cannot be approved again. Abandoned approvals expire; this pilot does not reset or recycle them.
7. Complete one USD card payment for the full Square order. Split tenders, cash, gift cards and partially paid orders are unsupported. Vivid requires the completed order's single card tender to name the exact imported payment and agree on location and total. Square continues to handle items, taxes and payment; there is no register cart injection or automatic cashier QR scanner in this release.
8. Sync latest sales or wait for the five-minute sync. Only a code approved before payment, with the order closed within its approved window, can be matched. The report displays the code, scan, campaign and QR evidence. Native conversions use the claim Customer Action, not the online buy action.

### Attribution and failure behavior

- Revenue represents the entire paid basket (including other items, taxes and tips), less completed refunds, not only the promoted item and not incremental lift. The merchant setup screen explains this basis. Tender/order/payment amount disagreement fails closed.
- New codes are 10 characters. Database uniqueness prevents reuse across claims, and issuance retries random-code collisions up to five times. Previously issued `VIVID-...` codes remain valid through their original expiry; existing scans keep their original code. Both formats use the same approval, merchant/location, expiry, payment and single-use checks. Customer and cashier screens include a Copy code button with a manual-selection fallback. Paste the whole code, including its prefix, into the item note.
- Codes and offer terms are frozen at claim time. Disabling an offer stops new claims; existing unexpired claims keep their terms. Saving a changed offer does not alter issued claims. Changing the connected merchant makes old claims unavailable.
- Only normalized code, eligibility and order-close timestamp are retained from notes; arbitrary notes and card/customer details are discarded. Codes go in POST bodies, not redemption URLs. Existing no-store/no-referrer response headers and session CSRF checks apply.
- Merchant approval is not proof of payment. Authenticated staff must still apply the discount and avoid accepting an already approved code for a second checkout. The pilot verifies order/payment linkage, not that staff applied the promised discount.
- Claim consumption and ledger attribution commit in one statement, fenced by the current merchant connection and sync lease. A failed write rolls back consumption. A matched code is permanently bound to its first accepted order/payment; later copies never create additional conversions. Multiple eligible orders presenting the same unconsumed code in the retained ledger are rejected without guessing.
- Payment/order reference plus an in-store code, different codes across item notes, malformed codes, missing approval, wrong location, late payment, duplicate scan references, or a test/transferred campaign do not qualify. A revoked match does not make a consumed code reusable.
- Existing online checkout, payment/refund syncing and native event deduplication continue. No production offers, campaign destinations, payments or refunds are created by deployment. No backfill is invented for the diagnostic sale.

### Validation and pilot acceptance

`NODE_PATH=/tmp/vivid-square-tests/node_modules node --test square-production.test.js square-production-flow.test.js square-production-conversions.test.js square-production-instore.test.js`

PGlite-backed tests exercise the actual route/model/sync SQL: scan -> claim -> approval -> completed order -> one native conversion, repeat imports, refund adjustments, tenant/location/CSRF restrictions, frozen offers, expiry, split payments, conflicting codes/references, lease failure, atomic write rollback/recovery and concurrent claim/approval retries. Square responses are simulated. The live note transport was verified separately; the complete new in-store flow still needs a merchant-approved live acceptance test after deployment.

For that acceptance, use a fresh scan and the actual newly issued code, validate/approve it through Vivid before payment, then follow the normal itemized Square checkout. Confirm one native conversion on the correct claim action and matching scan/QR evidence. Refresh twice to confirm no duplicate. The earlier diagnostic sale must remain unmatched. No further charge or refund is authorized by these instructions alone.

References: [Square item notes](https://developer.squareup.com/reference/square/objects/OrderLineItem), [Retrieve Order](https://developer.squareup.com/reference/square/orders-api/retrieve-order).
