> Latest update: delayed privacy-routing fix deployed in both services.
> Panel production ce8f8c1; Shopify production 36b1bc9 / privacy-ec7787f image.
> Local tests cover uninstall, old-shop deletion, isolation and retry. The real
> delayed Shopify webhook and privacy retention in logs/backups remain unverified.
> Historical findings below describe the earlier audit; customer billing
> classification is corrected at the end. No submission withdrawal is needed.

# Shopify review readiness — 2026-10-09

Status: submitted at owner request on 2026-10-09. Shopify shows “Submitted —
We’re assigning a reviewer to your submission” and receipt success. Known gaps
below remain unresolved; submission does not mean compliance or approval. Canonical local-check requirements fetched with Shopify CLI on
2026-10-09; credential values are deliberately excluded.

## Final submission check

- Owner requested final review and submission after removing manual tracking.
  Shopify custom pixel “tagioo custom tracking” is retained but disconnected
  (Actions offers Connect); Tagioo app pixel remains installed.
- Fresh product page and cart test at 20:31 Dhaka produced only app pixel
  view_item/page_view/add_to_cart, each HTTP 200; no GTM stream for those actions.
- Refreshed Partner Dashboard showed Draft before submitting. Clicked Submit for
  review once; verified success receipt and Submitted / assigning reviewer.
- Latest panel syntax gate and all five Shopify app test files passed.
- No real customer billing or tracking changed. External subscription transition,
  delayed privacy deletion and remaining lifecycle/feature checks stay open.

## Verified live

- Reviewer logged out and signed back in successfully; account page confirms
  shopify-review@tagioo.com. Owner confirms the saved private Shopify password matches.
- Dedicated workspace is Pro / active / Shopify, no pending upgrade. Prepared
  container shopify-app-reviewer uses review-track.tagioo.com and G-4NHBWV9DKR.
- Shopify history records Starter replaced by Pro, with Pro currently active.
  Shopify app and panel agree on Pro entitlement and Nov 8 renewal.
- Old manual claim is rejected. New manual payment/add-on requests return 409.
- Owner accidentally submitted. Authorized withdrawal completed; status Draft.
  Corrected private account description and testing instructions saved; existing
  username and masked password retained. No new credentials disclosed in logs.
- Shopify preliminary checks report supported APIs, valid configuration, emergency
  contact, completed protected-customer-data request and passed common-error checks.
- Fresh product view, cart and checkout events reached Tagioo with HTTP 200.
  Two distinct clients send duplicate actions: the Tagioo app pixel and older GTM
  tracking. Both Tagioo and Stape Conversion Tracking app pixels are connected.
- Approved test gateway order 19105239826736 confirmed for $27.99 USD. Embedded
  app last backend order is Oct 9 at 20:16:43 Dhaka. Panel stores paid order and
  forward timestamp. Nginx confirms Tagioo browser and backend recovery requests
  both HTTP 200 with the same numeric transaction ID; older GTM also sends it.
  This proves endpoint receipt, not final GA4/Meta deduplication.
- Stape disable authorized for test store only. Inspected Stape app: GTM injection,
  ecommerce events, checkout error tracking, webhook delivery, customer sharing
  are all off; Customer Match has no destination configured. No uninstall or
  real-store changes performed. Stape pixel presence alone does not prove it is
  the second stream source. Correct earlier attribution; investigate older GTM.
- Reviewer Event Logs at 20:22 still showed latest event 19:55 and no today
  Purchase despite Nginx 20:16 success. Investigate event ingestion/display lag.
- All five Shopify app test files passed. Prior billing patch: 64 panel tests locally,
  22 focused production tests, syntax gates and HTTP smoke checks passed.

## Email requirements

| Requirement | State | Remaining work |
| --- | --- | --- |
| 1.2.1 Shopify billing | New external flows blocked; owner reports no Shopify clients | Existing customer subscriptions remain unchanged; Shopify usage was not established |
| 4.5.4 Test credentials | Reviewer login verified; existing private credentials confirmed by owner; instructions saved | Keep credentials current |
| Other requirements | Configuration checks pass; live functionality gaps remain | Complete gates below before submission |

## Broader code review

- Session-token authentication, embedded AppProvider/App Bridge and authenticated
  Admin GraphQL operations exist; no manual shop-domain install form was found.
- OAuth/authentication guard runs on embedded loaders/actions. Uninstall removes
  Shopify sessions and queues billing disconnection. Reinstall needs live proof.
- Only read_orders/read_pixels/write_pixels/read_customer_events requested. No
  read_all_orders, payment mandate, advanced DOM, checkout chat or checkout
  extension scopes. No theme downloads, marketplace, POS, loans, refund processing,
  optional checkout fees, shipping reordering or order-creation checkout bypass
  found in the Shopify integration.
- The app installs a strict web pixel with declared customer privacy requirements.
  Signed paid-order webhooks use authenticated webhook handling, encrypted retry
  payloads and signed panel delivery. Privacy endpoints validate signatures.
- Privacy gap: uninstall deletes storeConnection. Later customers/redact and
  shop/redact handlers call sendPrivacyEventToTagioo, which skips when there is no
  connected store record. This can leave panel order records after uninstall.
  Retain a protected, narrowly scoped privacy delivery mapping until redaction,
  with retries; test the uninstall → delayed shop/redact sequence before release.
  Do not change production privacy data during this audit.
- Plan feature claims need verification against delivered functionality: Shopify
  pricing mentions SLA/offline conversions; panel pricing mentions 300+ CDN
  locations and Delay Purchase System. A code search alone does not substantiate
  every claim. Revise unverified claims before submission.
- Reviewer Account Settings displays server.example.com and “Order webhook not
  connected,” while the embedded app shows review-track.tagioo.com and connected.
  This is inconsistent summary UI, not proof of webhook delivery failure.
- Local pixel has an existing uncommitted order-ID normalization change; it was
  preserved and not deployed. Browser/backend order ID agreement still needs proof.

## Live gates still open

- Identify and disable older GTM duplicate source on the development store,
  then repeat event test. Stape configuration switches are already off.
- Test order endpoint delivery and backend timestamp confirmed. Verify event-log
  freshness and one final conversion in GA4/Meta for its transaction ID.
- Test decline, downgrade to Free and reinstall/reconnect. Preserve final reviewer
  workspace readiness and don't change real merchants' subscriptions.
- Test embedded app with third-party cookies blocked/incognito.
- Verify actual privacy deletion through the uninstall/redact lifecycle on a
  disposable test store after implementing the mapping fix.
- Inspect supplied Shopify screening screencast and submission demo video.
- Merchant billing transition is not performed; customer notification drafts below
  are not sent. Do not resubmit or assert full compliance until resolved.

## Customer classification correction — no changes performed

Earlier notes inferred Shopify use from workspace flags on rahim-hossain-khan
and testing-properly. The owner confirmed real customers, then clarified that
there are no Shopify clients currently. Those records do not establish an
App Store billing violation. No cancellation, downgrade, migration or customer
communication was performed. Leave their subscriptions unchanged.
