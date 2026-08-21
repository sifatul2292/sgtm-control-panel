# PROJECT_CONTEXT — SGTM Control Panel (Tagioo)

Source of truth for architecture and conventions. Read before editing. Facts here are drawn only from this repo.

## What it is / who it's for
Tagioo — a control panel + dashboard for a **server-side Google Tag Manager (sGTM)** hosting service. Runs as a managed multi-tenant SaaS: an owner operates one or more VPS "workers" running per-customer sGTM Docker containers; customers get a dashboard, setup wizard, tracking health, billing, and integration guidance.

Two audiences in one app:
- **Owner** (admin) — sees all tenants, containers, provisioning, payments, worker capacity.
- **Customer** (tenant) — sees only own container: setup assistant, tracking status, usage, billing, offline conversions.

Started as a **read-only** dashboard; has grown container lifecycle + provisioning + SaaS billing.

## Tech stack
- **Runtime:** Node.js **>= 20**, ES modules (`"type": "module"`).
- **HTTP:** Node built-in `node:http` — **no Express/framework**. Single `createServer` with a long manual `if (pathname === ... && req.method === ...)` route chain in `server.js`.
- **Only npm dependency:** `better-sqlite3` (^11.10.0).
- **Frontend:** hand-written static HTML/CSS/JS in `public/` (no build step, no framework). `public/app.js`, `public/styles.css`, `public/tokens.css`.
- **Package manager:** npm (has `package-lock.json`).
- **Process manager:** pm2 (`ecosystem.config.cjs`).
- No TypeScript, no bundler, no test framework, no linter/formatter config present.

## Install / run / checks
```bash
npm install              # installs better-sqlite3
cp .env.example .env      # then edit values
npm start                # = node server.js  (serves on HOST:PORT, default 127.0.0.1:3000)
npm run check            # = node --check server.js  (syntax check only — the ONLY check that exists)
```
- **Tests:** none in repo. **Lint/format/typecheck/build:** none configured. `npm run check` (syntax) is the sole automated gate.
- After editing `server.js`, always run `npm run check`.

## Deployment
- Production VPS runs under **pm2** via `ecosystem.config.cjs` (app name `sgtm-control-panel`, logs to `/var/log/sgtm-control-panel*.log`, autorestart w/ backoff).
- Fronted by **Nginx** (reverse proxy + SSL via certbot). App reads Nginx access/error logs for its dashboards.
- VPS specifics in `docs/tagioo-vps-setup.md`. Per project memory: app path `/var/www/tagioo`, port 3100 in prod, Docker containers per tenant.
- **Watchdog:** `tagioo-watchdog.sh` — restarts silently-exited sGTM containers (see project memory "Recurring no-events issue").
- **Worker agent:** `worker-agent.mjs` ships remote-VPS sGTM access-log lines to the panel's `/api/worker/ingest` (HMAC-signed, at-least-once, dedup by batchId). Runs under pm2 on each worker VPS with config at `/etc/tagioo/worker-agent.json`.

## Important files / dirs
- `server.js` (~9.9k lines) — **entire backend**: routing, auth, dashboard build, provisioning, billing/payments, email, tracking aggregation, static serving. Monolith by design.
- `db.js` — SQLite event store (schema + queries). Raw log lines, ingest cursors, batch dedup, daily summaries, error logs.
- `public/` — static site: app dashboard (`index.html`/`app.js`), landing + marketing pages (`landing.html`, `features.html`, `pricing.html`, `compare.html`, `how-it-works.html`, `docs.html`, `terms.html`, `privacy.html`), `login.css`.
- `data/` — runtime state (gitignored data): `history.json` (main JSON DB), `events.db*` (SQLite), `history.json` backups, `provisioning/`.
- `docs/` — `saas-plan.md`, `event-store.md`, `nginx-sgtm-log.md`, `tagioo-vps-setup.md`, `shobaz-server-side-purchase.md`.
- `tagioo-woocommerce.php` — companion WordPress/WooCommerce plugin (server-side purchase hits).
- `.env.example` — full config surface (large).
- `ecosystem.config.cjs`, `tagioo-watchdog.sh`, `worker-agent.mjs`.

## Architecture / data flow
- **Two data stores:**
  1. **`data/history.json`** — main app state: a JSON object with `data.tenants[]` and `data.payments[]` (+ settings/history). Read via `readDatabase()` / cached `readDatabaseCached()` (~5s TTL), written via `writeDatabase()` which writes a temp file then `rename()`s atomically. Backups snapshotted to `data/backups/`.
  2. **`data/events.db`** (SQLite, WAL) — raw sGTM access-log lines per tenant/day, ingest cursors (byte offset + inode, survives logrotate), worker batch dedup, cached `daily_summaries`, `error_logs`. See `docs/event-store.md`.
