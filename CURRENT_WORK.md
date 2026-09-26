# CURRENT_WORK — SGTM Control Panel (Tagioo)

Living status doc. Update after meaningful progress. Last updated: 2026-09-26.

## Current branch
`feat/saas-phase1-payments` (main branch is `main`).

## 2026-09-26 — Transactional email deliverability hardening

- Created and verified the dedicated Resend sending subdomain
  `mail.tagioo.com`. Cloudflare now serves its Resend DKIM record and both
  DNS-only return-path CNAMEs; public DNS resolution and Resend verification
  passed.
- Production now sends from `accounts@mail.tagioo.com` while replies continue
  to `support@tagioo.com`. PM2 was reloaded from the ecosystem file and saved;
  the app stayed online and both local and public HTTP checks returned 200.
  Rollback is limited to restoring `EMAIL_FROM=support@tagioo.com` (or removing
  the override to use the existing support fallback) and reloading PM2. The
  subdomain DNS records can remain without affecting the root-domain sender.
- Added a visible verification-page notice directing customers to check Spam
  or Junk and mark legitimate Tagioo messages as not spam/not junk, accurately
  describing this as improving future delivery rather than guaranteeing inbox
  placement.
- Decoupled the verified Resend sender (`notifications@tagioo.com`) from the
  customer support inbox and added an explicit Reply-To address for both Resend
  and the dormant Brevo fallback. Plain-text email alternatives now retain CTA
  destinations instead of dropping every link.
- Removed promotional and emoji-heavy wording from customer-facing subjects and
  softened the welcome message while keeping billing and account meaning intact.
- Rechecked public mail DNS: Resend DKIM and the aligned `send.tagioo.com`
  SPF/MX records exist. DMARC remains `p=none` with reports going to Brevo; do
  not tighten it until reports and all legitimate senders are audited.
- Made the PM2 ecosystem load `.env` on every process start, and documented the
  production verification checklist.
  Final inbox-placement diagnosis still requires a spammed Gmail **Show
  original** sample plus Resend bounce/complaint/suppression metrics; the young
  domain's reputation cannot be repaired solely in application code.

## 2026-09-26 — Clear owner container status

- Replaced the two unlabeled Docker state/health pills on owner container cards
  with one operational status: Healthy, Needs attention, Starting, Running, or
  Stopped. Stopped containers no longer display a stale pre-stop health result.
- Docker and per-customer unhealthy totals now count only running containers
  whose active health check is failing, so exited containers cannot create a
  false infrastructure alert.

## 2026-09-26 — Consistent owner plan grants

- Owner dashboard plan changes now update the complete billing lifecycle
  atomically. A paid plan becomes active/paid immediately with a 30-day renewal,
  clears stale Free/pending markers, resumes and resizes the container, and does
  not fabricate a customer payment record. Free starts a fresh 15K/30-day cycle.
- Paddle/Shopify subscriptions reject manual owner plan changes, lifetime access
  retains its no-renewal semantics, and pending plan claims are cancelled when an
  owner grant supersedes them.
- Existing rows created by the old partial update (`paid plan + Free status + no
  renewal`) self-repair on the next enforcement cycle, including container resume.

## 2026-09-26 — Unpaid renewal fallback and durable suspension

- Manual paid subscriptions now move directly to a fresh Free 15K/30-day cycle
  when their paid-through date passes without a confirmed renewal. Existing
  `overdue` and `expired` tenants self-heal to Free on the next enforcement tick.
- Free-cycle baselines prevent paid traffic from earlier on the transition day
  consuming the new Free allowance. Owner and customer usage totals subtract the
  same baseline.
- Intentional container stops set Docker restart policy to `no`; starts and
  payment reactivations restore `unless-stopped`. The host watchdog now skips
  intentionally stopped containers, so it cannot resurrect Free-capped tenants.
- Docker failures leave a durable retry marker: failed stops are not recorded as
  capped, and failed payment/free-cycle resumes are retried by later sweeps.

## 2026-09-26 — Owner-managed lifetime access

- Added an owner-only lifetime auto-renew control for internal and partner
  accounts. It grants ongoing paid-plan access without creating a payment,
  renewal reminders, overdue transitions, or expiry; disabling it restores the
  account's prior billing state. Pending plan claims are cancelled when lifetime
  access is granted, and lifetime accounts are excluded from subscription/MRR
  totals. Externally billed Paddle/Shopify and Free accounts stay under their
  existing billing rules. Extra-container payments remain available; cancelled
  plan claims cannot later be confirmed. Restoring an expired account also
  restores its stopped-container state. A later Paddle or Shopify activation
  becomes authoritative and clears the owner-granted lifetime override.
- Fixed the owner customer payload so an overdue subscription no longer rewrites
  a stored `paid` payment status to the misleading label `expired`. Subscription
  health and payment state are now shown as separate facts.
- Customer details now show the account creation date, time using Tagioo, and
  last login when available. Customer billing also recognizes lifetime access.

## 2026-09-25 — Clearer owner customer workspace

- Reworked the owner Customers view into a clearer directory-and-detail
  workspace with labeled search and status filters, an automatic first
  selection, result counts, grouped account/billing/usage information, and a
  compact request-usage meter.
- Customer summary cards now reuse the owner dashboard's canonical subscription
  and MRR metrics, avoiding conflicting totals. Plan saving stays disabled until
  the selection changes, reports loading/error state, and the irreversible
  customer deletion action is isolated behind a danger-zone disclosure with
  tenant-ID confirmation.
- Removed an unrelated Shopify audit fragment from the owner plan-change helper;
  it referenced an undefined order after persisting the new plan, causing the UI
  to report a false failure and skip its resize/notification follow-through.
- Fixed the ineffective responsive rule that applied grid columns to a flex
  container. The directory and detail now stack cleanly with no horizontal
  overflow at 320, 375, 414, and 768 px. Local owner-session UI checks covered
  automatic selection, filtering, empty/reset state, plan dirty state, and
  browser console errors.

## 2026-09-25 — Faster owner dashboard payload and cold start

- Removed the all-tenant retained-event maps and duplicate raw daily event rows
  from the owner dashboard response. They were used only for server-side usage
  calculations but could add thousands of purchase/event records per tenant/day
  to every owner request, delaying stringify, compression, transfer, and browser
  parsing before any dashboard card could render.
- Owner cold builds are now in-flight deduplicated, the startup cache warm runs
  before the slower per-tenant persistence sweep, and the boot-time payments
  badge reuses the shared read cache instead of decrypting the database again.

## 2026-09-25 — Faster login-to-dashboard transition

- Removed the customer-login lock waterfall that made the redirect wait for a
  full `history.json` telemetry rewrite and then another full read. The normal
  customer path now decides whether the rare unpaid-signup release is needed
  from the authentication snapshot, skips the no-op release read, sends the
  redirect immediately, and no longer rewrites the full database just to stamp
  nonessential `lastLoginAt` telemetry.
- The panel shell now becomes usable immediately after the cheap session probe;
  dashboard data continues loading in place instead of keeping the whole UI
  behind the splash until a cold dashboard build finishes.
- Bumped the immutable `app.js` asset version. Syntax checks and a local owner
  login/session/dashboard smoke test passed (302/200/200; warm dashboard 11 ms).

## 2026-09-25 — Protected-data controls prepared

