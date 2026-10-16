# CURRENT_WORK — SGTM Control Panel (Tagioo)

Living status doc. Update after meaningful progress. Last updated: 2026-10-10.

## 2026-10-11 — Production-style homepage copy review

- Reviewed live tagioo.com (different from the local redesign) and the owner's
  8.2-second animation reference. Added complete section audit/copy in
  `docs/marketing/tagioo-homepage-copy-review.md` and an isolated preview in
  `artifacts/homepage-copy-review/`. No public homepage files or deployment changed.
- Retains production typography/colors/components; reduces 14 section elements
  (including two strips) to eight. Leads with missing purchase signals, explains
  browser/backend paths, and consolidates core benefits, proof, setup and FAQs.
- Added original Tagioo event-flow animation with pause/play, reduced-motion,
  offscreen/tab visibility handling and a readable static phone layout. No copied
  reference artwork, accuracy guarantees or fabricated performance counters.
- 320/375/414/768px browser checks show no horizontal overflow or broken image;
  menu/Escape, FAQ and pause/resume checked. Script smoke checks and npm run check
  pass. Screenshots and README included. Next: owner reviews copy/preview; apply
  selected changes against the production baseline with geo/billing behavior intact.

## 2026-10-11 — International brand and launch plan

- Added `docs/marketing/tagioo-brand-and-launch-plan.md`: international-first
  positioning, WooCommerce/agency customer profiles, messaging, launch offer,
  outreach scripts, 90-day funnel, $1,000–$3,000 budgets and retention scorecard.
- Models 110 gross acquisitions for 100 active paying accounts; rates, revenue
  mix and costs are explicit assumptions. Current code pricing supersedes older
  conflicting USD-tier/container notes. Paddle production verification and Shopify
  approval remain launch dependencies; no live approval assumed.
- Next: verify international checkout and a supported test-store implementation,
  prepare demo/checklist, and validate demand with the first five paid customers.
  Planning only: no product changes, deployment, spending or outreach performed.

## 2026-10-11 — Compact, complete Purchase Inspector

- Replaced tall purchase cards with compact rows: date, value, transaction ID,
  client, domain, HTTP status, send count and expandable full request metadata.
  Removed the frontend's 12-purchase cap; every matching loaded purchase renders.
- Removed amount/minute-based grouping and metadata-based suppression, which could
  hide separate same-value orders or purchases without IDs. Identified duplicate
  transactions still collapse with re-send counts; search and Dhaka ranges remain.
- App v107 / styles v67. Eleven focused tests and both syntax checks pass, including
  100 identified purchases, 100 same-value unidentified purchases, a metadata-less
  purchase, duplicate sends, date ranges and search. No tracking/backend changes.
- Feed retains its existing 2,000 purchase-request ceiling; 100 tracked purchases
  render in full when present in that feed. Larger feeds need backend pagination.
  Local only; not pushed/deployed. Live visual verification remains.

## 2026-10-11 — Full-width customer graphs

- Removed the customer SVG height cap that letterboxed Event activity and Events
  per Day inside wide panels. Both now scale proportionally to available panel
  width; min-height no longer forces centered whitespace on phones. Styles v66.
- CSS-only change preserves graph data, labels, ranges, hover targets and aspect
  ratio. Backend syntax and diff checks pass. Synthetic browser measurements at
  320/375/414/768/1600px confirm full chart width and preserved proportions without
  page overflow. Not pushed or deployed. Preview: artifacts/chart-width/.

## 2026-10-10 — Shopify-style incoming requests

- Restyled Incoming Requests using the supplied Shopify Orders reference: compact
  rows, single-line Dhaka dates including seconds, fixed column widths, truncated
  URLs, gray success/unknown pills, yellow redirects and restrained red errors.
- Details retains metadata and now explicitly shows the full escaped request URL.
  Customer background/surface/line/text tokens match the reference's neutral grays.
  Existing filtering, row limits, data feeds and tracking backend preserved.
- App v106 / styles v65. Backend/frontend syntax and diff checks pass; 11 focused
  tests pass (date/status/escaping/details plus support/customer regressions).
  Synthetic browser preview verified at 320/375/414/768px with no page overflow;
  table scroll stays local, Details expands correctly. Screenshot and standalone
  preview: artifacts/request-table/. Changes local, not pushed or deployed.
- Remote fetched before editing; VPS merge 31df344 is not yet on the shared branch.
  Synchronize production history before pushing this follow-up.

## Deployment workflow — VPS has separate commits

- /var/www/tagioo has production commits that diverge from the local branch.
  Plain git pull fails; a blanket merge can conflict and can silently duplicate
  declarations in app.js. Inspect both histories and staged/working diffs first.
- Resolve individual conflict hunks, preserving production fixes. Run backend AND
  frontend syntax checks plus focused tests before restart. Chain rollout gates
  with &&. Never stage .env files or .env backups (including .env.before-password-reset).
- After reviewing a completed VPS merge, synchronize its merge commit to the shared
  branch and fetch locally before the next delivery; otherwise divergence recurs.

## 2026-10-10 — Neutral customer dashboard

- Removed the colorful emphasis layer at the owner's request: tinted metric cards,
  category colors, decorative borders, purple account header and bright billing hero.
  Customer actions, selection accents and informational surfaces now use gray;
  status/error feedback keeps its semantic colors. Support features preserved.
- Styles v64. Syntax and diff checks passed; refreshed the local customer preview.

## 2026-10-10 — Support tickets and customer notifications

- Added Support tickets to both dashboards: customers create tickets and continue
  conversations; owners see every ticket, reply, and close/reopen tickets. Tenant
  filtering and owner-only actions are enforced by the API, not just the UI.
- Added Notifications: owners publish announcements to all customers; customer
  feeds include announcements and owner replies with persistent account read state.
  Navigation badges poll every 30 seconds independently of tracking dashboard loads.
  Reply drafts survive refreshes; all submitted content is rendered as escaped text.
- Reuses history.json with locked, atomic writes and cached reads. No tracking,
  billing, infrastructure or dependency changes. Assets: app v105 / styles v63.
- npm run check, frontend syntax, diff check and 12 focused native tests passed,
  including real-route authentication/isolation/locked-write checks and notification
  concurrency/read-state cases. Not deployed; live browser verification remains.

## 2026-10-10 — Stronger customer dashboard color

- Owner requested more visual emphasis. Added distinct tinted metric cards,
  accent borders, category-colored tool icons/headings, event-colored distribution
  bars and totals, stronger navigation selection and indigo primary actions.
- Containers/DNS, setup, billing and account cards now use the same purposeful
  indigo/blue/green/amber/violet palette. Status labels remain explicit, and
  unavailable tools retain muted styling. Customer-only CSS preserves owner UI.
- Styles v62 / app v104. No backend changes. Eighteen focused tests and syntax
  checks pass; mocked all-tab browser checks pass at 320/375/414/768 and desktop,
  including reduced motion, save errors, search and owner isolation.
- Synthetic previews: artifacts/customer-emphasis/. Live appearance awaits rollout.

## 2026-10-10 — Customer tab content refinement

- Refined Home, event logs, containers, tracking tools, setup, settings and billing
  inside the existing customer workspace. Shared compact cards, centered content,
  readable typography, concise introductions and purposeful semantic colors.
- Containers use paired configuration/DNS cards, a smaller setup prompt and a
  separate destructive action. Removed repeated name/type rows, inert Settings
  shortcut and misleading pagination/Last Sync copy. Usage now consistently shows
  account-wide billing totals, covered by a native regression test.
- Home/log metrics use distinct cards; filters, tool categories, setup step numbers,
  current-plan comparisons and account overview are easier to scan. Profile/password
  feedback exposes success/error states with semantic color. Assets: styles v61,
  app v103. Backend and loading recovery preserved.
- Syntax checks, 18 focused native tests and mocked browser checks passed. All seven
  customer tabs checked for overflow at 320/375/414/768px plus desktop, with navigation,
  search, profile-save recovery, reduced motion and owner isolation verified.
- Synthetic screenshots: artifacts/customer-content/. Production visual verification
  remains after applying this UI-only commit; no PM2 reload needed.

## 2026-10-10 — Customer dashboard loading recovery

- Customer reports 10–30 seconds on Home. Avoid duplicate tenant/container builds
  on concurrent cold requests; customer read-only builds share the existing DB
  read cache instead of reparsing history.json for each request.
- Extend customer stale-while-revalidate window from two minutes to one hour.
  Returning customers see timestamped cached data while rebuilding; app v102
  checks again after ten seconds (up to three times) to paint fresh results.
- Bound requests to 45 seconds; timeout/error restores Refresh and shows a retry
  message. Mutation invalidation prevents obsolete builds repopulating the cache.
- Focused cache/isolation/invalidation/retry tests, owner usage cache test and
  syntax checks pass. Production cold-load timing still requires verification
  after deployment; a first uncached build can still take longer than cache hits.

