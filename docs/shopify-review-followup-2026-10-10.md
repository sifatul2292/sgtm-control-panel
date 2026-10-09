# Shopify review follow-up — 2026-10-10

Reference 135263. Existing submission remains Submitted / assigning a reviewer.
This records targeted follow-up evidence, not a guarantee of Shopify approval.

| Concern | Result | Evidence / remaining work |
| --- | --- | --- |
| Stale Event Logs | Fixed and deployed | Dedicated tenant log host filtering hid successful storefront requests. Tenant-isolated queries and summaries now show PageView, ViewItem, AddToCart and Purchase in the reviewer UI. Four production regression tests passed. |
| Account connection mismatch | Fixed and deployed | Selected container domain now replaces the global default; reviewer Account and embedded app both show review-track.tagioo.com. |
| Billing/browser lifecycle | Passed live checks | Decline retains Pro, Starter downgrade and Pro restoration confirmed. Incognito blocks third-party cookies; fresh install and one-time-code reconnection succeeded. Test uninstall webhook returned HTTP 200 / 28 ms. Owner authorized the final free Pro approval after reinstall; Shopify now marks Pro Current and no longer shows the expiry warning. |
| Feature claims | Panel corrected; Shopify copy pending | Removed unsupported CDN and browser-bypass guarantees, aligned Free Custom Loader access, clarified cookie limits. Shopify pricing still says Brave bypass and dedicated support + SLA. Submitted listing editor is locked. Owner explicitly chose to preserve the current queue; wording changes are deferred. |
| Privacy after uninstall | Real Shopify retry passed | Previously failing shop/redact webhook 36c5c39c-a801-5b52-912a-0bfc24119f67 returned 200 on delivery attempt 9 at 2026-10-09T19:14:58Z (Oct 10, 01:14 Dhaka), confirmed in Shopify Dev Dashboard and production logs. Read-only database check found zero victim connections, sessions and order deliveries; reviewer connection count remains one. Signed two-service replay also passed. New backup/log retention protections are described below; this proves the reviewed Tagioo storage paths, not merchant-controlled GA4/Meta deletion. |

## Deployment and validation

- Panel: local 38bcec5 and 9d815f0; production e35ed7a and 5a202c4, asset v99.
- Shopify app: local 8523b43, a8ba517 and 39314c0; production 0e4725a,
  b485735 and 2bd935e. Running image tagioo-shopify-app:review-39314c0.
- Production app: 11 tests passed, public endpoint HTTP 200. Invalid webhook
  signatures returned 401 on the cleanup image before the final billing-only fix.
- Local app: tests, lint and build passed; cleanup changes also passed typecheck.
- Root required syntax gate passed. No live Nginx, worker ingest, container
  lifecycle or real customer billing changes were made.
- Runtime/SQLite backups and previous stopped images remain privately on VPS for
  rollback. Credential values are excluded from repository documentation.

## Repeat the isolated privacy proof

Build the sibling Shopify app first. Run this script with the Node runtime that
supports that app; set PANEL_NODE to the runtime matching better-sqlite3's local
native build if different:

```sh
PANEL_NODE=/path/to/panel/node /path/to/app/node scripts/verify-shopify-privacy-e2e.mjs /path/to/tagioo-shopify-app
```

Uses localhost ports 17310 and 17320 exclusively, temporary synthetic data and
random test credentials. Stops both services and removes temporary files on exit.
Never points it at production data. This replay is not a Shopify-originated
48-hour delivery. Order deletion alone must not be presented as proof of all
personal-data erasure; see the storage follow-up and limits below.

## Backup and log follow-up

- Local baa8fb6/896c4d6/d9ec2e7 deployed as 75cb34c/c29aa42/d3310eb.
  Redaction scrubs matching orders from encrypted panel backups before it is
  acknowledged. Backup failures cause webhook retries. New and imported snapshots
  omit confirmed Shopify tenant raw event history. Snapshot creation is serialized
  with privacy writes; deleted-shop hashes remove matching old orders from copies.
- Raw event rows for confirmed Shopify tenants and archived/redacted connections
  expire using a 29-day date cutoff in Asia/Dhaka. Exact shared-log host markers
  scope shared-row expiry; unrelated tenants retain their existing settings.
  Active JSON event history already prunes at 30 days; its raw Shopify detail is
  excluded from new backups so backup rotation cannot extend that lifetime.
- VPS Nginx rotates daily with 14 archives. Reviewed rollout copies in
  /var/backups/tagioo-review-135263 now have a daily expiry job for files older than
  14 days. This limits rollback availability; it does not change live database data.
- Existing panel snapshot scrub applied successfully: four snapshots, zero
  previously redacted-shop orders found. Raw Shopify history omitted. Production
  focused checks and PM2 reload passed; panel/app public endpoints both HTTP 200.
- Local 76b7c43 deployed as 69c2ff9 removes erased-shop backup connection
  secrets and archived routing credentials. Three production backup tests passed,
  PM2 reload succeeded, and the final scrub completed on all four snapshots
  (zero erased-shop orders found). Both public endpoints returned HTTP 200.
- Final local six focused tests and actual two-service HTTP verifier passed.

## Deferred work and limits

Owner chose to preserve the current submission queue. The locked Shopify plan copy
still says Brave bypass and dedicated support + SLA; replace those with “Custom
Loader” and “Priority support” when Shopify permits editing. These claims remain a
review risk. No withdrawal/resubmission performed.

Deletion of data in merchant-owned GA4/Meta destinations and unknown external or
manually exported backup copies was not verified. Do not describe targeted order
or connection deletion as proof of every possible data copy being erased.