- Fixed the production customer-list outage after the encryption rollout. The
  encrypted JSON was correct, but three reads decoded binary AES-GCM ciphertext
  as UTF-8 before authentication. Those reads now pass `Buffer` values directly
  to `parseProtectedJson`. The authenticated production dashboard reports 37
  tenants, 36 customer accounts, and 38 owner customer rows; all 14 containers
  remained running and the public endpoint returned HTTP 200. A verified
  pre-fix recovery set is stored locally under
  `~/Documents/tagioo-vps-recovery-20260925/`.
- Production rollout completed. The first in-memory migration exhausted Node's
  heap before replacing any file; the panel was restored immediately and the
  converter was replaced with a bounded-memory streaming AES-GCM migration that
  verifies the decrypted SHA-256 checksum before each atomic rename.
- Production now runs panel commit `6f3343e`. The active `history.json`, four
  panel snapshots, the rollback copy, and two historical JSON backups all use
  `TAGIOO-PROTECTED-V2`; current and historical files are mode 0600. The panel
  stayed online after its scheduled persistence cycle and returned HTTP 200.
- The production audit log is mode 0600 and contains a pseudonymous control
  verification record. The staff-password startup gate is active.
- The Shopify app now runs image `tagioo-shopify-app:release-bee157b` with a
  server-generated encryption key. Its isolated canary and production endpoint
  returned HTTP 200. The prior image remains stopped as
  `tagioo-shopify-app-before-bee157b`; its online SQLite backup is under
  `/var/backups/tagioo-shopify-20260925-bee157b/` and contains no queued orders.
- The adopted operating policy and incident-response exercise record are in
  the sibling app's `docs/SECURITY_OPERATIONS.md` on `main`.

- Added versioned AES-256-GCM protection for `history.json` and panel-created
  backups. Reads remain compatible with legacy plaintext during the controlled
  migration; writes become encrypted once `TAGIOO_DATA_ENCRYPTION_KEY` is set.
- Added an idempotent migration command that authenticates every encrypted
  replacement before atomically renaming it, plus tests for round trips,
  tampering, incorrect keys, and legacy reads.
- Added a root-only JSONL audit trail for Shopify order storage, privacy
  disclosure/redaction, and owner backup actions. Tenant and record identifiers
  are pseudonymized so the audit file does not become another customer-data
  store.
- Added an optional production staff-password gate requiring a 12-character
  owner password and blocking common or username-derived values.
- The local staging launcher now generates a separate encryption key, enables
  the staff-password gate, keeps its own encrypted data directory, and continues
  to exclude production credentials and integrations. HTTP and encryption smoke
  checks passed.
- The sibling Shopify app commit `bee157b` encrypts queued order and uninstall
  payloads with AES-256-GCM while retaining read compatibility for legacy queue
  rows. Unit tests, lint, typecheck, and production build pass.
- These controls are deployed. Production keys were created privately on the
  VPS, protected files were migrated atomically, and the panel and Shopify app
  passed authenticated data, endpoint, and container health checks.

## 2026-09-25 — Shopify launch release prepared

- Follow-up verification completed on the connected reviewer workspace. Shopify
  order `#1007` (`19060219740464`) was paid for USD 27.99; Tagioo Event Logs
  showed one unique Purchase and Purchase Inspector showed `1 TRACKED`, `1 ORDER`,
  and `RE-SENT ×2`. Browser and backend copies shared the same order/event ID,
  proving live deduplication.
- Exercised Shopify Managed Pricing on the development store: Free → Starter →
  Free. Shopify explicitly marked the development-store approval as non-billed,
  and the embedded app now reports the Free plan without a refresh warning.
- Partner API responses sometimes exceeded the app's former 10-second timeout.
  Shopify app commit `eebc072` raises only that request timeout to 30 seconds;
  tests, lint, typecheck, build, CLI validation, isolated canary, and production
  HTTP checks passed. Production runs `tagioo-shopify-app:release-eebc072`; the
  stopped rollback container is `tagioo-shopify-app-before-eebc072`, the stopped
  canary is `tagioo-shopify-app-canary-eebc072`, and the SQLite backup is under
  `/var/backups/tagioo-shopify-20260925-eebc072/`.
- The current Partner Dashboard has every preliminary step complete. A fresh
  fetch of Shopify's canonical review requirements found
  no clear local-code violation; configuration, unit tests, lint, typecheck, and
  production build pass. Live decline/reinstall behavior remains a reviewer-time
  check rather than local proof.
- Follow-up: the AI self-review is now marked complete and Shopify shows **Ready
  to submit**. The temporary public diagnostic file was deleted from the active
  Shopify container and `https://connect.tagioo.com/diag-925b7.json` returns 404.
  Final submission was not sent because the review page still says the app does
  not need protected customer data while the protected-data request remains an
  unapproved draft and the production integration processes customer fields.
- Protected-customer-data access remains a **New Draft** and is the launch
  blocker. Name, email, phone, address, and general protected data are selected
  for app functionality, analytics, and advertising, but the saved questionnaire
  truthfully answers No for encryption at rest, encrypted backups, test/production
  separation, DLP, strong staff password requirements, personal-data access
  logging, and an adopted incident-response policy. The App Store review page
  therefore still says the app does not need protected data until that draft can
  be submitted and approved.

- Re-ran the current Shopify App Store AI self-review requirements against the
  sibling app. No clear local-code violation was found; managed-billing decline
  and reinstall behavior still require live development-store verification.
- Committed and pushed Shopify app commit `346ac0c` to `main`. It preserves the
  deployed Shopify-owned login flow and limits queued paid-order payloads to the
  fields used by purchase delivery and customer redaction.
- Shopify unit tests, lint, typecheck, production build, and CLI configuration
  validation pass under Node 22.
- Deployed the Shopify app release `346ac0c` as image
  `tagioo-shopify-app:release-346ac0c` after an isolated canary against an
  online SQLite backup. The previous app container is retained, stopped, as
  `tagioo-shopify-app-before-346ac0c`; the backup is under
  `/var/backups/tagioo-shopify-20260925-042930` and passed `PRAGMA quick_check`.
- Enabled Shopify managed-billing reconciliation in the app container with a
  root-owned runtime environment. The public app, login route, Tagioo site, and
  Partner API query all returned successfully after rollout. No Nginx, sGTM,
  event-ingest worker, or live tracking container was changed.
- The development store is currently disconnected from Tagioo, so Free → paid
  → cancellation and reinstall still need a fresh reviewer-workspace connection
  before those live test flows can be completed.
- Protected-customer-data access is still the main submission blocker. Level 2
  access remains necessary for name/email/phone/address ad matching, and the
  unverified security controls in `docs/SECURITY_OPERATIONS_DRAFT.md` must not be
  represented to Shopify as implemented.

## 2026-09-17 — Shopify launch security and billing audit

- Rechecked the live Partner Dashboard. The listing, emergency contact,
  automated checks, and embedded-app checks are complete. The submission is
  still Draft, with AI self-review open. Its green “doesn't need access to
  protected customer data” row conflicts with the paid-order/customer fields
  processed by the app. Protected-data access remains a draft and not approved;
  the saved questionnaire answers No for encryption at rest/backups, separate
  test data, DLP, staff password rules, access logs, and incident response.
- Verified that the existing Partner API client has Manage apps permission and
  an access token. With the owner's explicit approval, copied that token to a
  root-owned 0600 file at `/etc/tagioo-shopify-app/partner-api.env` on the
  production VPS. A read-only Partner API query from that VPS returned HTTP
  200 with no GraphQL errors. The running Shopify container still has no
  Partner API environment variables and billing remains disabled. A later
  read-only SQLite check found no current store connections; the development
  store's embedded app also displays its disconnected state.
