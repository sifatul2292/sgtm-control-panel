# Shopify review 135263 — findings and verification, November 17, 2026

**Submission status: Draft / Ready to submit. NOT submitted.** The owner explicitly
asked to check the changes first. Do not submit without a new instruction.

## What actually failed

The Nov 2 screencast shows the reviewer's app-created **Veil & Vow** workspace with
**No container** in Tagioo, while the embedded app claimed it was connected. Setup
Assistant contained the prepared review workspace's domain and GA4 ID. Old connection
validation accepted these settings even though the workspace did not own that
container. Events therefore went to the prepared workspace's logs; the reviewer saw
zero in their own workspace. Historical Nov 4 investigation recorded 35 requests,
including six purchase requests, in the prepared workspace. The Nov 17 dashboard still
shows the Nov 2 browser/server purchases there.

This was an app validation bug. A fresh merchant must either create their own real
container or see clear incomplete-setup guidance. Supplying a prepared account does
not excuse accepting an invalid connection. Log ingestion/cache delay was a second,
independent visibility issue.

## Existing Claude fixes confirmed live

- Panel 788080a: real-container and domain ownership checks on signed one-click connect.
- b3b0fe9: live Event Logs poll local logs about every three seconds.
- 0b69463 + app 7021fe8: disconnect/uninstall release the container.
- 563d085: Browser / Server request labels and combined purchase rows.
- Production had these Nov 4 releases before this session. The original checkout's
  November 3 entry saying they were undeployed was stale; the newer review worktree
  contained the deployment record.

## Fixes made and deployed today

1. **Legacy connection-code bypass:** moved real-container, domain ownership,
   configured destination and other-site validation into the shared connector.
   Missing/deleted/mismatched/unfinished containers cannot connect through either API.
2. **Retryable backend purchase delivery:** Shopify's existing durable app queue keeps
   its job when sGTM fails or times out. The panel returns 503 and only records delivery
   after sGTM accepts the hit. Retry/replay keeps one order and the same transaction ID.
   Network forwarding runs outside the JSON database lock. Other integrations retain
   their existing behavior.
3. **Purchase deduplication:** normalized Shopify Order GIDs in the web pixel to match
   numeric webhook IDs. Numeric, string and GID forms have a VM regression test.
4. **Honest setup status:** the embedded app asks users to verify events instead of
   claiming successful tracking from a saved connection. Downloaded GTM templates
   are distinguished from import/publication.
5. **Earlier Nov 13 work:** deployed generated Custom Pixel consent handling and the
   Setup Assistant's app-first copy with the panel update.
6. **Reviewer instructions:** saved current one-click steps and explicitly explained
   the prepared-account route versus a fresh workspace. Removed instructions to copy
   tracking settings or generate a retired connection code. Credentials were not changed.

Panel source commit **7173d49**, production commit **dd279a0**. App source **5c151a8**,
VPS source commit **a664c36**, image **tagioo-shopify-app:release-5c151a8**. Released
Shopify extension/config version **review-sync-20261117** (1228233539585).
Both review branches are pushed; they remain separate from the older local checkout.
Unrelated uncommitted work in both original checkouts was preserved.

## Actual end-to-end proof

- Connected **tagioo-test-store.myshopify.com** to the prepared review container.
- Created development product **Tagioo Review Test 2026-11-17**, product ID
  **15431942111536**, $1 USD, no shipping and no inventory limit. Left it available for
  the owner's follow-up check.
- Completed checkout through Shopify's **Test Payment Gateway** (Bogus). No real charge.
- Order **19206751453488** reached the correct Tagioo workspace:
  - browser Purchase: **10:18:32 AM Asia/Dhaka**, HTTP 200, $1 USD;
  - backend Purchase: **10:18:37 AM Asia/Dhaka**, HTTP 200, $1 USD;
  - Conversion Inspector: **1 tracked / 1 order**, one row labelled **Browser + Server**;
  - app Last backend order matched 10:18:37 AM; stored order has delivery confirmation.
- Disconnected the development store afterwards. The container is free again and
  remains live; the workspace is back on Free. The test product/order and evidence
  remain available. Reconnect in the app to repeat the test.
