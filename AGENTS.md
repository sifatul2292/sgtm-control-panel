# AGENTS.md — Instructions for coding assistants (Claude Code, Codex, etc.)

Shared source of truth for anyone (human or AI) editing this repo.

## Before editing
1. Read **PROJECT_CONTEXT.md** (architecture, stack, business rules, gotchas) and **CURRENT_WORK.md** (current state, TODOs, what to avoid).
2. Run `git status` and `git diff` on relevant files. Inspect the diff before changing anything.
3. Preserve existing user work — never overwrite unrelated changes or revert in-progress edits.

## While editing
- Follow existing code style, architecture, naming. This is a **framework-free Node monolith**: `server.js` uses a manual `if (pathname === … && req.method === …)` route chain, ES modules, no Express, only `better-sqlite3` as a dep. Match that — do not introduce frameworks, build steps, or new dependencies without being asked.
- Keep changes **focused and minimal**. No drive-by refactors of the 10k-line `server.js`.
- Static frontend is hand-written HTML/CSS/JS in `public/`. Bump the `?v=` asset query in `public/index.html` when you edit `app.js` / `styles.css` / `tokens.css` (assets served immutable).
- Keep `history.json` writes atomic (temp file + `rename`). Keep date math Asia/Dhaka offset-based.
- Never commit secrets; `.env` is gitignored. Use placeholder values in docs.

## Do NOT touch blind
Live-tracking layers move real customer conversions:
- Nginx config, sGTM container lifecycle, `/g/collect` purchase recovery, worker ingest.
Test those off a throwaway tenant, not prod. Panel/billing/UI changes are safe to iterate on.

## After editing
- Run `npm run check` (`node --check server.js`) — the only automated gate. No test/lint/build tooling exists.
- If you added pure helpers, a `node --test` smoke test is welcome (no framework needed).
- Don't regress owner-dashboard perf (no per-tenant log scans / extra `history.json` parses on the read path).
- **Update CURRENT_WORK.md** after meaningful progress (what changed, why, what's next).

## Reference
- SaaS rules: `docs/saas-plan.md`. Event store: `docs/event-store.md`. VPS: `docs/tagioo-vps-setup.md`. Nginx log format: `docs/nginx-sgtm-log.md`.