## 2026-10-10 — Customer dashboard Shopify-style experience

- Owner requested full customer experience: navigation, overview, tables and
  settings. Added customer-only dark sidebar, persistent container picker,
  Home/Tracking tools/Setup guide/Settings/Billing labels and Cmd/Ctrl+K page
  search. Search uses visible permitted navigation, with arrow/Enter/Escape
  handling, empty results and native dialog focus management.
- Added compact neutral cards, metric strip, calmer table selection, mobile
  navigation and two-column phone metrics. Owner frame and backend stay intact.
- Profile/password submissions disable while saving and recover on failure;
  live status messages and active-page aria-current improve accessible feedback.
- Follow-up polish: Inter UI typography with tabular metrics, consistent SVG line
  icons, short page/search/mobile-menu transitions, hover/press feedback and
  in-flight refresh motion. Reduced-motion browser assertions pass.
- Assets bumped to styles v60 and app v101. Existing marketing work preserved.
- npm run check, app syntax, diff check and 11 focused native tests passed.
  Mocked customer browser checks passed across Home, logs, containers, tools,
  setup, settings and billing; no overflow at tested phone/tablet/desktop widths.
  Search keyboard/empty results, mobile menu, container picker, profile save/error
  recovery and owner-session isolation passed without browser exceptions.
- Customer UI prepared for Git push on feat/saas-phase1-payments. Browser checks
  use synthetic accounts/API responses; live customer verification and deployment
  remain next. Previews: artifacts/customer-workspace/.

## 2026-10-10 — Homepage redesign canceled

- Owner chose the existing homepage. Restored the exact pre-redesign homepage
  snapshot and removed only the homepage CSS/JS added in this chat. Earlier
  marketing edits and other in-progress work are preserved. No deployment made.

## 2026-10-10 — Remaining Shopify tasks

- Owner authorized free Pro after reinstall; approved and verified Shopify pricing
  now marks Pro Current, with no subscription-expiry warning. Embedded app connected
  correctly in Incognito with blocked third-party cookies.
- Backup privacy fix local baa8fb6/896c4d6/d9ec2e7 deployed as
  75cb34c/c29aa42/d3310eb. Matching Shopify orders are scrubbed from encrypted
  panel snapshots before redaction is acknowledged; failures cause webhook retry.
  New/imported backups omit raw Shopify event history. Backup creation is serialized
  with redaction to prevent a concurrent snapshot resurrecting deleted orders.
- Confirmed Shopify connections/archive routes/redaction records get 29-day date
  cutoff in the raw event store (Dhaka offset), preserving unrelated tenants and
  exact shared host matches. Existing Nginx logrotate is daily, 14 archives.
  Production focused tests and PM2 reload passed. Local actual two-service HTTP
  privacy verifier passed again. Existing snapshot scrub completed.
- Pricing wording edits still locked while Submitted. Asked owner whether to
  withdraw, replace Brave bypass/SLA promises, and resubmit, or preserve queue.
  Existing four snapshot scrub applied (zero erased-shop orders found). Daily
  rollout copy expiry older than 14 days installed and run-parts discovery checked.
  Local 76b7c43 deployed as 69c2ff9 erases deleted-shop backup connection/routing
  secrets. Three production backup tests passed; PM2 reload and final four-snapshot
  scrub succeeded. Both public endpoints returned HTTP 200. Owner chose Keep
  current review queue: pricing wording changes explicitly deferred.

## 2026-10-10 — Shopify review follow-up verification

- Deployed dedicated Event Logs isolation/filter fix and selected-container Account
  summary (local 38bcec5, production e35ed7a, asset v98). Live reviewer UI now
  shows previously hidden Shopify PageView/ViewItem/AddToCart/Purchase requests;
  Account correctly shows review-track.tagioo.com instead of global config domain.
  Four focused production tests and syntax checks pass; owner cache path preserved.
- Removed unsupported panel “300+ CDN Locations” claim; renamed Delay Purchase
  System to implemented server-side purchase recovery. Managed Pricing support/SLA
  and Brave claims still need review/edit; user marketing edits were preserved.
- Live cancel kept Pro; authorized Starter downgrade synced to embedded app and
  Shopify pricing. Authorized free Pro restoration confirmed in Incognito.
- Found real Shopify automated-review victim-shop cleanup deliveries HTTP 500.
  Victim sessions have expired access tokens and refresh tokens; Shopify library
  tries to refresh these before cleanup and throws 500 after revocation. Cleanup
  routes now verify raw-body HMAC without loading/refreshing sessions. Invalid HMAC
  401 and malformed topic/domain 400; normal admin authentication remains unchanged.
- App local 8523b43/a8ba517, production 0e4725a/b485735, image
  tagioo-shopify-app:cleanup-a8ba517 started with unchanged env/mounts/port.
  Previous stopped container and SQLite backup retained. Local 10 tests, lint,
  typecheck and build pass. Production checks passed.
- Approval return initially rendered the previous plan until reload. Local
  39314c0 / production 2bd935e awaits billing synchronization only on plan_handle
  returns. Image tagioo-shopify-app:review-39314c0 deployed; 11 production tests
  passed and public app HTTP 200. Previous stopped image retained for rollback.
- Panel feature wording/access local 9d815f0 / production 5a202c4, asset v99:
  Custom Loader available on Free; removed browser-bypass/cookie guarantees.
- New disposable two-service signed HTTP verifier covers expired/revoked session,
  uninstall, encrypted retained route, post-uninstall customer/shop deletion,
  tenant isolation and repeated delivery. Passed against actual compiled routes
  and panel HTTP. Script: scripts/verify-shopify-privacy-e2e.mjs. This is a signed
  replay, not proof of Shopify’s actual delayed 48-hour delivery.
- Incognito with blocked third-party cookies passed initial app loading and fresh
  install/reconnection. Owner-authorized test-store uninstall returned HTTP 200
  in 28 ms; fresh app asks for a new connection code and successfully installs
  pixel/order webhook. Pro reapproval after reinstall is awaiting owner Terms
  confirmation. Shopify pricing confirms expiry November 8, 2026.
- Real Shopify shop/redact retry now passed: webhook
  36c5c39c-a801-5b52-912a-0bfc24119f67, delivery attempt 9,
  2026-10-09T19:14:58Z (Oct 10 01:14 Dhaka), HTTP 200 confirmed in
  Shopify Dev Dashboard and production logs. Read-only Prisma counts: victim
  connections/sessions/order deliveries all zero; reviewer connections one.
  Broader log/event-store/backup PII erasure is still unverified.
  Submitted listing editor is locked; Brave bypass/SLA pricing claims remain.
  Existing submission
  and real customer subscriptions are preserved; do not claim approval guaranteed.

## 2026-10-09 — Amolbooks traffic concern

- Owner reported no amolbooks.com traffic after privacy deployment. Read-only
  checks: public website and first-party GTM loader HTTP 200. Refreshed GA4
  Amolbooks V2 Realtime increased from 34 to 38 active users / 30 minutes,
  1 to 4 users / 5 minutes and 47 to 49 page_view events. Tracking is receiving
  fresh traffic; no complete outage established. No tracking changes made.
- Server log/status command attempted in Chrome, but user switched windows;
  execution/output not verified. Do not claim a full server or Meta audit.

## 2026-10-09 — Shopify review billing and privacy remediation

- App submitted at owner's request; receipt success and Submitted / assigning
  reviewer verified. Reviewer login and private Partner credentials/instructions
  verified. Custom pixel disconnected; fresh app product/cart requests HTTP 200.
- Owner clarifies there are no Shopify clients currently. Earlier workspace flags
  were insufficient evidence that two real customers use Shopify. Leave all their
  billing records/subscriptions unchanged; migration is not an established blocker.
- External billing prevention remains deployed (local 351ea08 / production 37520e6).
- Fixed delayed privacy routing after uninstall/disconnect/reconnect: encrypted
  minimal routes in Shopify app, privacy-only archived panel authentication,
  store-scoped order deletion and safe repeated shop/redact handling. Active
  tracking/billing cannot authenticate using an archived route. Other shops intact.
- Panel fix afbfeda deployed as ce8f8c1; five focused production tests passed and
  PM2 reload succeeded. Shopify fix ec7787f deployed as 36b1bc9, image
  tagioo-shopify-app:privacy-ec7787f running; eight production app tests passed; panel public login HTTP 200. Private runtime/SQLite
  backups and previous stopped container retained for rollback.
- Local checks: 42 panel tests, six Shopify app test files, syntax, lint, typecheck
  and build pass. Existing marketing changes and local pixel edit preserved.
- Still unverified: real delayed Shopify uninstall webhook end-to-end, broader
  event/log/backups privacy retention, downstream conversion deduplication,
  stale Event Logs, inconsistent Account Settings summary, decline/downgrade/
  reinstall, blocked-cookie behavior and full feature claims. Submission is not
  approval; do not withdraw or resubmit automatically.