- Public panel and connector login return HTTP 200. HTTPS requests validate normally.
  The review container's `/healthz` returns the previously documented 503; it served
  both real test purchase requests with HTTP 200, so healthz alone is not liveness proof.
- Every running sGTM container ID matched before and after deployment and cleanup.
  No sGTM containers, Nginx configuration, worker ingest or Preview pilot were changed.
- Canary used a fresh isolated SQLite database, passed its login check, and was removed.
  Previous app container is retained stopped as **tagioo-shopify-app-before-5c151a8**.
  Private code/env/database backups and test/build logs are under
  **/var/backups/tagioo-review-20261117**. Keep private snapshots out of Git.

## Validation

- `npm run check`: passes.
- Panel full suite: **246/249**. The same three recorded pre-existing failures remain:
  Paddle activation and two WooCommerce plugin assertions. Focused Shopify/live-log/
  dashboard/template suite passed 81 checks, followed by both new purchase retry tests;
  35 relevant checks passed on the production host before reload.
- App: **36/36**, production 36/36, build, lint and typecheck pass.
- `shopify app config validate --json`: valid, no issues.
- The regression tests failed before their respective fixes and passed afterwards.

## AI self-review summary

Canonical source fetched November 17 using Shopify CLI:
[Shopify local self-review requirements](https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements).

- Likely passing: **29** (28 code-based findings plus successful live HTTPS checks).
- Likely failing in this local-checkable subset: **0** after the scoped fixes.
- Needs review: **2** below.
- Groups skipped: **10** below.

This subset excludes 2.1.4 itself and other submission/browser-only checks. The actual
purchase proof above addresses the specific reported synchronization failure. These
counts are not Shopify approval or proof of downstream destination acceptance.

### Requirements needing review

**1.1.4 — Use only factual information.** The premature embedded success banner is
fixed. The existing public listing still has old screenshots/video showing the earlier
setup flow and a “Consent Mode v2 (GDPR)” feature claim. Review/update those assets and
claims before submission; consent support is not a blanket compliance guarantee.

**1.2.2 — Billing implementation.** Code enforces Shopify billing for Shopify workspaces,
and the development store's existing Starter entitlement synced after connection.
This session did not repeat upgrade/downgrade/declined approval or reinstall billing
checks. The historical reviewer Pro-versus-Starter discrepancy was not independently
reproduced; cross-workspace configuration explains the differing workspaces, not a
proven billing reconciliation defect.

### Other limits to check before submitting

- Downstream GA4 and Meta receipt, attribution and destination deduplication were not
  independently checked. Tagioo's incoming HTTP 200 and unique-purchase UI are verified.
- The backend paid-order path does not carry/store the shopper's storefront consent
  decision. The strict app pixel has declared privacy requirements; backend forwarding
  does not automatically inherit them. Review this separately before claiming GDPR
  compliance or launching consent-sensitive tracking.
- No fresh screencast was recorded; the existing tutorial URL remains in the draft.
- Fresh own-domain container provisioning was not repeated on the live worker. Invalid
  and missing-container scenarios have regression coverage.
- Direct richer Meta CAPI delivery remains best-effort; the new retry guarantee covers
  acceptance at the customer's sGTM endpoint, not every downstream destination.

### Skipped groups

- 5.1 Online store — no theme app extension/theme modification integration.
- 5.2 Payment — not a payment gateway app.
- 5.3 Payment facilitator — opt-in assessment not requested.
- 5.4 Purchase option — no subscription-contract/purchase-option implementation.
- 5.5 Product sourcing — opt-in assessment not requested.
- 5.6 Checkout customization — no checkout UI extension.
- 5.7 Sales channel — not a sales-channel app.
- 5.8 Post purchase — no post-purchase extension.
- 5.9 Mobile app builders — opt-in assessment not requested.
- 5.10 Donation — opt-in assessment not requested.

### Resources

- [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
- [App best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices)
- [Shopify billing](https://shopify.dev/docs/apps/launch/billing)
- [Submitting for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review)

## Evidence

Screenshots are local artifacts, not public listing uploads:
`artifacts/shopify-review-20261117/purchase-deduplicated.jpg`,
`app-verified.jpg`, and `submission-draft.jpg`.
