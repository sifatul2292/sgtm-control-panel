# CURRENT_WORK — SGTM Control Panel (Tagioo)

Living status doc. Update after meaningful progress. Last updated: 2026-08-09.

## Current branch
`feat/saas-phase1-payments` (main branch is `main`).

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
