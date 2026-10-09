# Shopify review follow-up — 2026-10-10

Reference 135263. Existing submission remains Submitted / assigning a reviewer.
This records targeted follow-up evidence, not a guarantee of Shopify approval.

| Concern | Result | Evidence / remaining work |
| --- | --- | --- |
| Stale Event Logs | Fixed and deployed | Dedicated tenant log host filtering hid successful storefront requests. Tenant-isolated queries and summaries now show PageView, ViewItem, AddToCart and Purchase in the reviewer UI. Four production regression tests passed. |
| Account connection mismatch | Fixed and deployed | Selected container domain now replaces the global default; reviewer Account and embedded app both show review-track.tagioo.com. |
| Billing/browser lifecycle | Passed live checks; final restoration pending | Decline retains Pro, Starter downgrade and Pro restoration confirmed. Incognito blocks third-party cookies; fresh install and one-time-code reconnection succeeded. Test uninstall webhook returned HTTP 200 / 28 ms. New Pro reapproval after reinstall requires owner Terms confirmation. |
| Feature claims | Panel corrected; Shopify copy pending | Removed unsupported CDN and browser-bypass guarantees, aligned Free Custom Loader access, clarified cookie limits. Shopify pricing still says Brave bypass and dedicated support + SLA. Submitted listing editor is locked; no withdrawal performed. |
| Privacy after uninstall | Bug fixed; delayed origin proof pending | Actual Shopify review logs exposed cleanup HTTP 500 with expired sessions. Cleanup routes now authenticate the signed raw body without refreshing revoked tokens. Signed replay through both actual HTTP services proves isolated customer/shop order deletion after uninstall and safe retries. Actual delayed Shopify shop/redact delivery still needs observation. |

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
48-hour delivery. Broader access-log/event-store/backup PII retention and deletion
remain unverified; order deletion alone must not be presented as proof of all
personal-data erasure.

## Remaining operator checks

1. Restore the free Pro test subscription after the authorized reinstall.
2. Correct Shopify plan copy when its editor is accessible: “Custom Loader” and
   “Priority support” replace unproven Brave-bypass and SLA promises.
3. Confirm a Shopify-originated shop/redact delivery returns 200 after the fix
   and verify its intended records are gone; distinguish this from signed replay.
4. Complete the broader PII storage/retention review before claiming full privacy
   deletion coverage. Preserve customer services and billing throughout.
