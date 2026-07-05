# CLAUDE.md

This repo shares one source of truth for all coding assistants.

**Read [AGENTS.md](AGENTS.md) and follow it.** It applies to Claude Code and Codex equally.

Also read before editing:
- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — architecture, stack, business rules, gotchas.
- [CURRENT_WORK.md](CURRENT_WORK.md) — current state, TODOs, what to avoid. Keep it updated after meaningful progress.

Quick reminders (full detail in AGENTS.md):
- Framework-free Node ≥20 monolith (`server.js`), only dep `better-sqlite3`. No new frameworks/deps unless asked.
- Run `npm run check` after `server.js` edits (only gate; no tests/lint/build).
- Don't touch live-tracking (Nginx / sGTM container lifecycle / `/g/collect`) blind.
- Bump `?v=` in `public/index.html` when editing `app.js`/`styles.css`/`tokens.css`.