## 2026-10-09 — Screenshot-guided marketing revision

- Owner rejected the first warm-white/purple editorial direction. Reworked from
  the supplied full-page TrackingConsulting screenshot: centered bold/italic
  hero, compact split copy/technical diagram, green/lime actions, narrower
  1000px content, pale blue-gray sections and navy panels.
- Added original Tagioo architecture illustration, tracking review checklist,
  compact setup cards, hosting/configuration/inspection cards and factual Free
  capacity. Kept existing plan IDs, geo/cycle pricing behavior and corrected
  product claims. No reference photos, testimonials or guarantees copied.
- Shared font changed to Plus Jakarta Sans + Instrument Serif; marketing CSS
  references bumped to v3 across eight public pages. design.md updated.
- Local revision only; not deployed. Current screenshots supersede the first
  marketing proposal.
- Validation: server/shared script syntax, four public pricing regression tests
  and diff checks pass. All eight pages checked at five widths (320–1440px)
  without horizontal overflow; mobile menu/Escape verified. Product image loads
  at its native 1600px width. Revision screenshots saved in
  `artifacts/marketing-redesign/revision-*.jpg`.

## 2026-10-09 — Public marketing redesign

- Reworked the homepage around an original split hero, first-party event-flow
  diagram, actual Event Logs capture (request URLs already concealed), setup
  journey, audience fit, plans and FAQs. No third-party assets, testimonials or
  outcome guarantees copied from the TrackingConsulting reference.
- Added a scoped warm-white/ink/purple system with DM Sans and Instrument Serif
  in `public/assets/marketing.css`; `design.md` records the system. Features,
  pricing, comparison and setup pages share it; docs/legal inherit the typography
  and navigation treatment. Public assets stay under the existing unauthenticated
  `/assets/` route. Shared landing CSS references bumped to v4.
- Unified homepage/pricing plan cards and capacities (1/1/3/5 containers), made
  pricing default to monthly USD with BDT cycles enabled by geo response, and
  removed misleading multi-domain/SLA availability and competitor claims.
  Comparison now explains managed versus self-managed responsibilities.
- Added skip links, closed-menu inert handling and Escape support. Updated the
  setup guide to use the supplied DNS target, supported platform instructions
  and end-to-end verification instead of timing guarantees.
- Validation: all 50 native tests pass, including four new public pricing tests
  for USD/geo-failure fallback and BDT discounts/plan links. Server and public
  script syntax and diff checks pass. Eight pages checked at 320/375/414/768/
  1440px without page overflow; menus, FAQ and currency switches exercised.
  Isolated real Node staging returned HTTP 200 for all public routes/assets
  without login. Preview screenshots: `artifacts/marketing-redesign/`.
- Local only, not deployed. Next: owner reviews preview, then deploy only these
  marketing files on the preserved production branch. Paddle live activation,
  event-history investigation and Shopify approval remain separate launch work.

## 2026-10-07 — Honest Power-Up availability labels

- Marked Multi-Domains, IP blocking, Dedicated IP, BigQuery Export and Tagioo
  Care as Coming soon; their cards have no implemented configuration workflow.
  File Proxy retains Coming soon regardless of plan.
- Implemented feature labels now read ✓ Enabled. Custom Loader reads
  ✓ Enabled · Setup and retains its snippet dialog; missing infrastructure
  initialization still shows Pending/Setup Required and plan gates remain.
- Bumped app asset to v92. Local syntax and focused state assertions pass.
  No deployment or live tracking/configuration changes performed. Per-container
  runtime verification remains a separate follow-up.

## 2026-10-07 — Checkout and container creation journey

- Removed the Free-plan skip button and its allowance text from checkout;
  Paddle activation waiting no longer references the removed element.
- Container submission displays Creating Container with a spinner, live status
  and busy semantics; repeat submits are blocked and failures restore the button.
- Successful creation displays the selected container and its actual status,
  with a Finish setup in Setup Assistant action and prefilled tracking domain.
  A failed dashboard refresh still shows the returned container.
- App/styles assets bumped to v93/v57. Syntax gates and six focused checkout,
  activation, creation and assistant tests pass. No live provisioning changes
  or deployment performed.

## 2026-10-07 — Setup Assistant progressive instructions and resume

- Steps 1–3 retain the header, introductory guide, video and wizard; the
  additional platform installation instructions are revealed only at step 4.
- Persist the current step in browser localStorage per tenant/container; restore
  it across reload/login and container switching, with existing completion-based
  defaults when no valid preference exists. Removed forced step-4 navigation
  so returning to a completed setup preserves the customer's editing step.
- Step persistence stores no credentials or form values and applies in the same
  browser. App asset bumped to v94. Two assistant regressions and syntax gates
  pass; not deployed.

## 2026-10-07 — Destination-specific Setup Assistant details

- Step 3 now shows GA4, Meta, Google Ads and TikTok fields only when their
  destination is checked in step 2. Web GTM Container ID stays visible.
- Recompute on checkbox changes and step rendering; hidden inputs are disabled
  so they are excluded from generated requests, preserving entered values if
  the customer selects the destination again. Existing optional fields and
  placeholder generation remain supported.
- App asset bumped to v95. All 16 destination combinations verified along with
  the existing assistant, checkout and creation regressions; syntax gates pass.
  Not deployed.

## 2026-10-08 — Customer journey changes pushed; deployment blocked

- Pushed the requested Power-Up, checkout, container-creation and assistant UI
  changes as 19f2f02 on feat/saas-phase1-payments. All 33 native tests,
  server/frontend syntax checks and diff whitespace checks passed.
- Deployment not performed: SSH to the documented VPS as root was rejected
  (publickey/password authentication); no attached app terminal is available.
  Resume with the working VPS SSH connection, preserve its hotfix branch and
  cherry-pick 19f2f02, then run gates and reload only the panel service.
- Event-history contamination remains an investigation, with no fix included.

## 2026-10-08 — Container setup banner design

- Replaced the cramped unstyled setup notice with a dedicated callout using
  existing Tagioo tokens, clear next-step hierarchy, shorter copy and a compact
  Continue setup action. Desktop copy/action align horizontally; mobile stacks.
- App/styles assets bumped to v96/v58. Isolated Chrome preview inspected at
  1280/390px and overflow checked at 1280/390/320px. Syntax gates, both container
  creation regressions and whitespace checks pass. Local only; not deployed.

## 2026-10-08 — International homepage positioning

- Reviewed Stape and TAGGRS primary home/pricing pages for positioning. Rewrote
  homepage copy originally around managed sGTM hosting, first-party data, guided
  setup and monitoring for ecommerce teams/agencies; international SEO/social
  metadata replaces Bangladesh-specific messaging.
- Removed unsupported BDIX/latency/uptime promises, guaranteed blocker bypass,
  speculative ROI percentages and misleading competitor matrix. Product previews
  are labeled example data, use USD, and no longer imply actual customer ROAS.
  Pricing feature lists avoid unimplemented multi-domain/SLA/migration promises.
- USD Free/$30/$50/$100 monthly prices render by default, including geo failure.
  BDT geo still restores local prices and multi-cycle choices; Paddle CTAs stay
  monthly. Copy describes automatic USD subscription renewal and optional local
  manual payments without changing billing state/configuration.
- Existing homepage structure/routes retained, with a small scoped CSS contrast
  correction for the workflow card and landing CSS version v1. Chrome preview
  verified USD/BDT/geo-failure, quarterly BDT prices, signup links, script errors
  and 1440/390/320px overflow; desktop/mobile inspected. Syntax/diff gates pass.
  Local only; not deployed. Other marketing pages and event-history fix remain
  separate work; Paddle production activation still requires operator setup.

## Current branch
`feat/saas-phase1-payments` (main branch is `main`).

## 2026-10-07 — Paid signup email correction

- Verified paid signups no longer receive the Free-plan welcome email while
  waiting for checkout. Free signups retain it; verification codes remain
  unchanged. Existing successful manual/Paddle activation sends the selected
  plan confirmation, with transaction replay deduplication unchanged.
- Signup regression assertions cover zero welcome emails for Starter, Pro and
  Enterprise and exactly one for Free. All five signup tests, seven Paddle
  tests and `npm run check` passed locally and on the VPS. Deployed as
  `28e2e32` (source `e5a9c7e`), main service reloaded; both PM2 services online
  and origin login returned HTTP 200. No credentials or tracking changes.

## 2026-10-07 — Country-independent USD checkout

- Removed the Bangladesh-only Paddle exclusion. Every configured pending paid
  plan offers its existing USD monthly Paddle price; Bangladesh accounts also
  retain a separate BDT bKash/Nagad disclosure with their staged local amount
  and billing cycle. No country, price IDs, credentials or entitlements changed.
- Signup wording now describes the payment choice after verification. Completed
  card payment hides the local form as well as repeat-card/Free actions while
  server activation is pending, including after refresh.