- The VPS guest root filesystem is ext4 without guest-side disk encryption;
  the Shopify SQLite file and local backup have root-only 0600 permissions.
  Hostinger VPS backup encryption has not been established. `auditd` is
  inactive. These observations do not justify changing questionnaire answers.
- Locally narrowed the Shopify app's queued paid-order payload to fields used
  by its existing delivery and redaction flows, and added a focused test.
  Lint, typecheck, two unit tests, and production build pass. This code has not
  been deployed; live tracking remains unchanged.
- Added `docs/SECURITY_OPERATIONS_DRAFT.md` in the Shopify app as a proposed
  control inventory and incident procedure. It is not an adopted policy or
  proof that the controls run.
- Added an on-demand, localhost-only panel staging launcher with separate
  SQLite data and credentials. Verified HTTP 200 on its home route and 401 for
  an unauthenticated session, then stopped it. This does not establish a
  separate production-like Shopify staging environment or justify a Yes answer
  to the questionnaire's test/production separation item.

## 2026-09-17 — Shopify login route production rollout

- Removed the standalone shop-domain login form from the sibling Shopify app.
  Merchants are directed to install or open the app from Shopify Admin. Local
  lint, typecheck, tests, build, and Shopify CLI config validation passed with
  Node 22.
- Built and deployed only the Shopify app image
  `tagioo-shopify-app:login-fix-20260917`. The original `ddec00b` container is
  retained, stopped, as `tagioo-shopify-app-before-loginfix-20260917`; the
  previous route and a SQLite online backup are under `/var/backups/`.
- The first replacement was bound to the wrong host port, temporarily returning
  502 from `connect.tagioo.com`. Recreated it on the original localhost port
  3200; the app and `tagioo.com` both returned HTTP 200 afterward. The live
  `/auth/login` page no longer contains the manual shop-domain field. No
  sGTM container, tracking route, or Nginx configuration was changed.
- The running Shopify container still lacks production managed-billing Partner
  API variables. Billing was not enabled. Protected-customer-data approval and
  production billing flows remain launch blockers.

## 2026-09-14 — Preserve customer login during container launch

- Fixed a lost-update race between verified customer signup/account creation and
  automatic container provisioning. Both operations read and rewrite the JSON
  database; a slow Docker/Nginx/SSL launch could finish with an older snapshot
  and remove the newly created `customerAccounts` row while leaving its signed
  customer session and tenant/container active.
- Customer-account creation and customer container creation now share the
  existing database mutation lock. A concurrent signup waits for provisioning
  (or vice versa), then reads the latest state before writing.
- The affected `shopify-app-reviewer` tenant/container remains live, but its
  missing login row must be restored once through the owner dashboard using the
  same tenant ID and reviewer email.
- Removed a broken startup migration call that materialized the entire 1.8 GB
  event store before failing on an initialization-order error. This caused the
  panel process to approach or exceed Node's heap limit after every restart.
  The migration had never completed, so removing the automatic call preserves
  existing analytics behavior while keeping login and dashboard service stable.

## 2026-09-13 — Shopify public-review verification

- The running Shopify Docker image is `ddec00b`. The embedded development-store
  app is connected, and Shopify's emergency contact and automated App Store
  checks are complete.
- Placed a simulated Test Payment Gateway order `#1003` in `tagioo-test-store`.
  Shopify marked it paid. The app recorded the backend order, and Tagioo's event
  store received the browser and backend Purchase requests for order
  `19038871355696`; both use the same transaction ID. After reloading Event
  Logs, the unique Purchase count increased from 3 to 4. Earlier Shopify
  `orders/paid` retries on September 12 timed out; the later deliveries worked.
- Production Shopify billing is still disabled in the running container. Its
  `SHOPIFY_PARTNER_ORG_ID`, `SHOPIFY_PARTNER_APP_ID`, and
  `SHOPIFY_PARTNER_API_ACCESS_TOKEN` are absent there (values were not read).
  Creating a Partner API client in Shopify does not configure the VPS.
- The live App Store review page is Draft: English listing shows Create,
  protected-customer-data details show 0/16 questions completed, and capability
  selection/self-review remain open. The app settings page still offers Upload
  icon. The Partner payout settings have no payout method. Do not infer these
  states from the prepared listing copy or icon files in the sibling repo.
- The sibling app stores queued order payloads and tokens in SQLite; panel
  backups include plain JSON. Encryption at rest/backups, access auditing,
  production/test separation, DLP, and incident response need operational
  evidence or implementation before answering Shopify's questionnaire Yes.

## 2026-09-13 — Shopify App Pricing integration

- Prepared the public legal pages for a global Shopify launch: billing language now distinguishes Shopify App Pricing, Paddle, and local payments; the privacy policy now describes Shopify order/customer fields, compliance webhooks, selected analytics destinations, subprocessors, retention, and international processing. These are operational drafts and still require legal review before public submission.
- Deployed isolated Tagioo commit `35846f2` and Shopify app image `b4b31cf`
  on the VPS. Before rollout, saved `history.json` and online SQLite backups
  of Tagioo events and Shopify app data in
  `/var/backups/tagioo-release-a7AbCD`; both copied databases passed
  `PRAGMA quick_check`. The two additive Shopify Prisma migrations applied
  successfully. The previous Shopify container/image is retained, stopped,
  as `tagioo-shopify-app-prev` for rollback. After startup, both public HTTPS
  sites returned 200; the unauthenticated privacy endpoint returned 401.
  Shopify billing remains disabled or unset in the production env.
- Published the four Shopify App Pricing plans with the handles expected by
  the integration: Free (`free`), Starter (`starter`, $30/month), Pro (`pro`,
  $50/month), and Enterprise (`enterprise`, $100/month). Development stores
  can test the paid plans without being charged.
- Added the signed Shopify subscription entitlement endpoint. Shopify-managed
  plans now map to Tagioo's public Free/Starter/Pro/Enterprise limits,
  preserve the 15,000-event rolling Free allowance, resume/resize a capped
  container only after a paid plan is confirmed, and return to Free after the
  last Shopify subscription is removed.
- Shopify-managed customers now change plans in Shopify Admin instead of the
  manual bKash/Nagad flow. Shopify remains the authority for renewals and
  cancellation, so those tenants are excluded from Tagioo's manual renewal
  sweep. Multiple connected Shopify stores retain the highest active plan.
- The sibling `tagioo-shopify-app` now queries Shopify's Partner API with a
  five-minute cache, stores subscription state in SQLite, periodically
  reconciles cancellation, and sends HMAC-signed entitlement updates to Tagioo.
  Disconnect/uninstall/shop-redaction revoke the linked entitlement.
- Billing is deliberately off by default (`SHOPIFY_BILLING_ENABLED=false`).
  Before enabling it, configure matching managed-pricing handles in Shopify,
  create a Partner API client with Manage apps permission, add its credentials
  only to the VPS environment, deploy both services, and test Free → paid →
  cancellation on the development store.
- Local checks passed: Tagioo syntax/browser checks plus 12 focused tests;
  Shopify Prisma migrations, lint, typecheck, production build, and CLI config
  validation.

## 2026-09-11 — Shopify app launch preparation

- Verified the embedded Shopify app in `tagioo-test-store`, including install,
  requested scopes, merchant connection UI, lint, typecheck, production build,
  and Shopify CLI configuration validation.
- Added a signed Shopify privacy endpoint. Customer data requests email the
  matching Tagioo merchant, customer redaction removes only matching Shopify
  orders, and shop redaction removes only that store/container's Shopify data
  and connection metadata. Focused isolation tests cover the deletion rules.
