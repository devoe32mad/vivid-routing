# Next integration: Clover

Decision (2026-09-21): prioritize Clover after the Square fixed-offer pilot, because Vivid is targeting local physical merchants and Clover explicitly supports third-party POS/web integrations for small and medium businesses. This is a product-fit judgment, not a claim that Clover is the largest provider. Stripe is the next alternative if the first available pilot primarily sells online.

## Start-up dependency

The Vivid owner needs a Clover global developer account and a Sandbox application/test merchant. No Clover account, app credentials or merchant authorization are connected to this repository yet. Do not use the legacy sign-up workflow for a new account.

Official entry point: https://docs.clover.com/dev/docs/global-developer-platform-get-started
Platform overview: https://docs.clover.com/dev/docs/home

## Build sequence

1. Use the global developer platform to create the Sandbox app and test merchant. Confirm the current region's OAuth endpoints, permissions, token expiration and production app approval requirements from that app's dashboard and API docs.
2. Add isolated Clover OAuth storage and merchant-to-advertiser ownership checks. Keep all credentials server-side. Start with the minimum read permissions for payments/orders/refunds.
3. Normalize provider payment IDs, currency minor units, statuses, references and refunds into a provider-specific durable ledger. Never share Square table keys or credentials.
4. Define the real attribution mechanism before calling a transaction attributable: a Vivid-generated checkout/order reference or an explicit register redemption linked to the order. A scan, a timestamp, location proximity or merchant account connection by itself is insufficient.
5. Import ordinary sales as unmatched; calculate verified campaign collections from only uniquely linked completed sales less completed refunds. Preserve drilldown evidence and avoid adding estimated conversions on top.
6. Test repeat imports, interrupted pagination, delayed refunds, revoked access, mismatched merchant, conflicting references and a real merchant pilot before claiming launch.

## Reuse from Square

Reuse the tested concepts of integer-money normalization, exact scan ownership/time-window checks, durable per-payment identity, refund updates, checkpointed page imports, merchant-scoped encryption and explicit authorization upgrades. Do not assume Square API fields, checkout behavior or permissions are valid for Clover.

## Not completed yet

Clover integration code, Sandbox acceptance, app approval and production merchant acceptance are not yet implemented or completed. This file records the selected next provider and concrete prerequisites, not a working connector.

Stripe references reviewed for the alternative online-first path:
- https://docs.stripe.com/connect
- https://docs.stripe.com/api/checkout/sessions/create
