# Automatic marketing reporting

Connected accounts should provide scheduled collection, a private platform dashboard, visible freshness, and recommendations grounded in their available evidence. Connecting an account should not require users to repeatedly import reports.

## Implemented connectors

- Google Ads: the existing web service polls for due accounts every minute. Each successful automatic sync schedules the next one an hour later and replaces the latest 31 account-calendar days atomically. Existing connections become due on migration; new connections and reconnects become due immediately. Older imported history remains available. The account dashboard provides spend, impressions, clicks, CTR, CPC, reported conversions/value, daily results, freshness and recommendations. Refresh now remains an optional historical/backfill control.
- Square: the existing five-minute production worker remains unchanged. The command center links to its sales dashboard and displays the sync state. Matched Square payments remain a subset of recorded Vivid conversions.
- Vivid: first-party campaign results remain available in the command center with the existing performance suggestions.
- Other platform cards describe planned integrations; they are not connected or scheduled collectors.

## Reliability and privacy

Scheduling lives in PostgreSQL, survives restarts, and uses connection row locks plus a due-time recheck to coordinate replicas and manual refreshes. Failed Google reads preserve prior evidence. Transient failures retry after 5 minutes with exponential backoff capped at 6 hours. Revoked/insufficient access pauses automatic collection until reconnect. Disconnect removes credentials, evidence and future scheduled work. Owner scoping and encrypted refresh tokens remain unchanged. Logs contain connection ID and fixed outcome codes, never credentials or provider response bodies.

`GOOGLE_ADS_AUTO_SYNC=false` disables the automatic worker; manual reads remain available. Existing `GOOGLE_ADS_OBSERVATION_ENABLED` and credential configuration are still required. `SQUARE_PRODUCTION_AUTO_SYNC=false` remains Square's independent control.

## Recommendations

Recommendations recompute when dashboards are opened using saved evidence. Stale reports (over two hours or last sync failed), incomplete coverage, empty delivery and small samples get explicit health/baseline messages. Google traffic comparisons exclude today, require at least 7 completed calendar days and 30 clicks, and compare equal seven-day windows when 14 days are covered. Campaign comparisons require 30 clicks and 1,000 impressions per campaign and use the same account, currency and channel. CPC movements are traffic signals, not proof of ROI. Conversion prompts explain that reported actions may be page views rather than leads or purchases. No recommendation changes ads, bids or budgets.

Google-reported value is never added to Vivid or Square revenue. Currency and account timezone remain explicit. Missing records do not by themselves establish zero activity; a newly published campaign may return no delivery rows.

## Future connector contract

Each additional connector must include account consent/ownership, encrypted renewable credentials, durable scheduled collection with retries, atomic idempotent snapshots, a platform dashboard with freshness and history, disconnect cleanup, and evidence-specific recommendations. Shared dashboards must preserve platform attribution and currency boundaries. A connection-only implementation is incomplete.

## Validation

Run `node --test test/google-ads-readonly.test.js test/marketing-command-center.test.js test/automatic-marketing-sync.test.js` with `@electric-sql/pglite` available. Tests cover PostgreSQL migrations, automatic schedules, duplicate due work, failure preservation/backoff/recovery, revoked access/reconnect/disconnect, worker overlap and lock contention, account-local dates, recommendation evidence gates, owner isolation, and attribution separation.
