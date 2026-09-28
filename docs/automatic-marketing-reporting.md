# Automatic marketing reporting

Connected accounts should provide scheduled collection, a private platform dashboard, visible freshness, and recommendations grounded in their available evidence. Connecting an account should not require users to repeatedly import reports.

## Implemented connectors

- Google Ads: the existing web service polls for due accounts every minute. Each successful automatic sync schedules the next one an hour later and replaces the latest 31 account-calendar days atomically. Existing connections become due on migration; new connections and reconnects become due immediately. Older imported history remains available. The account dashboard provides spend, impressions, clicks, CTR, CPC, reported conversions/value, daily results, freshness and recommendations. Refresh now remains an optional historical/backfill control.
- Square: the existing five-minute production worker remains unchanged. The command center links to its sales dashboard and displays the sync state. Matched Square payments remain a subset of recorded Vivid conversions.
- Vivid: first-party campaign results remain available in the command center with the existing performance suggestions.
- TikTok Ads: the connector discovers authorized advertiser accounts, stores tokens with account- and owner-bound AES-GCM encryption, retains normalized daily campaign evidence, and schedules hourly collection with bounded retries. The dashboard keeps impressions, clicks, spend, video plays, 2-second/6-second views and TikTok-reported outcomes separate from verified Vivid revenue.
- Reddit Ads: the connector requests only the `adsread` scope, discovers authorized businesses and ad accounts, stores renewable credentials with account- and owner-bound AES-GCM encryption, and imports normalized campaign/date reports hourly. Spend remains in exact micros; Reddit purchase value is converted from cents. Reddit-reported conversions, leads and value remain separate from verified Vivid revenue.
- YouTube Analytics: the connector discovers the authorized channel, stores channel-bound encrypted OAuth credentials, refreshes video metadata, retains daily video evidence and schedules hourly collection. Organic views, watch time, engagement and subscriber activity remain separate from paid YouTube reporting in Google Ads and from verified sales.
- Other platform cards describe planned integrations; they are not connected or scheduled collectors.

## Reliability and privacy

Scheduling lives in PostgreSQL, survives restarts, and uses connection row locks plus a due-time recheck to coordinate replicas and manual refreshes. Failed Google reads preserve prior evidence. Transient failures retry after 5 minutes with exponential backoff capped at 6 hours. Revoked/insufficient access pauses automatic collection until reconnect. Disconnect removes credentials, evidence and future scheduled work. Owner scoping and encrypted refresh tokens remain unchanged. Logs contain connection ID and fixed outcome codes, never credentials or provider response bodies.

`GOOGLE_ADS_AUTO_SYNC=false`, `TIKTOK_ADS_AUTO_SYNC=false`, or `REDDIT_ADS_AUTO_SYNC=false` disables the corresponding automatic worker; manual reads remain available. Each connector's enable switch and valid credential configuration are still required. `SQUARE_PRODUCTION_AUTO_SYNC=false` remains Square's independent control.

Reddit requires `REDDIT_ADS_OBSERVATION_ENABLED=true`, `REDDIT_ADS_CLIENT_ID`, `REDDIT_ADS_CLIENT_SECRET`, a 32-byte base64 `REDDIT_ADS_TOKEN_KEY`, and `REDDIT_ADS_REDIRECT_URL=https://vivid-routing-production.up.railway.app/admin/connectors/reddit-ads/callback`.

## Recommendations

Recommendations recompute when dashboards are opened using saved evidence. Stale reports (over two hours or last sync failed), incomplete coverage, empty delivery and small samples get explicit health/baseline messages. Google traffic comparisons exclude today, require at least 7 completed calendar days and 30 clicks, and compare equal seven-day windows when 14 days are covered. Campaign comparisons require 30 clicks and 1,000 impressions per campaign and use the same account, currency and channel. CPC movements are traffic signals, not proof of ROI. Conversion prompts explain that reported actions may be page views rather than leads or purchases. No recommendation changes ads, bids or budgets.

Google-reported value is never added to Vivid or Square revenue. Currency and account timezone remain explicit. Missing records do not by themselves establish zero activity; a newly published campaign may return no delivery rows.

## Future connector contract

Each additional connector must include account consent/ownership, encrypted renewable credentials, durable scheduled collection with retries, atomic idempotent snapshots, a platform dashboard with freshness and history, disconnect cleanup, and evidence-specific recommendations. Shared dashboards must preserve platform attribution and currency boundaries. A connection-only implementation is incomplete.

## Validation

Run `node --test test/*.test.js` with development dependencies available. Tests cover PostgreSQL migrations, automatic schedules, duplicate due work, failure preservation/backoff/recovery, revoked access/reconnect/disconnect, worker overlap and lock contention, account-local dates, recommendation evidence gates, owner isolation, attribution separation, and Reddit's distinct `data.metrics` report contract.