- **Event ingestion:** a timer tick reads new bytes from local Nginx/container logs (cursor-based) + accepts remote worker batches → `event_lines`. Dashboard summaries recompute using the **same line-aggregation** as the live tail so numbers stay consistent.
- **Dashboard build:** owner dashboard is cached (stale-while-revalidate, warm-on-start, non-blocking invalidate) — recent commits are perf work to make it instant; DB reads deduped into one parse per build. Be careful preserving this when touching the read path.
- **Timezone:** all day boundaries pinned to **Asia/Dhaka** via per-line offset math (not `process.env.TZ`) so correct on a UTC host.

## Auth
- Env-driven basic session auth (`AUTH_ENABLED`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SECRET`). Owner login.
- Customers have accounts (email-verified signup, password reset): routes `/signup`, `/verify`, `/login`, `/forgot-password`, `/reset-password`. Customer session scopes API to their own tenant.
- Session via signed cookie (HMAC with `AUTH_SECRET`).

## API surface (all in server.js route chain)
Manual `pathname === "…" && req.method === "…"` matching. Key groups:
- Public/auth: `/`, `/login`, `/signup`, `/verify`, `/forgot-password`, `/reset-password`, `/logout`, `/api/session`.
- Ingest: `POST /api/worker/ingest` (HMAC), `POST /api/orders/webhook`, `POST /api/orders/woocommerce`.
- Customer: `/api/customer/setup`, `/webhook-secret`, `/setup-assistant/templates`, `/setup-assistant/plugin`, `/offline-conversions`, `/verify-tracking`, `/cookie-extension`, `/subscription`, `/billing`, `/payment-claim`, `/me` (GET/PATCH), `/me/password`.
- Owner/admin: `/api/customer-accounts`, provisioning (`/api/provisioning/checks`), payments confirm, tenant CRUD, worker capacity.

## Analytics / server-side tagging (domain)
- Core product = sGTM. Purchase recovery uses sGTM gtag path **`/g/collect`** (never `/mp/collect` — sGTM 400s on MP). Fires GA4 + Meta CAPI, dedup on `transaction_id`.
- GA4 events must send explicit `page_location` + `page_title` or sGTM defaults to homepage.
- Meta CAPI fires on the always-on GA4-client trigger → full funnel server-side, first-party.
- Brave first-party loader: gtm.js served first-party + Nginx `sub_filter` rewrite of `www.googletagmanager.com` → `/tagioo-loader`.
- `TRACKING_PATHS` env decides which request paths count as events (loader paths excluded). `TRACKING_HOSTS` filters shared-Nginx noise.

## Required env vars (safe placeholders — see `.env.example` for full list)
```
PORT=3000
HOST=127.0.0.1
AUTH_ENABLED=true
AUTH_USERNAME=admin
AUTH_PASSWORD=change-this-password
AUTH_SECRET=change-this-long-random-secret
SERVICE_NAME=Tagioo
PUBLIC_BASE_URL=https://example.com
TENANT_ID=default
CUSTOMER_SUPPORT_EMAIL=support@example.com
BILLING_PLAN=Starter
MONTHLY_REQUEST_LIMIT=100000
NGINX_ACCESS_LOG=/var/log/nginx/access.log
NGINX_ERROR_LOG=/var/log/nginx/error.log
SSL_DOMAIN=example.com
DATA_DIR=./data
WORKER_INGEST_SECRET=change-me            # HMAC secret shared with worker-agent
ORDER_WEBHOOK_SECRET=change-me            # store order webhook
PROVISION_DNS_TARGET=bd.example.com
AUTO_LAUNCH_ENABLED=true                  # owner auto-launches customer containers
LOCAL_WORKER_ID=worker-1
```
Never commit real secrets. `.env` is gitignored.

## Product flows / business rules (see docs/saas-plan.md)
- **Not licensed → no payment gateway.** Payment is **manual bKash/Nagad**, confirmed by owner in admin.
- Tiers: **Free ৳0 / 15,000 events per rolling 30-day cycle** (permanent, not a trial), Starter ৳1,200 / 500K, Pro ৳2,900 / 2M, Enterprise ৳5,900 / 5M.
- `subscriptionStatus`: `free`, `free_capped` (hit 15K → container **stopped**), `pending_payment`, `active`, `overdue` (grace), `expired` (stopped). `paymentStatus`: `free|pending|paid|rejected`.
- Free enforcement: **hard stop at 15K, nudge at 12K** (once per cycle). Paid plans run 30 days from owner-confirm.
- **Payment claim flow:** customer submits txn → owner emailed → customer emailed "verifying" → owner confirms in Admin → Payments → customer emailed "active" (or "rejected").
- Setup Assistant renders **only for customer session** (owner-view screenshots miss bugs). Watch curly quotes in attrs breaking template parse.

### Paddle (US/international card checkout — parallel rail, not a replacement)
- **Second payment rail alongside manual bKash/Nagad**, not instead of it. bKash/Nagad stays for BD customers; Paddle is Starter/Growth/Pro ($30/$50/$100 USD monthly) for everyone else. Both write to the same `payments[]`/tenant shape — differentiated by `payment.provider` / `tenant.paymentProvider` (`"manual"` vs `"paddle"`).
- **No SDK.** Native `fetch` + `node:crypto` only — matches the framework-free rule. Paddle.js loads client-side via `<script src="https://cdn.paddle.com/paddle/v2/paddle.js">` in `checkoutPage()`, not an npm package.
- **Environment switch is one var:** `PADDLE_ENV` (`sandbox` | `production`) picks `PADDLE_SANDBOX_API_KEY` vs `PADDLE_LIVE_API_KEY` in `config.paddleApiKey`, and gates `Paddle.Environment.set("sandbox")` client-side. Never hardcode which environment — always branch on `config.paddleEnv`.
- **Webhook verification:** `isPaddleWebhookAuthorized()` — Paddle signs `"{ts}:{rawBody}"` with `PADDLE_WEBHOOK_SECRET` (HMAC-SHA256), sent as `Paddle-Signature: ts=...;h1=...`. Must run against the **raw body bytes** (`readRawBody`, not `readJson`) before any parsing — same pattern as the existing WooCommerce webhook.
- **Idempotency is mandatory, not optional.** Paddle retries webhook delivery on any non-2xx. `activatePaddleTenant()` dedupes on `paddleTransactionId` against `data.payments[]` before touching tenant state — never activate/charge-side-effect without that check.
- **Paddle owns renewal/dunning for its tenants.** `enforcePaidRenewals()` explicitly skips `paymentProvider === "paddle"` — don't let the manual-flow overdue/expire sweep touch a Paddle subscription; Paddle's own webhooks (`subscription.canceled`/`.paused`) are the only thing allowed to change a Paddle tenant's status outside a payment event.
- **Confirm before, don't just build:** switching `PADDLE_ENV` from sandbox to production, rotating `PADDLE_LIVE_API_KEY`/`PADDLE_WEBHOOK_SECRET`, or changing which price ID maps to which plan (`paddleUsdMonthly`, `PADDLE_PRICE_ID_*`) are money-affecting — flag and confirm with the owner before changing, don't silently swap them mid-task.
- **Real secrets (`PADDLE_*_API_KEY`, `PADDLE_WEBHOOK_SECRET`) go in the VPS `.env`, never in chat, never committed.** `PADDLE_CLIENT_TOKEN` and the price IDs are client-exposed by design, safe to share/commit as placeholders in `.env.example`.

## UI / design conventions
- Design tokens in `public/tokens.css`; shared styles `public/styles.css`. Enterprise dark theme, brand purple (`#5B21B6`), BDT `৳` currency.
- Static HTML pages, inline-styled transactional emails built as HTML strings in `server.js`.
- **Asset versioning gotcha:** static JS/CSS served **immutable**. MUST bump `?v=` query in `public/index.html` on every `app.js` / `styles.css` / `tokens.css` edit or users get stale cached assets.

## Major decisions
- Framework-free monolith (`server.js`) — zero server deps beyond SQLite, easy to deploy on a small VPS.
- Dual store (JSON for entities, SQLite for high-volume event lines) — JSON stays human-editable; SQLite handles log volume + survives rotation.
- Manual payments — forced by lack of gateway license.
- Panel/billing/UI changes are safe to deploy freely; **only Nginx + container lifecycle + sGTM touch live tracking**.

## Constraints / risks / fragile areas
- `server.js` is a **~10k-line monolith** — large surface, no test coverage. Change carefully; run `npm run check`.
- **Live tracking is fragile:** Nginx config, container lifecycle, and sGTM changes affect real customer conversions. Test those off a throwaway/amolbooks tenant first, not in prod blind.
- sGTM never claims Measurement Protocol → `/mp/collect` returns 400. Use `/g/collect` gtag format.
- Dashboard perf: recent commits optimized owner dashboard to be instant (cache + serve-stale + single parse). Don't reintroduce per-tenant log scans or duplicate `history.json` parses on the read path.
- `history.json` writes are atomic (temp + rename); keep that pattern — no in-place partial writes.
- Curly/smart quotes in HTML attribute templates break parsing and plugin download.
- Timezone must stay Asia/Dhaka offset-based, not host TZ.