- Selected `connect.tagioo.com` as the production app host so the submitted app
  URL does not use Shopify's trademark. The live `shopify.tagioo.com` tracking
  hostname remains unchanged.
- Next: deploy the control-panel endpoint and Shopify Docker app, provision the
  production Shopify secret and persistent SQLite volume, add Nginx/TLS, deploy
  the Shopify app configuration, and run install/order/privacy smoke tests.

## 2026-09-09 — One-import TikTok setup

- Generated `server.json` now includes a Tagioo TikTok Events API custom
  template and a preconfigured all-events server tag. Customers no longer need
  to install or configure a Server GTM Community Gallery template manually.
- The included tag maps GA4 event names to TikTok standard events, sends shared
  browser/server event IDs for deduplication, and carries ecommerce, matching,
  click-ID, browser, and IP data already available to Server GTM.
- TikTok remains opt-in. Existing generated containers and customers who do not
  select TikTok are unchanged; customers selecting it only import `web.json`
  and `server.json` with Merge, preview, then publish.

## 2026-09-08 — Template generation preserves container IDs

- Fixed customer template generation rejecting every generated container ID as
  missing. Container request IDs contain underscores, but route parsing treated
  them as slugs and rewrote those underscores before the ownership lookup.
- Container IDs are now validated as opaque keys without mutation across the
  template, dashboard, webhook, Laravel, verification, and customer settings
  boundaries. Added a focused regression test for generated IDs.
- This changes control-panel identifier parsing only; GTM template contents and
  live tracking paths are unchanged.

## 2026-08-27 — Immediate visibility for newly created containers

- Structural container creation now clears the affected customer's dashboard
  cache and forces the owner container catalog to rebuild once. A successful
  second-container request therefore appears immediately instead of serving the
  previous one-container snapshot during stale-while-revalidate.
- Creating an additional container no longer overwrites the tenant row's legacy
  primary-container fields. Existing production container metadata and tracking
  credentials remain the primary account defaults; secondary container state
  stays in its own setup request and scoped tracking configuration.
- This change affects control-panel catalog/cache behavior only. It does not
  change live event ingest, Nginx, sGTM forwarding, or GTM template behavior.

## 2026-08-25 — Isolated containers inside one customer account

- Added an active-container selector for accounts with multiple containers.
  Dashboard events, purchase inspection, retained analytics, Setup Assistant,
  Power-Ups, offline conversions, and tracking verification now follow the
  selected container instead of mixing every store in the account.
- Preserved the original production container's existing account-level tracking
  configuration and webhook behavior. Additional containers now receive their
  own GA4 measurement ID, tracking domain, Meta credentials, Shopify connection
  code/integration token, Laravel Bridge state, and independent order IDs.
- WooCommerce webhook URLs now include their container. Newly downloaded cPanel
  Bridge packages include a container identifier when needed; already-installed
  production bridges and webhook URLs continue using their original paths.
- SQLite event history can now be read by a specific container access-log source
  while retaining shared-log compatibility. The container list also shows each
  store's own daily and billing-period request counts; subscription request
  totals remain account-wide across all owned containers.
- Added focused regression coverage for existing-production preservation,
  separate Shopify credentials, cross-account container rejection, retained
  secondary configuration, and isolated per-container event history.

## 2026-08-25 — Reliable WooCommerce browser Purchase + Meta initialization

- Fixed generated Meta browser ecommerce tags silently dropping early checkout
  or Purchase events when GTM processed them before its Pixel Base tag. Every
  generated Meta tag now safely bootstraps/initializes the shared pixel and
  marks its event as sent only after `fbq('track', ...)` accepts it.
- Bumped the WooCommerce plugin to 2.4.4. Browser Purchase no longer writes a
  permanent order-meta sent flag before the shopper's JavaScript executes;
  same-tab reloads are deduplicated with session storage after the dataLayer
  push, while Browser and Server keep the same raw WooCommerce order event ID.
- Added an order-received footer fallback for custom/block confirmation pages
  that omit the classic `woocommerce_thankyou` hook. The fallback requires the
  order's matching secret order key, and a per-request guard prevents the
  classic hook and fallback from emitting the event twice.
- Customers must update plugin 2.4.4 and regenerate/reimport/publish Web GTM.
  Existing Server GTM templates do not need replacement for this change. To
  see Browser and Server copies together in Meta Test Events, open the site
  through the Test Events URL flow and configure its test code in Server GTM.

## 2026-08-25 — Immediate WooCommerce AJAX AddToCart

- Fixed Tagioo WooCommerce `add_to_cart` waiting until the next page load when
  the cart action used WooCommerce AJAX. The PHP hook ran in the AJAX request,
  but the queued dataLayer push previously depended on a later `wp_footer`.
- Plugin 2.4.3 now listens for both classic WooCommerce `added_to_cart` and Woo
  Blocks `wc-blocks_added_to_cart`, then uses a nonce-protected same-origin
  callback to retrieve and clear the current shopper's server-built event.
- Normal redirect/form carts retain the existing next-page footer delivery as a
  fallback. Immediate and fallback delivery use the original event ID, with a
  browser-side guard against duplicate pushes.
- Newly generated WooCommerce Web GTM tags now use once-per-event firing rather
  than once-per-page-load, so multiple legitimate AJAX cart actions on the same
  product/listing page are not suppressed. Customers must update plugin 2.4.3
  and regenerate/reimport Web GTM for the complete fix.

## 2026-08-25 — Setup Assistant download step cleanup

- Removed the large Meta CAPI and TikTok field-mapping reference cards from the
  final Setup Assistant step. They were documentation-only and did not control
  template generation.
- Moved the Generate Templates action into the Download Templates card. The
  wizard footer now keeps only Back on the final step, and the card exposes a
  clear generating, ready-to-download, and regenerate flow.
- The Web and Server GTM generator payloads were not changed by this UI cleanup.

## 2026-08-24 — WooCommerce Meta event correctness

- Fixed generated Web GTM PageView IDs inheriting the latest ecommerce
  `event_id`. GTM lifecycle events now receive one stable per-URL PageView ID;
  ViewContent, AddToCart, InitiateCheckout, and Purchase retain their own IDs.
- WooCommerce templates now mark browser GA4 events and block only the
  browser-origin server CAPI Purchase. GA4 still receives the browser Purchase,
  the browser Meta Pixel still fires, and the plugin's authoritative scheduled
  recovery supplies the single matching CAPI Purchase.
- Bumped the WooCommerce plugin to 2.4.2. Its scheduled Purchase worker now uses
  an atomic, stale-safe lock so overlapping payment/status hooks cannot run two
  backend sends, and order events use the order's currency rather than the
  store's current display currency.
- Product pages intentionally emit both PageView and ViewContent; those describe
  different facts and should not be collapsed. Customers must update the plugin
  and reimport/publish both newly generated GTM JSON files for the fixes to take
  effect.

## 2026-08-24 — Shopify app integration foundation

- Created the standalone `tagioo-shopify-app` React Router project in a sibling
  Git repository. It is linked to the Shopify Partner app **Tagioo Tracking**;
  it does not add Shopify framework dependencies to this control panel.
- Added a Shopify Web Pixel extension for page, product, cart, checkout, and
  browser Purchase events. It sends GA4-compatible requests directly to the
  customer's existing first-party Tagioo sGTM domain.
- Added Shopify `orders/paid` backend recovery. Shopify authenticates the first
  webhook hop; the app then HMAC-signs the exact payload and timestamp with a
  unique tenant integration token before `/api/orders/shopify` accepts it.
