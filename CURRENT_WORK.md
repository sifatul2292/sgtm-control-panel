# CURRENT_WORK — SGTM Control Panel (Tagioo)

Living status doc. Update after meaningful progress. Last updated: 2026-08-04.

## Current branch
`feat/saas-phase1-payments` (main branch is `main`).

## Recently completed
Recent commits (newest first, Jul 4–7):
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