- All 29 native tests and seven Paddle tests pass. Pushed `b42b59b` and deployed
  its focused cherry-pick as `7904fd8`; production syntax and ten focused billing
  tests pass, both PM2 services online, origin login HTTP 200. Refreshed the
  customer's existing Pro checkout and verified the $50 Paddle button plus
  optional ৳2,900 BDT local payment. Sandbox remains enabled; no payment submitted.

## 2026-10-07 — Customer mobile workspace

- Replaced the crowded phone/tablet icon rail with a labeled, expandable Menu
  below 860px; section selection, Escape and breakpoint changes close it, with
  focus restored when a navigation item would become hidden. Desktop sidebar
  remains unchanged.
- Container creation stacks into one column, with 44px controls, 16px input
  text, URL keyboards and no auto-capitalization of domains/config. Backend
  provisioning and live tracking are unchanged.
- Constrained tables and setup code to their own horizontal scroll areas,
  wrapped instruction/billing tabs, long domains and small-screen notices, and
  bounded payment/Power-Up dialogs by the dynamic viewport. Asset versions
  bumped to styles 56 / app 91.
- Isolated customer preview checked Dashboard, Event Logs, Containers, Power-Ups,
  Setup Assistant, Account and Billing at 320/390/768px; desktop 1280px retains
  two-column creation and hides Menu. Native required-field validation, all
  creation inputs, location selection and submission/error recovery exercised
  through a read-only proxy (no real container provisioned). Four navigation
  regression tests and syntax gates pass. Deployed to VPS as `06b869f`
  (focused cherry-pick of `2798c8f`, preserving production hotfixes). VPS syntax
  gates and all four mobile navigation tests pass; panel reloaded, both PM2
  services online, origin login HTTP 200. Live 390px customer navigation and
  Containers view verified without page overflow; assets styles v56/app v91.

## 2026-10-07 — Durable Paddle delivery and core database reads

- VPS rollout completed on the preserved `fix/signup-memory-20261006` branch:
  durable billing cherry-pick `60edae4`, test harness correction, and PM2
  receiver-entry fix `f0f774b`. Both PM2 services are online; process list saved.
  Only the exact Paddle webhook Nginx location changed to loopback 3101; config
  passed `nginx -t` before reload. Tracking/container locations unchanged.
- Protected rollback backup: `/var/backups/tagioo-paddle-durable-ClGo0e`.
  Migration verified full record equality: 256,938,662 → 18,532,807 bytes.
  Measured core read + parse: 145 ms, previously 3,566 ms. Event history was
  compressed, not deleted; unpack is required before reverting to old code.
- Real Paddle sandbox transaction replay delivered HTTP 200 on its first
  attempt, finished in the durable inbox, and preserved the 17-payment count.
  Latest subscription replay also applied, retaining active Starter. Public
  signed receipt measured 43 ms; duplicate receipt 20 ms; unsigned request 401.
  VPS syntax, seven billing tests and 22 native tests pass. Customer billing
  page shows active Starter / USD 30 / 500K events after replay.
- Checkout waiting/refresh, restart recovery, stale-event ordering, renewal and
  cancellation are covered by native regression fixtures; no new live charge
  or real month-end renewal was performed. Paddle remains sandbox. Production
  approval and environment-specific live credentials still require the owner.

- Read-only diagnosis correlated provider empty HTTP 503 attempts with origin
  HTTP 499 disconnects. Core DB was 245 MB, with 244 MB of tenantEventHistory;
  a duplicate webhook took 3.95s before even doing a write.
- Added a separate loopback Paddle receiver with encrypted SQLite durable inbox,
  HMAC verification before persistence/HTTP 200, deduplication, crash leases and
  indefinite processing retries. Main panel remains sole billing state writer.
- Provider occurred_at watermarks prevent older events reverting paid state;
  stale payment receipts remain recorded without resurrecting canceled access.
- Checkout now waits for authenticated server activation, disables another
  payment and Free skip, and retains waiting state across refresh.
- Lossless lazy gzip event-history archive preserves all history inside the
  existing protected atomic JSON file while keeping auth/billing reads small.
  Legacy snapshots remain readable; rollback requires stopped-panel unpack tool.
- Local syntax, seven Paddle tests and 23 native tests pass, including ingress
  under a 5.5s panel stall, restart recovery, failed storage/retry, event ordering,
  UI waiting, archive preservation and legacy unpacking. VPS rollout pending.
- Live credentials/switch remain operator-controlled and excluded from this
  sandbox fix. No new dependencies or customer tracking changes.

## 2026-10-07 — Paddle sandbox deployment and real checkout

- Deployed only Paddle billing onto production's existing
  `fix/signup-memory-20261006` branch (release `f7668c7`), preserving signup
  fixes, manual payments and tracking. Protected env/database backup saved at
  `/var/backups/tagioo-paddle-sandbox-20261007-79XOMA`; rollback ref
  `codex/paddle-before-20261007` points to `6462511`. Do not blindly pull the
  feature branch into production or restore the whole database over new payments.
- Kept `PADDLE_ENV=sandbox`; all three active monthly USD prices verified as
  30/50/100. Confirmed webhook secret matches its destination and subscribed
  all seven billing events. Bangladesh accounts intentionally retain manual
  bKash/Nagad; card checkout appears for non-Bangladesh accounts.
- Added a visible sandbox warning (`c1ea804`). Real Paddle test-card purchase
  on isolated tenant `paddle-sandbox-test-20261007` completed: USD 32.66
  including test tax, exactly one confirmed Starter payment, active 500K limit.
  Paddle replay delivered HTTP 202 with `duplicate: true`, no extra payment.
- Actual browser Pro upgrade accepted, charged USD 21.77 prorated including
  tax, and webhook applied active Pro/2M events/3 containers. Hosted sandbox
  customer portal opened and displayed the original paid transaction.
- Fixed USD invoice labels (legacy BDT defaults preserved), asset version 90,
  native currency regression test (`1d78c29`, production cherry-pick `a713bb7`).
- Origin webhook rejects invalid, modified and stale HMAC requests with HTTP
  401. Seven Paddle tests, sixteen native smoke tests and syntax gates pass.
- Real sandbox downgrade returned to Starter; Paddle portal showed the next
  bill with prorated credit. Past-due simulation completed and retained paid
  access. Card replacement completed in Paddle Test Mode but exposed a bug:
  its zero-value transaction was recorded as a purchase. Fix `b47d861` is
  committed and pushed; deployed after unlock as production `bb9de41`.
  Signed replay using the real sandbox transaction returned HTTP 200 ignored;
  no additional invoice was created. The pre-fix zero invoice remains on the
  isolated test tenant only, preserved as test evidence.
- Initial provider deliveries showed empty HTTP 503 responses despite eventual
  activation; replay succeeded. Production still has slow JSON-store reads and
  this is not yet a clean live-payment launch sign-off. Remaining sandbox
  launch prerequisite: resolve initial webhook delivery latency/retries before
  live sign-off. Hosted sandbox portal successfully scheduled cancellation
  for Nov 7, 2026; local protected DB confirms the same scheduled change while
  keeping Starter active. Generated paid USD 32.66 PDF invoice opened correctly.
  Sandbox notification destination restored to `traffic_source=platform`
  (HTTP 200), excluding future simulation traffic. Production syntax and all
  seven Paddle tests passed; PM2 online after reload, origin login HTTP 200.
  No live payments or existing customer subscriptions changed.

## 2026-10-06 — Verification timeout and paid signup

- Verification now creates the account, saves visitor attribution and stages the
  selected paid plan under one database lock, with one read and one atomic write.
  Failed plan staging cannot leave a partially-created Free account on disk.
- Login preserves pending checkout; only the explicit checkout Skip action drops
  the unpaid selection. Paid limits still require confirmed payment.
- Added signup, storage-compatibility and owner-cache regression coverage;
  all 15 native tests, syntax and whitespace checks pass.
- Deployed isolated code commits through 49f9cb7 (VPS HEAD 6462511), keeping
  production on fix/signup-memory-20261006 rather than the feature branch.
- First full live HTTPS-origin test reached Pro checkout (HTTP 200), but verify
  still took 42.6 seconds and the subsequent login timed out. Follow-up releases
  old read-cache snapshots before fresh reads/serialization. Compact JSON keeps
  the same fields, encryption and atomic writes; old readers remain compatible.
  Pre-change backup: /var/backups/tagioo-history-before-compact-20261006.json.