- Added a 30-minute, one-time connection-code flow. Codes are stored hashed,
  consumed on redemption, and exchanged for a per-store 256-bit integration
  token. No global customer secret is exposed or reused across stores.
- Setup Assistant now shows the Shopify connection-code card after templates
  are generated. Shopify app-pixel users import `server.json` only and must not
  simultaneously publish the generated Web GTM browser tags, which would create
  duplicate browser events.
- Existing WooCommerce, Laravel, generic webhooks, GTM template generation,
  sGTM forwarding, and production tenant tracking behavior were not changed.
- Local checks passed: control-panel Node syntax, browser JS syntax, Shopify
  ESLint, React Router type generation, TypeScript, production build, and
  Shopify app configuration validation. A development-store install and paid
  order through a throwaway Tagioo tenant are still required before release.

## 2026-08-23 — Self-service cPanel Laravel Bridge

- Added `packages/tagioo-cpanel-bridge`, a self-contained PHP 8.1+ relay for
  shared cPanel hosting. It needs no Terminal, Composer, migration, Laravel code
  edit, or checkout hook: File Manager installs the ZIP and cPanel Cron runs it.
- The bridge boots the store's existing Laravel app and performs SELECT-only
  reads. It reports schema metadata (not order rows) to a new signed heartbeat
  endpoint, automatically detects common order/item layouts, and returns safe
  table/column dropdowns when the customer must map a custom layout.
- First run checkpoints and skips historical orders. `updated_at` is preferred
  so pending/COD orders can be seen after becoming paid. A non-overlap lock,
  atomic local outbox/checkpoint, exponential retry, HMAC request signing, and
  tenant+order idempotency cover Cron overlap, outages, and retry duplicates.
- Laravel now has its own tenant signing secret, separate from WooCommerce.
  Installing or rotating Laravel cannot invalidate a live Woo webhook. The
  Laravel secret was explicitly stripped from normal customer dashboard JSON
  after an isolated regression check caught the raw tenant field.
- Added a complete customer wizard: enter the store URL, download a private ZIP,
  install it with cPanel File Manager + Cron Jobs, check detection, optionally
  map detected fields, activate, run one test order, verify, or pause. No
  Tagioo-team installation step, hosting password, Terminal, VPS, Composer, or
  Laravel code edit is required.
- Activation is fail-closed until the signed bridge reports a ready schema.
  Pausing in Tagioo rejects bridge purchases immediately, unchanged heartbeats
  are write-throttled, mapping is locked while live, and the first active run
  skips historical orders.
- The whole download/UI remains gated by `CPANEL_BRIDGE_ENABLED=false` plus the
  explicit `CPANEL_BRIDGE_TENANTS` allowlist; existing production tracking,
  other platforms, GTM templates, Nginx, and container lifecycle are untouched
  until an operator enables one pilot tenant.
- Added `docs/cpanel-bridge-rollout.md` with the required throwaway-tenant,
  first-run, paid-order, dedup, retry, and COD-transition test sequence plus
  emergency-stop paths. Do not enable this in production until that sequence is
  completed against PHP/Laravel on a staging cPanel account.
- Local isolated checks passed against a throwaway data directory: Node syntax,
  ZIP integrity/config generation, signed incomplete → mapped → ready heartbeat,
  heartbeat write throttling, activation, valid/invalid HMAC, duplicate-order
  idempotency, test-order state, verification diagnostics, pause, paused-order
  rejection, and dashboard secret redaction. PHP is not installed on this Mac,
  so `php -l`, real Laravel boot/schema detection, cPanel Cron, and one staging
  order through GTM destinations remain mandatory pilot gates.
- Customer deployment order: import the generated `web.json` into Web GTM and
  `server.json` into Server GTM with Merge, keep both in Preview, install and
  activate the cPanel Bridge, complete one paid test order, verify all selected
  destinations, and only then publish both containers.
- Pilot fix: customer-safe Laravel state now includes the sanitized saved
  table/status mapping, and Advanced mapping restores those values after save,
  polling, or page reload. This lets COD stores persist custom Purchase statuses
  such as `pending` instead of the form reverting to its default list.
- Pilot acceptance-state fix: Laravel purchases and bridge heartbeats now share
  the database write lock. The live pilot proved orders reached
  `/api/orders/laravel` (`Purchase accepted`) while a concurrent heartbeat could
  overwrite the tenant's `lastOrder` verification marker. Verification also
  repairs earlier pilot state from the newest tenant-scoped accepted cPanel
  order, so customers are no longer asked to repeat a successfully received
  test solely because the marker was lost.
- Laravel coexistence/dedup hardening: the generated browser fallback now waits
  for and respects ecommerce events already emitted by a custom storefront,
  rather than adding a second `view_item`, `add_to_cart`, `begin_checkout`, or
  `purchase`. Generated Meta tags also suppress a repeated send for the same
  pixel/event/event-ID, and custom ecommerce pushes without their own ID use
  GTM's Unique Event ID so each real action remains distinct while its browser
  and server copies share one key. PageView retains one per-URL key because its
  Pixel Base and GA4 tags run during different GTM lifecycle events.
- The cPanel Bridge now prefers public invoice/order-number columns including
  `invoice_number`, `invoice_id`, and `order_code` before an internal database
  `id`. Existing installed bridges must either map the public invoice field in
  Advanced mapping or be replaced with a newly downloaded bridge for that
  detection improvement. This is required for browser/backend Purchase
  deduplication when a store exposes a customer invoice such as `69188` but its
  database row key is a different value such as `1282`.
- Setup Assistant destination selection now behaves as explicit opt-in. GA4 and
  Meta remain the visible initial defaults; Google Ads and TikTok are unchecked
  until the customer selects them. The backend no longer interprets a missing or
  empty destination array as all four platforms, and rejects generation when no
  destination is selected. Consequently, newly generated web/server JSON files
  contain destination tags only for the checked platforms.
- Laravel mapping is now reviewable whenever the bridge is connected but
  paused, including after a store previously reached Live. The Order ID dropdown
  preselects a recognized public order/invoice column ahead of an internal `id`,
  while still requiring the customer to save and reactivate before the bridge
  changes behavior. This makes the dedup correction discoverable without
  silently changing a live store or resending orders under a new identifier.
- Expanded the public `/docs` Laravel section and
  `docs/laravel-customer-setup.md` into a complete **Laravel Setup** guide. It
  now covers destination-aware GTM imports, cPanel ZIP/Cron installation,
  automatic detection, public invoice-ID mapping, COD statuses, activation,
  Tagioo/Meta test-order verification, browser/server deduplication, conflicting
  `fbq()`/`ttq()` senders, safe removal, security, and observed bridge errors.
- Reordered that guide to match the completed cPanel pilot: create the Bridge,
  upload/extract outside `public_html`, run a diagnostic Cron, check connection,
  complete Advanced mapping, activate, and only then generate/import the GTM
  files and test. Added eight lazy-loaded pilot screenshots with explanatory
  captions; excluded the exposed-secret config screenshot, customer order/phone
  data, and screenshots that showed the obsolete internal Order ID mapping.

## 2026-08-22 — Laravel Bridge foundation

- Added an in-repo `tagioo/laravel` Composer package foundation for Laravel
  10–12. `Tagioo::purchase($order)` writes to an isolated `tagioo_events`
  outbox, deduplicates by order ID, dispatches only after the HTTP response, and
  catches tracking failures so checkout cannot fail because of Tagioo.
- Pending events use Laravel queue retries with backoff and a scheduled
  `tagioo:flush` recovery command. `tagioo:doctor` checks configuration and the
  migration. The package is source-ready but must still be published to a
  dedicated Git repository/Packagist before customers can run the public
  `composer require tagioo/laravel` command.
