# SQLite Event Store

Raw tracking log lines are persisted to `data/events.db` (SQLite, WAL mode) so event
history survives nginx logrotate and sGTM container restarts, supports the 30-day
dashboard window exactly, and scales to hundreds of tenants across multiple VPSes.

## How it works

```
worker VPS 1..N                          panel VPS
┌──────────────────────┐                ┌─────────────────────────────────────┐
│ sGTM containers      │                │ nginx / per-container access logs   │
│ per-container logs   │                │        │ (byte-offset tail, 60s)    │
│        │             │   HMAC POST    │        ▼                            │
│ worker-agent.mjs ────┼───────────────▶│ /api/worker/ingest ──▶ events.db    │
└──────────────────────┘                │                          │          │
                                        │ dashboards ◀── daily snapshots ─────┘
                                        └─────────────────────────────────────┘
```

- **Local ingest** (panel VPS): every `INGEST_INTERVAL_MS` (default 60s) the panel
  reads new bytes from the shared nginx log and every per-container access log,
  using byte-offset cursors. Logrotate is detected by inode change / file shrink.
  Only tracking-path lines are stored (`TRACKING_PATHS`); bot scans are skipped.
- **Remote ingest** (worker VPSes): `worker-agent.mjs` ships new lines to
  `POST /api/worker/ingest`, signed with HMAC-SHA256 over the raw body using the
  shared `WORKER_INGEST_SECRET`. Delivery is at-least-once; the panel dedupes by
  `batchId`, so retries never double-count.
- **Dashboards**: per-tenant daily snapshots are rebuilt from stored lines with the
  same aggregation as the live log tail (`aggregateTrackingLines`), so numbers match.
  Closed days are computed once and cached in `daily_summaries`. Per date the
  dashboard keeps whichever source (SQLite vs history.json/live tail) saw more events.
- **Retention**: lines and cached summaries older than `EVENT_RETENTION_DAYS`
  (default 35 = 30-day window + buffer) are pruned once a day.
- **Fallback**: if `better-sqlite3` fails to load, the panel logs a warning and keeps
  running on the old log-tail + `history.json` path. The dashboard never goes down
  because of the event store.

## Panel setup

```bash
npm install                     # builds/downloads better-sqlite3
echo 'WORKER_INGEST_SECRET=<long random string>' >> .env   # only needed for remote workers
pm2 restart sgtm-control-panel
```

Optional env vars:

| Var | Default | Meaning |
|-----|---------|---------|
| `EVENT_RETENTION_DAYS` | 35 | Days of raw event lines kept |
| `INGEST_INTERVAL_MS` | 60000 | Local log ingest tick |
| `INGEST_MAX_BYTES_PER_TICK` | 5242880 | Read cap per file per tick |
| `WORKER_INGEST_SECRET` | (unset) | Shared secret for worker agents; endpoint returns 503 while unset |

## Worker VPS setup

```bash
# copy worker-agent.mjs to the worker, then:
mkdir -p /etc/tagioo /var/lib/tagioo
cat > /etc/tagioo/worker-agent.json <<'EOF'
{
  "panelUrl": "https://panel.yourdomain.com",
  "workerId": "worker-eu-1",
  "secret": "<same as WORKER_INGEST_SECRET>",
  "intervalSeconds": 60,
  "logs": [
    { "tenantId": "<tenant id>", "path": "/root/sgtm-instances/<tenant>/sgtm-access.log" }
  ]
}
EOF
pm2 start /root/worker-agent.mjs --name tagioo-worker-agent
pm2 save
```

Add one `logs[]` entry per container on that worker. The agent keeps its read
cursors in `/var/lib/tagioo/worker-agent-state.json` and survives restarts and
log rotation without losing or duplicating lines.

## Operations

- Inspect: `sqlite3 data/events.db 'SELECT tenant_id, date_key, COUNT(*) FROM event_lines GROUP BY 1,2 ORDER BY 2 DESC LIMIT 20;'`
- Backup: copy `data/events.db` (plus `-wal`/`-shm` files) or use `sqlite3 data/events.db '.backup events-backup.db'`.
- The store is additive: deleting `events.db` loses retained history but breaks
  nothing — the panel falls back to live log tails and `history.json` snapshots.