- Owner usage reads now reuse stored summaries instead of synchronously scanning
  every tenant's raw events. Customer/background calculations are unchanged.
  Latest direct-origin Pro test: signup 1.54s, verify 10.39s, checkout 6.41s,
  login 3.07s. Checkout returns 200 and login preserves the pending paid plan.
  Valid-TLS HTTPS test through Nginx also reaches Pro checkout: signup 2.82s,
  verify 10.36s, checkout 5.83s (200), login 20.67s with checkout preserved;
  no proxy timeout. PM2 stayed online at PID 3926365 / restart count 38, but RSS
  reached 2420 MB. Residual load-dependent latency/memory needs further work;
  these smoke tests do not establish sustained capacity or eliminate all timeouts.
  Test accounts use reserved example.invalid addresses and real stored codes;
  real inbox delivery and public Cloudflare browser flow remain unverified.
  Paddle feature release remains excluded; this is not a card-payment test.

## 2026-10-06 — Signup 502 memory incident

- VPS console confirms POST /signup upstream reset at 13:12:25 UTC and
  repeated Node heap exhaustion at 2 GB during JSON parsing. history.json is
  272 MB, with four 253–266 MB backups; production remains at 07930fb.
- Removed full snapshot decryption/parsing from backup listing and scheduled
  backup-age checks. Listing now uses file metadata; source is shown as snapshot.
  Restore validation/encryption and backup contents are unchanged.
- Signup validation shares the existing read-only database cache/in-flight read.
- Syntax, encryption round-trip, and backup no-payload-read regression tests pass.
  Deployed code/test only via cherry-pick a414c15 on VPS branch
  fix/signup-memory-20261006 (Paddle release excluded). Direct-origin signup
  smoke test returns 302 /verify in 4.4s and verification page returns 200.
  Reserved example.invalid test emails create pending records only, no customer
  accounts or tracking containers. Follow-up 958dae7 releases expired cache
  snapshots before parsing replacements; deployed as 23ceeda. Automated public
  requests receive Cloudflare 403, so browser/email completion remains unverified.
  Final HTTPS-origin test through Nginx (valid TLS, local DNS override) returns
  302 /verify in 0.17s after the final cache fix. No verification-code submission
  was performed; real email delivery/account completion still needs browser retry.
  Production is on the isolated hotfix branch; do not blindly pull the feature
  branch there (it also includes the untested Paddle release).

## 2026-10-03 — Global Paddle billing preparation

- Completed the existing Paddle integration and corrected subscription item
  updates to use documented proration fields. Paid downgrades apply immediately
  with credit on the next bill; Free cancellation remains at period end.
- Checkout stays disabled until API key, client token, webhook secret, and all
  price mappings are present. Added API timeout and preserved zero-value payments.
- Local tests cover signed payloads, invoice binding, purchase activation,
  duplicate delivery, subscription renewal, cancellation replay, and plan updates.
- Owner confirmed Paddle sandbox is not configured. Real checkout, webhook
  delivery, portal, and subscription tests remain pending account setup. SSH to
  the production VPS remains unavailable; production billing was not enabled.

## 2026-10-02 — Shopify-only release

- Setup Assistant now remembers completion per container and reopens at Step 4.
  Existing configurations with platform, domain, and GA4 ID resume at Step 4;
  Back remains available and dashboard refreshes preserve in-progress editing.
  Template generation saves completion and the Web GTM ID; asset version bumped.

- Shopify disconnect follow-up: the sibling app now permits local cleanup when
  the panel rejects a revoked/stale integration token with HTTP 401. Other
  billing/network failures still abort for retry; remote signature checks remain
  enforced. Live credential diagnosis is pending VPS access (SSH denied).
- Follow-up loader fix: Shopify billing refresh now runs in the background,
  coalesces concurrent refreshes, and backs off failed attempts. Pixel deletion
  retries within an eight-second deadline and requires confirmed removal.
  Persistent Shopify fetch failures still need VPS connectivity diagnostics.

- Published the manual Shopify Custom Pixel generator, customer installation
  instructions, and Shopify-compatible Web GTM exports as a separate release.
- Paddle changes remain local and are excluded from this release. No production
  billing configuration, Nginx, or container lifecycle changes are included.
- Next: pull the release on the VPS, reload the panel, and test a Shopify order
  through Customer Events, Tagioo, GA4, and Meta before advertising.

## 2026-09-29 — Manual Shopify pixel and Paddle launch completion

- Added an app-free Shopify setup path while preserving the submitted Tagioo
  Shopify app. Setup Assistant now accepts a Web GTM container ID and generates
  supported Shopify Customer Events Custom Pixel code. The pixel loads GTM in
  Shopify's sandbox and maps storefront, cart, checkout, search, and Purchase
  events into Tagioo's existing GA4-style dataLayer contract. Shopify-specific
  Web GTM exports now use the custom `page_view` event, preserve Shopify's real
  page URL/title, and allow multiple ecommerce events per sandbox lifetime.
- Added a copy/install guide beside the existing app connection flow and removed
  the obsolete Checkout Additional Scripts Purchase instructions. The UI warns
  merchants to run either the manual pixel or app pixel, never both. `app.js`
  and `styles.css` asset versions were bumped.
- Normalized the submitted Shopify app pixel's GraphQL Order GID to the same
  numeric order ID used by the `orders/paid` backend recovery path, preserving
  browser/server Purchase deduplication.
- Completed Paddle lifecycle hardening: webhook signatures now reject stale
  deliveries and support rotated signatures; signed Paddle item price IDs are
  the plan authority; new purchases must match the tenant's pending invoice and
  plan; renewals can resolve by Paddle subscription/customer ID; duplicate
  cancellations cannot reset a Free cycle; provider status, scheduled changes,
  and next billing dates sync from subscription webhooks; USD subscriptions now
  store their USD monthly amount.
- Added authenticated Paddle customer-portal sessions so card customers can
  update payment methods and access Paddle invoices. Global customers who begin
  on Free now see USD pricing and enter Paddle when upgrading instead of falling
  into the Bangladesh manual-payment modal. Added focused native tests
  for signatures, price mapping, renewal dates, and checkout binding, plus
  `docs/paddle-launch.md` with dashboard configuration, sandbox acceptance, and
  production rollback steps.
- Verification passed: control-panel syntax, browser JS syntax, Paddle tests
  (4), existing data-protection/security tests (6), generated Custom Pixel parse
  smoke, and `git diff --check`. In the sibling Shopify app, Node 22 tests (5),
  lint, typecheck, production client/SSR build, and diff check passed.
- Production Paddle remains intentionally disabled: this checkout has no local
  `.env`, and production activation requires owner-confirmed Paddle products,
  price IDs, client token, scoped API key, webhook secret, and a full sandbox
  purchase/upgrade/downgrade/portal/cancel run before setting
  `PADDLE_ENV=production`.

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

## 2026-10-11 — Screenshot-inspired homepage illustration preview

- Updated only `artifacts/homepage-copy-review/`: original light dotted canvas, lime banner, dark Tagioo server card, animated connections and alternating store/order states, based on the supplied screenshots. Retained the surrounding production-style homepage and professional copy.
- Kept destination labels to Meta, Google Ads, TikTok and GA4; omitted unverified accuracy guarantees, recovery counters and integrations.
- Responsive vertical flow on phones with two-column destinations; pause/play, reduced-motion and offscreen/hidden-tab handling retained. Browser checks at 320/375/414/520/540/768/1024/1280px found no horizontal overflow, clipped labels or cards outside the illustration.
- Validation: preview interaction smoke harness, JavaScript syntax and `npm run check` passed. Production files and deployment remain unchanged. Next: review the preview before applying approved copy/illustration to the production landing page.

## 2026-10-11 — Destination brand logos

- Replaced Meta, Google Ads and TikTok placeholder icons in the isolated homepage preview with locally stored SVG brand marks sourced from their official sites. Preserved proportions and responsive sizing. No production changes.
- Validation: browser rendering on desktop/mobile, preview smoke checks and npm syntax gate.

## 2026-10-11 — Restore original homepage below updated hero

- Restored every original production homepage section, order, copy, pricing and footer in the isolated preview, retaining only the revised hero and its branded event-flow animation. Hero styles scoped to avoid altering restored sections.
- Kept original disclosure/reveal/menu behavior. Preview excludes live GTM and geo requests, with signup/assets pointing to the live site. Production unchanged.
- Checked 320/375/768/1280px: no page overflow and all three brand assets load. Syntax and diff checks pass.

## 2026-10-11 — Preview mobile navigation fix

- Fixed the restored stylesheet’s mobile navigation: the menu panel opened but a shared mobile `nav` rule hid its inner links. Explicitly display the mobile nav as flex.
- Added controls association, open/close labels, inert closed navigation, Escape closing with focus return, and closing on all links. Preview only; production unchanged.

## 2026-10-11 — Simplify hero signup area

- Removed the hero’s extra pitch, secondary link, allowance note and benefit list as requested. Restored the original email signup form and Start for free button, submitting to the existing live signup page. No other homepage sections or production files changed.

## 2026-10-11 — Hero signup placement and page trimming

- Moved signup immediately below the hero description on every screen, with the illustration centered underneath. Removed the requested outcome/workflow section, tracking-operations section and floating WhatsApp shortcut.
- Added animated SVG connectors to the mobile stacked flow alongside the alternating event cards; existing pause, offscreen and reduced-motion handling applies. Production unchanged.