- Added `POST /api/orders/laravel`, authenticated with a five-minute per-tenant
  HMAC timestamp/signature. Accepted purchases reuse the existing order
  deduplication and sGTM/Meta recovery path rather than adding another live
  tracking pipeline. Backend recovery now carries Laravel item rows plus the
  buyer's IP, user agent, `_fbp`, and `_fbc` when available; GA4 receives item
  parameters and Meta receives contents/content IDs for catalog matching.
- The customer Setup Assistant can prepare Bridge endpoint/tenant/secret values
  and download the package source. Laravel selector fields are now under an
  Advanced browser-fallback disclosure; Web GTM remains responsible for browser
  funnel activity while the Bridge is the authoritative Purchase source.
- Normalized leading `#` from browser-detected order IDs so `#OP-000023` and
  backend `OP-000023` deduplicate as the same purchase.
- Remaining before public release: publish the Composer package, pilot it on a
  staging copy of Masterpiece Gallery, map that store's order-completed hook,
  and verify outage/retry plus browser/server deduplication with a test order.
- Customer UX was simplified after review: ordinary Laravel customers now see
  only **Quick browser setup** and **Complete managed setup**. Composer commands,
  secrets, migrations, queues and CSS selectors are no longer exposed in the
  Setup Assistant. A managed request stores a tenant-scoped status and emails
  support; credentials are explicitly not collected in the form.
- Quick setup now detects common custom-Laravel product forms/cards contextually
  (product ID inputs, common price/name/quantity classes and Bengali cart or
  checkout labels), including Masterpiece Gallery's observed markup. It remains
  a browser funnel fallback; managed Bridge installation is required for the
  authoritative backend Purchase.
- Added a customer-facing Laravel guide at
  `docs/laravel-customer-setup.md` and a public **Laravel Stores** section on
  `/docs`. Both match the simplified managed flow and explicitly exclude code,
  Composer, selectors, secrets and credential submission from customer steps.

## 2026-08-21 — Laravel / custom ecommerce no-code GTM beta

- Setup Assistant now offers **Laravel / Custom Ecommerce** and collects optional
  product, checkout, success-page, add-to-cart, order-ID, and order-total rules.
- Laravel `web.json` exports include a conservative `Tagioo - Laravel Auto Tracker`
  Custom HTML tag. It reads Product/Order JSON-LD, uses optional URL/selector
  overrides, watches cart/checkout clicks, retains cart context in session storage,
  and pushes standard `view_item`, `add_to_cart`, `begin_checkout`, and `purchase`
  events into the existing GA4/Meta/TikTok pipeline.
- Purchase requires a real order ID and positive total, uses the order ID for both
  `event_id` and `transaction_id`, and is suppressed on confirmation-page reloads.
  This is browser detection, **not backend purchase recovery**; customers must run a
  test order before publishing. COD/payment-redirect recovery still needs a future
  per-tenant generic webhook or payment connector.
- Laravel web tags use GTM's once-per-event firing behavior so Livewire/Inertia and
  repeated cart actions are not collapsed into one hit per page. Other platforms
  retain their existing once-per-load behavior.
- Verification: `npm run check`, `node --check public/app.js`, generated tracker
  parse test, funnel smoke (`view_item → add_to_cart → begin_checkout`), and purchase
  smoke (selector extraction + reload dedup) all pass.

## 2026-08-12 — Meta ads underdelivery: funnel signal + signup survival
Ads weren't spending. Events Manager showed the cause: the ad set optimized
**CompleteRegistration, which had 2 lifetime events** — below the threshold where Meta can
build an estimated action rate at all, so it never bid. `Lead` had 430 events but was
**greyed out and unselectable** in the ad-set picker, badged "Conversions API", because it
was sent server-side only with no browser counterpart. Two more numbers from the same
screen: `PageView` 275 < `Lead` 430 (inverted — Lead fires on any `GET /signup`, so bots
and crawlers inflate it), and Lead 430 → CompleteRegistration 2 = a **0.47% signup
completion rate**. Landed:

- **Browser Lead counterpart.** `signupPage()` takes a third `{ leadEventId }` arg and
  seeds `dataLayer` with `{event:'tagioo_lead', tagioo_event_id}` *before* the GTM snippet.
  The id is the one the server already sends to CAPI, so a GTM Meta Pixel tag firing on
  `tagioo_lead` with that `eventID` dedupes to one Lead and flips the event's integration
  from "Conversions API" to "Multiple" — making it selectable as a conversion event.
  `leadEventId` is declared outside the `tg_lead_sent` guard and stays `""` on reloads, so
  the browser copy fires on exactly the requests the server copy does. **Still needs the
  GTM-side tag + `tagioo_event_id` dataLayer variable created in `GTM-MCR3FD4W`** — the
  server half alone does nothing.
- **GTM on `verifyPage` + `checkoutPage`.** Both rendered without the container, so the two
  highest-intent pages were invisible and their visitors unretargetable. Extracted
  `gtmHead(seed)` / `gtmNoscript()` helpers; `loginPage`/`signupPage` now use them too, so
  exactly one copy of the snippet remains in `server.js`.
- **`tg_vid` validated as 32-hex.** It's client-supplied and now reaches an inline
  `<script>` as well as Meta's hashed `external_id` and the GA4 client seed. Anything not
  matching the shape this server issues is discarded and a fresh id minted. `gtmHead` also
  escapes `<` in its seed as a second layer.
