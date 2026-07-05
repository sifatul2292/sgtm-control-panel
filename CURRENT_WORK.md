# CURRENT_WORK — SGTM Control Panel (Tagioo)

Living status doc. Update after meaningful progress. Last updated: 2026-07-05.

## Current branch
`feat/saas-phase1-payments` (main branch is `main`).

## Recently completed
Recent commits (newest first):
- **Owner dashboard perf** (5 commits): cache payload stale-while-revalidate; drop per-tenant Nginx log scan; dedupe DB reads (one `history.json` parse, db stage 3.5s → ~1 parse); move history persistence off read path; warm-on-start + serve-stale + non-blocking invalidate; widen DB read-cache TTL to 5s so dashboard catalog reuses the parse.
- **SaaS Phase 1 payments** (`0c97c3c`, `9026cfd`): payment paywall, one-click owner confirm, auto-refresh, upgrade nudge, customer admin; email-verified signup + paid-plan payment gate.
- **Tagioo self-tracking** (`d0b7b8c`, `725d61c`, `a5b0553`, `5468976`, `b91c9f1`): own GTM + funnel conversion events, hashed-PII Meta CAPI for signup + purchase, Lead event on signup visit, GTM snippet on server-rendered signup/login.
- **Setup Assistant + UI** (`f9a0b32`, `51bc2d8`, `0a4e945` …): Setup Assistant polish, Containers onboarding redesign, enterprise dark redesign + billing cycles.

## In progress
- SaaS payments phase 1 on this branch. Manual bKash/Nagad claim → owner-confirm lifecycle wired (emails + routes exist). Verify remaining lifecycle states from `docs/saas-plan.md` are fully enforced (esp. free-tier 15K cap → container stop, and rolling-cycle usage window).

## Files recently changed / why
- `server.js` — payments, self-tracking, dashboard perf caching, provisioning. Main monolith; most churn here.
- `db.js` — SQLite event store schema/queries.
- `public/*` — landing/marketing redesign, Setup Assistant, billing UI.
- `docs/saas-plan.md` — monetization spec (DRAFT, 2026-06-27).
- Untracked at doc-writing time: `.claude/`, `PROJECT_CONTEXT.md`, `CURRENT_WORK.md`, `AGENTS.md`, `CLAUDE.md` (these onboarding docs).

## Known gaps / TODO (from docs/saas-plan.md)
- Rolling 30-day usage cycle (`cycleStart`/`cycleEnd`) — plan says switch Free-tier counting from calendar-month (`server.js:4951` area) to rolling window. Confirm implemented.
- 12K nudge (once/cycle via `nudgedAt`) + 15K hard stop (`free_capped` → stop container). Confirm enforced by a daily cron tick.
- Overdue → grace → expired suspension transitions.
- No automated tests anywhere.

## Commands run + results
- `node --check server.js` (`npm run check`) — syntax gate. Run this after every `server.js` edit.
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