## 2026-10-11 — Plain-language positioning and setup copy

- Broadened the hero badge to stores, lead generation and agencies. Added the connection between better conversion signals, ROAS, sales and profit without promising an outcome.
- Shortened all nine platform feature descriptions and headings. Setup now emphasizes no coding for supported integrations, familiar account creation and a 10-minute target with DNS/verification timing noted. Preview only.

## 2026-10-11 — Requested setup copy and platform badges

- Replaced setup introduction with the owner’s exact sentence. Added LinkedIn, Snapchat, Pinterest, Klaviyo, Bing Ads and ActiveCampaign badges to the preview integrations strip.
- Copy-only preview change; does not add or verify integrations. Production unchanged.

## 2026-10-12 — Dashboard headline and centered integrations

- Used the requested dashboard headline. Centered the integrations label and badges; added subtle staggered badge movement with reduced-motion support. Preview only; production unchanged.

## 2026-10-12 — SEO foundation and six original launch articles

- Added canonical URLs to eight marketing/legal pages; search titles/descriptions to six, aligned social metadata and homepage Organization/WebSite schema. Preserved existing local design changes and the separate approved homepage preview.
- Added pre-auth public robots/sitemap/blog handling, app-host/app-shell noindex headers, a 15-URL sitemap, crawlable blog index, six original articles (3,376 words), BlogPosting/breadcrumb schema and related/signup links. No Stape article bodies scraped or rewritten; its public listing used only for topic coverage research.
- Added `docs/marketing/tagioo-seo-plan.md`: audit evidence, keyword map, publishing/review gates, 90-day editorial plan, indexing/performance checks and measurement. Editable article sources: `docs/marketing/blog/`.
- Direct live fetches returned 403; live crawler/indexing and sitemap availability remain unverified. Search Console access, actual tenant implementation screenshots and Meta primary dedup documentation review remain launch checks. No deployment, outreach or spending performed.
- Preview: http://127.0.0.1:8769/blog (separate loopback server, noindex). Route/metadata/security smoke tests and backend syntax pass; mobile index/article show no overflow. No backend tracking layers changed.

## 2026-10-12 — Connect homepage review to blog preview

- Added Blog links to the isolated homepage preview’s desktop/mobile navigation and footer, pointing to the local SEO blog at port 8769. The production marketing files already use `/blog`; no deployment changed.

## 2026-10-12 — Unify homepage/blog preview navigation

- Blog preview root now redirects to the approved homepage on port 8768 instead of showing the unrelated local marketing redesign. Local preview wiring only; canonical production links unchanged.

## 2026-10-12 — Editorial blog polish

- Reworked blog index as Tagioo Journal: asymmetric title, illustrated lead guide, topic filters, search with result count/empty state, and quieter editorial article rows. Original vector/event artwork and brand logos; no borrowed competitor graphics.
- Rewrote all six titles and opening paragraphs around concrete reader problems; preserved existing article URLs, canonical tags and schema. Added sticky article contents on desktop and collapsible contents after the title on phones.
- Examined Stape’s search-visible listing and WooCommerce guide for specificity and structure; no ranking position claimed and no competitor article rewritten. Search/filter behavior, route/schema checks and backend syntax validated. Production unchanged.

## 2026-10-12 — Shared mobile menu visibility fix

- Reproduced on live tagioo.com: menu toggles open, but the generic mobile `nav { display: none }` hides its links. Added explicit flex display to `.mobile-nav nav` in shared landing CSS; bumped stylesheet version across eight marketing/legal pages.
- Local fix only; live deployment remains pending. Backend syntax and diff checks pass.

## 2026-10-12 — Homepage journal section

- Added six article previews between pricing and FAQs in the approved isolated homepage, with topic labels, practical summaries and a View all guides link. Responsive three/two/one-column layout; links use the existing blog preview. Production unchanged.

## 2026-10-12 — Homepage blog slider

- Replaced the six-row journal grid with an illustrated horizontal card rail. Swipe/scroll snapping, next/previous buttons with boundary states and keyboard arrows; three cards desktop, two tablet and one with next-card preview on mobile. No autoplay, reduced-motion respected, article links remain crawlable. Preview only.

## 2026-10-12 — Prepare approved site for GitHub/deployment

- Promoted approved homepage preview into public/landing.html, including hero animation, restored sections, requested copy, journal slider and responsive menu. Copied isolated assets into public/assets/home-*. Production routes replace loopback links; removed preview noindex and preserved production SEO metadata/schema and GTM.
- GitHub push requested by owner; deployment command provided separately. Private local screenshots and video experiments excluded from source upload.

## 2026-10-12 — Refund policy route

- Added public /refunds with matching legal-page layout, support instructions, Paddle policy references, cancellation distinction, Shopify/local payment handling and statutory-rights preservation. No new money-back guarantee or refund automation. Added footer/pricing links and sitemap entry.

## 2026-10-12 — Restore original inner-page design

- Removed the green/Jakarta marketing theme from eight inner marketing/legal pages. Restored original Inter typography, visible hexagon logo, base homepage colors/buttons/layouts while preserving current content, pricing behavior, SEO, legal policy and blog links. Added minimal screenshot/focus/header compatibility styles.

## 2026-10-12 — Inner-page hero, blog access and footer

- Fixed dark inner hero contrast and centered heading/description with deliberate spacing and responsive CTAs. Homepage hero unchanged. Added missing Blog links to mobile menus and installed the homepage footer across all eight inner marketing/legal pages with readable footer text.

## 2026-10-12 — Paddle production configuration

- Owner approved creation of scoped live API key, client token and seven-event billing notification destination. Created live monthly USD Starter $30, Pro $50 and Enterprise $100 prices and verified their active amounts/cycles via Paddle API. Checkout domain tagioo.com approved.
- Installed credentials only in VPS .env, protected rollback backup under /var/backups/tagioo-pre-live-1791779523/, switched PADDLE_ENV to production and reloaded/saved both PM2 services. API key expires January 10, 2027; rotate before expiry.
- Public webhook synthetic harmless signed event returned 200, replay returned 200/duplicate, unsigned request returned 401. Durable inbox worker completed it once and cleared payload. This proves signature/inbox handling, not delivery from Paddle or real paid activation.
- Syntax gate and all 11 billing/inbox tests passed. Real checkout, paid activation and actual signup/reset email delivery remain pending user-assisted end-to-end test. No live purchase or customer tracking changes performed.
- User created a test account. Opened Starter upgrade through customer Billing; live checkout initially failed with transaction_default_checkout_url_not_set. Saved approved https://tagioo.com/checkout as Paddle default payment link and retested successfully: live buy.paddle.com payment form offers card/PayPal, $30 total today including displayed Bangladesh VAT. Payment left to owner; actual webhook activation still pending.
- Owner requested no-charge testing. Paddle simulator uses ntfsimevt_ identities; receiver now acknowledges signed simulations explicitly without queueing them or changing billing. Real evt_ validation/persistence unchanged. Added regression assertions for simulation signature and inbox isolation; all 17 billing/inbox/activation/signup checks and syntax gate pass. Live destination accepts platform and simulation events; signed simulations cannot change billing.
- Deployed 997dbd5 to VPS and reloaded receiver. Replayed Paddle's subscription.activated sample: provider received HTTP 200 with received:true, simulation:true, billingChanged:false. Actual Paddle-to-production delivery proven without charge. Sandbox-card checkout and a real paid activation were not performed; live payment form rendering verified previously. No money spent.
- Subsequent owner-authorized live test: created one-use $29 USD discount restricted to Starter, first payment only. Owner completed $1 checkout. Paddle Transactions shows Complete $1.00; Tagioo Billing shows Starter Active and invoice tagioo-launch-test-INV001 PAID $1. Real live charge and automatic webhook activation now verified. Subscription renews at $30 on November 12, 2026 unless canceled; cancellation and actual reset email delivery remain unverified.

## 2026-10-12 — Customer subscription wording and navigation icons

- Renamed Paddle portal button to Manage subscription so cancellation is discoverable. Replaced customer Settings icon with sliders and supplied matching SVG chat/bell icons for Support tickets and Notifications, which previously fell back to font glyphs. Existing SVG size/color rules reused; bumped app.js cache version to 108.
- Syntax and diff checks passed. No billing behavior changed. Test subscription renewal was canceled in Paddle at owner's request, effective November 12, 2026; paid month remains active.

## 2026-10-12 — Tax-exclusive Paddle pricing

- Owner requested applicable tax on top of subscription prices. Changed live Paddle account Sales tax preference from automatic location-based pricing to Price excludes tax; save confirmed. All three live prices use account_setting. Added tax-exclusive disclosure to homepage/pricing notes and card checkout. Existing test subscription remains scheduled for cancellation.
- Syntax/diff checks passed. Deployed dfd618e to VPS, syntax gate passed and main PM2 service reloaded. This also publishes Manage subscription and customer SVG icon updates.