- **`pendingSignups` persisted to SQLite** (`pending_signups` table in `db.js`, accessed via
  a `pendingSignupStore` facade that falls back to the old in-memory Map if the native
  module didn't load). It was a process Map with a 15-minute TTL, so every deploy, `pm2
  restart` or watchdog bounce stranded in-flight signups on "Your verification session
  expired" — the prime suspect for the 430 → 2 collapse. TTL raised to 60 minutes
  (`SIGNUP_VERIFY_TTL_MS`), cookie `Max-Age` and the verification email copy both derive
  from it. Attempt counts are written back, so the 6-try brute-force ceiling survives a
  restart instead of resetting.
- **Password no longer held in plaintext while a code is pending.** The pending record is
  now on disk (and swept into `data/backups`), so `POST /signup` strips
  `password`/`confirmPassword` and stores `hashPassword(password)` instead.
  `validateCustomerAccountInput` accepts a `passwordHash` that matches the scrypt format
  and skips the length/match rules when one is supplied; `addCustomerAccount` prefers it
  over re-hashing. Owner-created accounts still take a plaintext password unchanged.

Verified end to end against a scratch copy of `data/`: signup → **server killed and
restarted** → the pre-restart code still verified → account created with a scrypt hash →
login with the original password succeeded. Also confirmed no duplicate browser Lead on
reload, no plaintext password anywhere in `events.db`, and expired/unknown tokens still
rejected with 400. Full plan and the Ads Manager playbook:
`~/.claude/plans/i-m-currently-running-ads-concurrent-chipmunk.md`.

- **Mid-funnel events added.** The funnel was `CompleteRegistration → …hours/days… → Purchase`,
  with Purchase only firing on manual owner confirmation — too sparse and too delayed for
  Meta to optimize on. `trackTagiooCheckoutStep()` now fires **InitiateCheckout** when a paid
  plan is staged (both the paid-signup path and a billing-UI upgrade; skipped for scheduled
  downgrades, which carry no invoice) and **AddPaymentInfo** when the buyer submits a
  bKash/Nagad transaction ID. Each sends a gtag forward plus a CAPI event sharing one
  `event_id` (`<step>_<invoiceNo>`, stable per invoice so repeats dedupe).
- **Purchase `event_time` backdated** to `payment.claimedAt` via `capiEventTime()`, which
  clamps to Meta's 7-day window and falls back to now for a missing/stale/future date. A
  slow confirm was stamping "now" and could push the conversion outside the click window,
  costing the ad its credit.
- **Missing-token warning.** `sendTagiooOwnMetaEvent` warned nothing when
  `TAGIOO_META_CAPI_TOKEN` was unset — it just dropped every event while GA4 kept looking
  healthy. Now warns once per process, naming the missing var and the `pm2 restart
  --update-env` fix. (`TAGIOO_META_PIXEL_ID` needs no env entry — it falls back to the
  hardcoded `1039411801891124`.)

Verified live end to end with a dummy CAPI token: one paid signup dispatched
`generate_lead → sign_up → InitiateCheckout → AddPaymentInfo`, each exactly once; the
missing-token warning fired exactly once when the token was absent; `/verify` and
`/checkout` both render the container (2 refs each).

Still open from that plan: the landing-page fabricated testimonial ("Rafiqul Islam", A/B/C/D
avatars, unverified +31%/+58%) and the WhatsApp CTA — both need owner-supplied real content.
**Also still required and not doable from this repo:** the GTM-side Meta Pixel `Lead` tag on
a `tagioo_lead` trigger reading a `tagioo_event_id` dataLayer variable. Until that exists in
`GTM-MCR3FD4W`, Lead stays CAPI-only and unselectable as an ad set conversion event.

## Recently completed
Recent commits (newest first, Jul 4–7):
- **Checkout wall is one-time, not a lockout** (working tree, Aug 9): someone who signed up on a paid plan and never paid was bounced to `/checkout` on *every* login, with no way into the product. `releaseUnpaidSignupToFree()` now drops the staged invoice and puts the tenant on Free (15k requests / 30-day cycle, `subscriptionStatus: "free"`) on the next login, and from a new "Not now — continue on the Free plan" button on the checkout page. The pay-first prompt still fires for the signup session itself. Untouched: a tenant with a submitted claim awaiting owner confirmation, and any live paid plan. Existing free cycle window is preserved so releasing can't mint a fresh allowance. Upgrading is a normal plan pick in Account & Billing. Also fixed a write race this exposed: `markCustomerAccountLogin()` (fire-and-forget during login) did an unlocked read-modify-write and could collide with the release write — same-millisecond `writeDatabase()` calls shared one temp path and renamed a **corrupted history.json** into place. Login telemetry now runs under `withDbLock`, and the temp filename carries a random suffix.
- **Meta event match quality — Tagioo's own funnel** (working tree, Aug 4): tagioo.com's own Lead/CompleteRegistration/Purchase were sent server-to-server with no visitor context, so Meta saw the VPS's own IP/UA on every event (Lead sat at 3.0/10, CompleteRegistration 4.2/10). Added `tagiooVisitorContext(req)` to snapshot the real visitor's IP / user-agent / `_fbp` / `_fbc` / `tg_vid`, `applyTagiooVisitorContext()` to merge it into each CAPI event (incl. `external_id` = sha256(`tg_vid`) and `event_source_url`), and header passthrough on `forwardTagiooOwnEvent` so GA4 stops geolocating every signup to the datacentre. New `sendTagiooLeadToMetaCapi` — Lead was gtag-only before. Purchase is confirmed in an owner session, so the buyer's snapshot is persisted at signup + payment-claim under `tenant.tracking.tagiooVisitor` and replayed (IP/UA dropped after 7d as stale). **Customer tenant tracking untouched** — no edits to the shared Meta template builder, `sendMetaOfflineConversions`, `sendOrderToMetaCapi`, nginx, or container lifecycle.
- **Facebook link-preview title** (working tree, Aug 2): updated the landing page Open Graph title to `ফেসবুকে সেল বাড়ান Tagioo দিয়ে`.
- **Purchase Inspector completeness** (working tree, Jul 28): retained a dedicated purchase-only event feed outside the general 500-event cap, so busy days show every tracked order represented by the aggregate purchase count; exact overlap between live and retained feeds is deduplicated.
- **Container creation video guide** (working tree, Jul 14): reused the lazy privacy-enhanced setup video inside the Create New Container walkthrough so customers can follow along while completing the form.
- **Customer setup video** (working tree, Jul 13): added a lazy-loaded privacy-enhanced YouTube walkthrough to the customer-only Setup Assistant and linked it from public documentation.
- **Paid-signup checkout guard** (working tree, Jul 11): app shell checkout gate now covers `/index.html` as well as `/`, so pending paid-plan signups cannot bypass the standalone payment step with a direct/static dashboard URL.
- **Billing/plan polish** (`f513de9`, `203a99e`): only upsell paid extra container after plan's included slots used; no empty payment-modal flash; downgrades scheduled at cycle end.
- **Customer billing views** (`4157e0f`, `eed282a`, `f4b241c`, `2f6c74a`): invoices section + premium polish; design tokens retuned to homepage; plan-limit alignment + extra-container add-on + homepage billing cycles; landing plan CTAs carry plan param to signup.
- **Dashboard KPI correctness** (`135ceda`, `13ce655`, `a4899ad`): today KPIs read SQLite event store (not lossy nginx tail); no stale/global events for containerless accounts; paid-customer summary + sort on owner Customers view.
- **Signup/checkout UI** (`41105c4`, `ec177f5`, `d124b52`, `bd6e787`, `3c3630e`): mandatory payment step after email verify for paid plans; responsive + centered forms; styled tel/number inputs + standalone buttons; email customer on admin plan change.
- **Owner dashboard perf** (`536aade`→`d9fa707`, 6 commits): cache payload stale-while-revalidate; drop per-tenant Nginx log scan; dedupe DB reads (db stage 3.5s → ~1 parse); move history persistence off read path; warm-on-start + serve-stale + non-blocking invalidate; widen DB read-cache TTL to 5s.
- **SaaS Phase 1 payments** (`0c97c3c`): payment paywall, one-click owner confirm, auto-refresh, upgrade nudge, customer admin.

## In progress
- SaaS payments phase 1 on this branch. Manual bKash/Nagad claim → owner-confirm lifecycle wired (emails + routes exist). Billing UI, invoices, plan limits, extra-container add-on, downgrade-at-cycle-end, and free-tier §3 enforcement alignment now landed. Still review paid renewal grace/expired suspension when touching billing next.

## 2026-08-05 — Transactional email: Brevo tried, reverted to Resend
`sendEmail()` is now provider-agnostic — all 14 `emailX()` wrappers funnel through it, so switching providers touches one function. **Resend is the sender.** Brevo (`POST https://api.brevo.com/v3/smtp/email`, `api-key` header, 201 on success) stays wired but is reached only when `RESEND_API_KEY` is empty, so setting `BREVO_API_KEY` alone cannot divert live mail. Kept from the Brevo work regardless of provider: a `textContent`/`text` plain-text part derived from the HTML (`htmlToPlainText`, Gmail/Yahoo bulk rules favour multipart), and failure logging that includes the response body — the provider's message distinguishes a bad key from an unverified sender domain, which a bare status code cannot.

**Root cause, confirmed:** tagioo.com is domain-authenticated with **Resend only**, and never was with Brevo. Verified at the authoritative Cloudflare nameservers:
- Resend: `resend._domainkey.tagioo.com` TXT carries a real DKIM public key; `send.tagioo.com` has SPF (`v=spf1 include:amazonses.com ~all`) and an MX to `feedback-smtp.ap-northeast-1.amazonses.com`.
- Brevo: only `brevo-code:…` at root plus the shared `_dmarc`. **No DKIM under any selector** (`mail`/`brevo`/`sib`/`s1`/`k1`/`default`._domainkey, TXT and CNAME).

`brevo-code` proves *ownership*, not sending authorisation. With no DKIM, Brevo never marked the domain authenticated and refused to send — so pointing `sendEmail` at Brevo killed all transactional mail, and reverting to Resend restored it. An earlier theory that `.env` was never loaded is **disproven**: Resend works, so env vars do reach the process. (Still true that nothing in-repo parses `.env` and the documented `pm2 start server.js` doesn't either — whatever loads it on the VPS is undocumented, and `pm2 restart --update-env` is still required for env changes to take.)

**Lesson for any future provider swap:** the sender is not the hard part; per-provider DKIM/SPF/MAIL FROM records are. Publish and verify DNS for the new provider *before* flipping `sendEmail`, and keep the old provider primary until the new domain shows authenticated in its dashboard.

**Side finding:** `feedback-smtp.ap-northeast-1.amazonses.com` shows Resend runs on Amazon SES, so Tagioo already sends via SES infrastructure. The SES production-access support case was pursuing capability we effectively had.

Alternatives also rejected: **Amazon SES** — sandbox only delivers to verified recipients, so signup codes never reach real customers; production access sat behind a support case AWS bounced back; needs hand-rolled SigV4. **Cloudflare Email Sending** — auto-creates DNS records (tagioo.com is on Cloudflare) but costs $5/mo Workers Paid for the same 3,000/mo Resend gives free, and is beta.

**Next debugging step:** confirm which of the two candidates it is *before* touching provider code again. `pm2 env tagioo | grep RESEND` answers #2 in one command.

## 2026-08-05 — Meta event deduplication fix (alurkohv / WooCommerce plugin)
Symptom: alurkohv (WordPress + Tagioo plugin) showed Purchase "deduplication has not been set up" and InitiateCheckout Event ID coverage 65.69%. amolbooks/shobaz unaffected because they run no plugin and push one event per page load.
Two independent root causes, both fixed:
1. **Purchase** — plugin used `event_id = 'tagioo-purchase-' . order_number`, while the panel's order-webhook recovery (`forwardOrderToSgtm` + `sendOrderToMetaCapi`) uses the raw Woo order id. Different keys → Meta counted each order twice. Plugin now sends `event_id = $order->get_id()` (`tagioo_purchase_event_id()`), matching the webhook's `id` field. Plugin bumped 2.4.0 → 2.4.1; **alurkohv must reinstall the plugin zip from the panel**.
2. **Upper funnel** — browser Meta/TikTok custom HTML tags scanned `window.dataLayer` backwards for *any* `event_id` at runtime, so on WooCommerce (queued `add_to_cart` flushes in `wp_footer` after `begin_checkout` renders in the body) the pixel attached the wrong event's id *and* the wrong `ecommerce` object, while the server GA4 tag sent the right one. Tags now read the new `{{Tagioo - event_id}}` variable (GTM snapshots it at the triggering message) and pick the `ecommerce` object of the push carrying that id. Same variable also gives plain PageViews a per-page-load id so browser PageView dedupes against the CAPI PageView.
Requires each affected tenant to re-import `web.json` and republish the **web** container. Server container untouched.

## Files recently changed / why
- `server.js` — payments, self-tracking, dashboard perf caching, provisioning, and Free-tier rolling-cycle enforcement. Main monolith; most churn here.
- `db.js` — SQLite event store schema/queries.
- `public/*` — landing/marketing redesign, Setup Assistant, billing UI.
- `docs/saas-plan.md` — monetization spec (DRAFT, 2026-06-27).
- Untracked at doc-writing time: `.claude/`, `PROJECT_CONTEXT.md`, `CURRENT_WORK.md`, `AGENTS.md`, `CLAUDE.md` (these onboarding docs).

## Known gaps / TODO (from docs/saas-plan.md)
- Rolling 30-day usage cycle (`cycleStart`/`cycleEnd`) — implemented for Free enforcement and Free billing-period display; new Free tenants and Free reselects initialize the cycle window.
- 12K nudge (once/cycle via `nudgedAt`) + 15K hard stop (`free_capped` → stop container) — aligned in `enforceFreeTierUsage(data)`, which runs from the persistence timer.
- Overdue → grace → expired suspension transitions.
- No automated tests anywhere.

## Commands run + results
- `node --check server.js` (`npm run check`) — syntax gate. Run this after every `server.js` edit.
- 2026-08-05: `npm run check` after the dedup fix — passed. Also ran a throwaway harness that extracted `PIXEL_CONTEXT_SCRIPT` + `metaPixelEventScript` + `tiktokPixelEventScript` from `server.js`, substituted the GTM variable, asserted the generated pixel JS parses for id/undefined values, and replayed the WooCommerce `begin_checkout`-then-`add_to_cart` dataLayer race: `eventID` and `value` now come from the triggering push (500, `tagioo-bc-x`) instead of the later one (99, `tagioo-atc-y`). No PHP binary on this Mac, so `tagioo-woocommerce.php` was not lint-checked.
- 2026-08-04: `npm run check` after the Meta match-quality work — passed. Also ran a throwaway harness that extracted the new pure helpers (`tagiooVisitorContext`, `applyTagiooVisitorContext`, `storedTagiooVisitor`, `tagiooNameParts`) straight out of `server.js` and asserted 22 cases — XFF first-hop parsing, `?fbclid=` → `_fbc` rebuild, query-string stripped from `event_source_url` (so `?email=` prefill never leaks), null-visitor no-op, and stale-snapshot IP/UA dropping. Worth turning into the `node:test` smoke suite mentioned below.
- 2026-07-28: `node --check public/app.js` and `npm run check` after fixing the Purchase Inspector feed — passed.
- 2026-07-14: `node --check public/app.js` and `npm run check` after adding the video to container creation — passed.
- 2026-07-13: `npm run check` after customer setup video UI — passed.
- 2026-07-11: `npm run check` after paid-signup checkout guard fix — passed.
- 2026-07-07: `npm run check` after each `server.js` edit for Free-tier enforcement alignment — passed.
- No test/lint/build commands exist to run.

## Next recommended tasks for Codex (safest first)
1. **Docs/onboarding only** (this task) — no code risk.
2. Verify saas-plan §3 enforcement in `server.js` (usage cap, nudge, cycle window) — read-first, small edits, run `npm run check`.
3. Add a minimal `node:test` smoke test for pure helpers (e.g. line aggregation, `crc32`/zip builder, plan resolution) — no framework, `node --test`.
Do NOT start with tracking/Nginx/container-lifecycle changes.

## Avoid / be careful
- **`server.js` is ~9.9k lines, no tests.** Keep edits surgical; run `npm run check`.
- **Do not touch live-tracking layers blind:** Nginx config, sGTM container lifecycle, `/g/collect` recovery — these move real customer conversions. Test off a throwaway tenant.
- **Don't regress dashboard perf:** no per-tenant log scans or extra `history.json` parses on the owner read path.
- **Bump `?v=` in `public/index.html`** when editing `app.js`/`styles.css`/`tokens.css` (immutable caching).
- Keep `history.json` writes atomic (temp + `rename`). Don't hand-edit `data/*.db` or `data/history.json` while server runs.
- Keep Asia/Dhaka offset-based date math.
- `.env` / secrets never committed.