## 2026-10-12 — Compact mobile purchase animation

- Shortened the homepage phone illustration: compact event row, server/domain/pipeline card and two-column destinations instead of tall artwork and workspace feature list. Purchase and destination labels explicitly describe customer checkout and data transfer.
- Event cycle reduced from eight to four seconds; packets from 3.8 to 1.6 seconds. Destination borders pulse after the purchase appears. Pause/offscreen handling and reduced-motion remain supported; bumped homepage flow CSS cache version.
- Removed default figure margins and reduced phone hero side padding. Browser checks at 320/375/414/520/768/1280px found no page overflow or escaped cards; pause and reduced-motion checks pass. Screenshot: artifacts/mobile-purchase/mobile.png. Backend/frontend syntax and diff checks pass. Local only; deployment and physical-device verification pending.

## 2026-10-12 — Distinct purchase transfer color

- Both mobile transfer connectors and desktop packets now use vivid purple, matching the purchase badge and destination pulse. Longer packet trails move every 0.75 seconds for clearer, faster transmission. Cache version bumped; pause/reduced-motion preserved.

## 2026-10-12 — Orange and charcoal brand logo

- Adopted owner-supplied Downloads/Tagioo/Tagioo logo in orange and charcoal.png. Self-contained SVG viewports preserve supplied pixels, framing full wordmark and orange icon without redrawing. Light backing preserves charcoal contrast on dark surfaces.
- Replaced homepage/inner-page/blog headers and footers, dashboard branding/loading mark, authentication/checkout page logos, invoice icon, hero server icon and favicon. Compact dashboard sidebar uses icon at tablet widths. App/styles cache versions 109/68 and favicon version bumped. New shared assets: public/assets/tagioo-logo.svg and tagioo-icon.svg.
- Backend/frontend syntax, diff and responsive animation checks pass. Logo loading/sizing checked on homepage, features, pricing, blog and dashboard at 320/768/1280px; preview screenshot artifacts/mobile-purchase/new-brand.png. Local preview updated. Not deployed.

## 2026-10-12 — Transparent website logo variants

- Removed header/footer logo backing and padding across marketing/legal pages. Added transparent orange/white wordmark for dark footers, preserving original orange icon. Browser verified transparent backgrounds and rendered both variants at 485px; syntax and diff checks pass. Local only.

## 2026-10-13 — Free/Starter container upgrade prompt

- New Container opens an upgrade dialog for customer Free/Starter plans with an existing non-deleted container. Upgrade plan opens Billing; Not now/Escape dismiss. Other plans and owner behavior preserved. Existing backend container-limit enforcement unchanged. App v110.
- Focused regression tests cover plans, first container, deleted/deleting/pending containers and owner scope; browser popup/Billing/Escape checks at 375px plus syntax/diff gates pass. Local only; not pushed/deployed.

## 2026-10-13 — Illustrated container and platform onboarding

- Removed both setup video cards and their YouTube playback handler. Added linked illustrated customer guide with four original SVG diagrams: first-party DNS, Server GTM config, GA4 Measurement ID and post-creation sequence. Editable documentation: docs/customer-container-setup.md; browser guide: /assets/setup-guide/index.html. Google navigation checked against primary documentation.
- Setup Assistant defaults currency to USD and explains actual store currency. Web GTM ID shown/enabled only for Shopify; WooCommerce plugin download directly underneath template actions. Plugin’s Web GTM ID still belongs in WooCommerce → Tagioo settings, documented with sGTM URL, GA4 ID/secret and injection behavior. Fixed misleading no-configuration plugin instructions.
- Guide covers WooCommerce, Shopify manual/app paths, Laravel/custom/Wix/BigCommerce and purchase verification, without changing ingestion/provisioning behavior. App v111. Platform/default/video regression tests, earlier upgrade tests and backend/frontend syntax/diff gates pass; browser checks at 320/375/768/1280px verify guide images/no overflow and platform controls. Local only; not pushed or deployed.

## 2026-10-13 — Screenshot-based setup walkthrough

- Added all seven owner-supplied screenshots to the customer guide in task order, with container config values removed from the two published copies. DNS explicitly specifies CNAME track → bd.tagioo.com, DNS only, TTL Auto and Save.
- Says Go to Setup Guide Menu, then walks through Choose type, Select destinations, Add details and Download templates one by one. Notes old screenshot Web GTM field and deletion message so customers follow current behavior. Markdown synchronized; container sidebar uses actual DNS/config screenshots.
- Browser image-loading/overflow checks at 320/375/768/1280px, focused regression tests, syntax and diff gates pass. Local only.

## 2026-10-13 — Account prerequisites and Meta IDs

- Guide includes Google sign-in/account, GTM account plus Server/Web container creation and Analytics account/property/Web stream creation. Added Meta Events Manager data source Settings path to Pixel/Dataset ID, CAPI token, Test Events code and missing-data-source creation flow; labels/permissions caveats included.
- Highlighted DNS-only/save, matching IDs/currency/domain, separate Web/Server imports, private secrets and destination verification. Markdown synchronized. Responsive guide image/overflow checks, syntax and diff gates pass. Local only.

## 2026-10-13 — Meta credential emphasis

- Highlighted Dataset/Pixel ID and CAPI token navigation together in the guide; added exact-location help beside both assistant fields. Meta Test Event Code labeled optional in the form and guide. Documentation synchronized; syntax/diff checks pass. Local only.

## 2026-10-13 — GTM import instructions

- Expanded guide Step 4 with separate Web/Server import steps, workspace selection, Merge/conflict review, detailed-change confirmation, placeholder checks, Preview and Submit/Publish. Explained import versus publish and preserved Shopify app server-only path. Linked official Google import/publishing documentation; Markdown synchronized. Local only.

## 2026-10-13 — Balanced desktop homepage hero

- Replaced desktop hero stacking with a two-column layout from 1100px: left-aligned headline/copy/signup beside a bounded purchase animation. Tablet illustration capped at 640px; phone layout preserved.
- Tightened desktop banner/workspace spacing and preserved the scene proportions so animated connectors continue to meet the cards. Bumped both homepage CSS cache versions.
- Browser checked 320/375/414/768/1100/1280/1440/1782px: no horizontal overflow; desktop cards contained, pause and reduced-motion pass. Screenshot: artifacts/desktop-hero.png. Backend syntax and diff checks pass. Local only; not deployed.

## 2026-10-13 — Center hero copy and trim animation whitespace

- Grouped headline/copy/signup into one desktop grid item so its combined height centers exactly against the illustration. Mobile wrapper uses display:contents to preserve the stacked layout.
- Reduced desktop illustration cap to 600px and control-row padding; restored the compact scene ratio at narrow desktop sizes and trimmed unused canvas margins while keeping card/connector coordinates together. CSS versions desktop-6/desktop-7.
- Checked 320/375/414/768/1100/1250/1440/1782px for overflow, desktop centering and card clearance. At 1250px the illustration is now 632px tall; pause/reduced-motion checks and backend syntax/diff gates pass. Local preview remains on port 8779; not deployed.

- Homepage-only commit prepared for GitHub on feat/saas-phase1-payments; dashboard/setup-guide work and local preview artifacts remain uncommitted.

## 2026-10-13 — Step 4 plugin card and transparent dashboard logo

- Moved WooCommerce plugin download into its own card directly underneath Download Templates in Step 4, before import instructions. Existing platform visibility and download handler reused.
- Dashboard sidebar now uses existing transparent orange/white wordmark; removed white backing, padding and rounded rectangle. Tablet icon behavior preserved.
- Existing platform/setup regression tests, backend/frontend syntax and diff gates pass. Browser DOM confirms Step 4 card ordering and loaded transparent logo; visually checked white text/orange icon. Local only; no authenticated plugin ZIP download exercised.

## 2026-10-13 — Subscription management in Change Plan

- Moved Manage subscription from Monthly Usage to the Change Plan header; visible for non-Free plans. Paddle retains authenticated customer portal; Shopify uses its existing plan-management link.
- Manual customers receive an explicit management dialog explaining no automatic charges. Stop renewal submits Free through the existing plan-change route, scheduling at paid-cycle end when eligible; otherwise Free applies immediately. Escape/Keep current plan dismiss; no backend billing changes. App cache v112.
- Assert-based smoke checks cover manual dialog/Free selection, Paddle portal routing, Shopify routing and unique Change Plan button placement. Existing setup tests, backend/frontend syntax and diff checks pass. Local only; no live cancellation performed.

## 2026-10-13 — Publish dashboard and onboarding changes

- Prepared dashboard logo, Step 4 WooCommerce plugin card, Change Plan subscription management and pending illustrated onboarding/container-upgrade work for GitHub. Included required guide assets/docs and focused regression tests; excluded local artifacts and assistant settings. Backend/frontend syntax, focused tests and staged diff checks pass. Server deployment remains owner-run.

## 2026-10-13 — Public website tracking checker

- User requested a Stape-style checker, public only. Reviewed Stape's public tool, scan start and email gate; no competitor implementation/artwork copied. Added original /website-tracking-checker page and public POST API with no email/account requirement. Linked from homepage mobile navigation/footer and sitemap.
- Reads HTML plus up to three same-origin scripts: tracker references/IDs, platform clues, consent/data layer, first-party routing hints, response-cookie attributes, next-step recommendations, JSON export and print styling. Evidence coverage explicitly differs from tracking quality; not-observed clues do not assert missing/broken tracking. Cookie values/raw source never returned. No runtime event, page-speed, conversion/ad-spend or server-delivery claims.
- Standard-library scan module isolates network work from server route chain; validates every DNS answer, pins selected IP, revalidates redirects, blocks private/reserved networks, credentials/custom ports and HTTPS downgrades. Script redirects stay same-origin. 15-second deadline, 2MB decoded response cap, three concurrent scans, eight requests/IP/ten minutes, bounded five-minute memory cache. No new deps or live-tracking changes.
- Eight focused tests pass for address variants/DNS/redirect boundaries, scope limits, tracker evidence, cookie-value redaction and Ads-only versus GA4 detection. Backend/frontend syntax and diff gates pass. Real example.com and stape.io scans, JSON download, private-URL errors, API rate limit, mobile menu and 320/375/414/768/1024/1100/1280px overflow checks verified. tagioo.com timed out from this machine in both scanner and curl.
- Separate empty-data Node 20 preview runs at http://127.0.0.1:8780/website-tracking-checker. Screenshot: artifacts/tracking-checker-preview.jpg. Documentation: docs/marketing/tracking-checker.md. Local only; not pushed/deployed. Browser runtime crawling would need a separate isolated worker with outbound enforcement, not execution inside the panel monolith.

## 2026-10-13 — Shorten setup assistant instructions

- Reduced Step 1 description/currency/tracking-domain hints to short phrases. Removed Step 3 explanatory paragraph and inline GA4/Meta instructions; field labels, optional markers, placeholders and illustrated guide remain. No form behavior changed. Backend syntax, existing setup tests and diff checks pass. Local only.

## 2026-10-13 — Tracking checker in website menus

- Added Tracking checker to desktop/mobile navigation across homepage and eight marketing/legal pages; checker page already includes its own active link. No dashboard link, per public-only scope. Homepage header switches to mobile menu through 1100px to fit the additional link; shared homepage stylesheet cache bumped. Syntax and diff checks pass. Local only.

## 2026-10-13 — Publish tracking checker and menu updates

- Prepared public checker/routes/assets/docs/tests, marketing/legal menu links and shorter assistant instructions for GitHub on feat/saas-phase1-payments. Ten focused tests, syntax checks and diff gate pass. Local artifacts and assistant settings excluded. Deployment requires pulling then reloading sgtm-control-panel to register the new public routes; no package installation or environment changes needed.

## 2026-10-13 — Alurkohv live GTM loader/domain repair

- Reproduced store's GTM-not-found symptom: plugin injected GTM-P9DMZG7T correctly through tagioo.alurkohv.com, but TLS served connect.tagioo.com's certificate. DNS correctly pointed to worker 147.79.67.213; sgtm-alurkohv was running on 127.0.0.1:8203, with no matching Nginx vhost or certificate.
- Temporarily disabled WordPress Custom Loader to restore direct Google loading; verified public source changed. User reconnected Hostinger worker terminal. Backed up Nginx under /var/backups/tagioo-alurkohv-20261013/nginx-before.tar.gz. Tested isolated loopback routing against throwaway review container on 8225 (health 200), then removed test listener.
- Restored only /etc/nginx/sites-available/tagioo.alurkohv.com + enabled symlink, port 8203 proxy, dedicated alurkohv logs, working existing first-party loader stanza and ACME webroot. Issued valid Let's Encrypt certificate expiring January 11, 2027; installed domain-specific certificate renewal deploy hook to syntax-check/reload Nginx. Nginx checks passed before reloads. No container restarts, GTM publishing or customer purchase events.
- Restored original WordPress Custom Loader checkbox. Public source again points to first-party loader. HTTPS health, gtm.js and gtag/js return 200 with normal TLS validation; fresh browser inserted first-party GA4 library without console errors. Fresh Tag Assistant found GTM-P9DMZG7T and G-85ZC4NM8FW; GA4 Config, page_view and Meta Pixel Base fired. Existing Amolbooks health also 200. Screenshot artifacts/alurkohv-tagassistant-fixed.png captured after closing temporary debug popup, hence its Not Connected notice; successful detected tags/event history remain visible.
- Live incident fixed operationally; no plugin/backend source code change needed. Local status note not committed. Real purchase/destination acceptance still requires end-to-end verification; missing vhost's historical cause not determined.

## 2026-10-13 — Follow-up domain audit and incident explanation

- Read-only HTTPS /healthz audit of 13 known tracking domains: 11 return 200 (including repaired Alurkohv and Amolbooks); server.zenovacarebd.xyz returns 502; server.happinessbd.com fails DNS lookup. These results are reachability checks, not destination-delivery proof or a complete active-account inventory. Inactive/stopped accounts may explain the two exceptions; no changes made to them.
- Identified candidate lifecycle risk in deleteProvisionedContainer: domain Nginx cleanup/certificate deletion run even if Docker shutdown/removal failed. Fits live Docker plus missing vhost/cert, but incident's actual removal event remains unproven without production deletion/provisioning audit history. Local history has no Alurkohv record.
- Existing customer Run tracking test performs HTTPS collection and reports DNS/SSL connection failures; past saved green checks are historical, not ongoing domain health. Customer recovery should escalate worker-side route/TLS failures to support; source-only public checker cannot repair host infrastructure. No code/config changes in follow-up.

## 2026-10-13 — Failed tracking check support draft

- Customer tracking test failures now offer Create support ticket with reported failed checks, selected container, tracking domain and test timestamp prefilled in the existing support form. Saved failures and incomplete API/network tests also offer escalation; passing checks do not. Customer reviews and submits manually.
- Preserve existing subject/message drafts, avoid duplicate diagnostic blocks, and leave oversized drafts intact with guidance. Ignore test responses after switching containers. Copy distinguishes reported errors from a confirmed root cause. No infrastructure changes or live conversion tests performed.
- App asset version bumped to 113. Three focused support-draft tests, frontend syntax, npm run check and diff checks pass. Local changes only; not pushed/deployed.

## 2026-10-15 — Container and platform video guides

- Embedded the supplied container setup video in the Container guide and WooCommerce/Shopify video in Setup Guide, with YouTube fallback links and responsive existing video styles.
- Moved DNS screenshot below step 1 and Container Config screenshot below step 2. Added Copy beside the displayed DNS target with accessible success/blocked feedback. App asset bumped to v114.
- npm run check, frontend syntax, diff checks and guide ordering/image asset assertions pass. Browser playback and clipboard interaction not verified. Prepared for GitHub push; production deployment pending.

## 2026-10-15 — Compact Setup Guide video card

- Combined the platform video and introduction into one compact card titled “Check our setup guide”. Short copy and existing button styles sit beside a 280px-wide video; narrow screens stack the content while keeping the video capped.
- Removed the separate oversized video panel. Illustrated instructions and YouTube fallback remain available; Container tab unchanged. Styles cache bumped to v69.
- Backend/frontend syntax and diff checks pass. Browser layout/playback not verified. Prepared for GitHub push; production deployment pending.

## 2026-10-17 — Prepare three-day card subscription promotion

- Owner selected new card subscriptions only. Added Paddle trial access/status,
  authoritative trial end lookup, checkout polling support and verified catalog
  trial disclosures. Trial signup creates a trial receipt without paid purchase
  events or paid activation email; successful renewal clears trial status.
- Trial plan changes use do_not_bill; existing provider-managed cancellation and
  renewal paths retained. Manual/Shopify billing excluded. Existing price IDs,
  amounts, secrets and production configuration untouched.
- Added trial/replay/conversion/invalid-payload/no-charge plan change and checkout
  disclosure assertions; syntax and focused Paddle checks pass. Deployment,
  provider sandbox checkout/charge/cancel verification and three production
  price trial settings remain outstanding. Offer is NOT live. See
  docs/paddle-launch.md for activation and rollback. Existing user work preserved.

- Owner authorized live rollout on October 17. Preparing focused code deployment
  before provider price updates; keeping the operator-managed Preview pilot intact.

- Live key has price-read but no subscription-read permission. Replaced the
  subscription lookup with authoritative signed subscription.trialing activation;
  zero-value trial checkout waits for that event. Eight-event production webhook
  subscription saved; all three sandbox previews show zero today and regular
  monthly totals after trial. Fourteen focused checks pass.
