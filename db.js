// SQLite event store for the control panel.
//
// Raw tracking log lines are ingested here (from local nginx/per-container logs and
// from remote worker VPS agents) so event history survives log rotation and container
// restarts, and can be queried per tenant per day. Summaries shown on dashboards are
// built by running the exact same line aggregation the live tail path uses, so the
// numbers stay consistent between the two sources.
//
// Storage model:
//   event_lines      — one row per raw access-log line, tagged tenant/worker/date.
//                      tenant_id '' means "shared log, tenant resolved at query time
//                      via host matching" (mirrors the live tail behaviour).
//   ingest_cursors   — byte offset + inode per local log file so each tick only reads
//                      new bytes and survives logrotate (inode change resets offset).
//   ingested_batches — batch ids already accepted from worker agents, so at-least-once
//                      delivery from workers never double-counts events.
//   daily_summaries  — cached snapshot JSON for closed days (computed once, reused).

import Database from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS event_lines (
  id INTEGER PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT '',
  worker_id TEXT NOT NULL DEFAULT 'local',
  source TEXT NOT NULL DEFAULT '',
  date_key TEXT NOT NULL,
  line TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_event_lines_tenant_date ON event_lines (tenant_id, date_key);
CREATE INDEX IF NOT EXISTS idx_event_lines_date ON event_lines (date_key);

CREATE TABLE IF NOT EXISTS ingest_cursors (
  source TEXT PRIMARY KEY,
  inode INTEGER NOT NULL DEFAULT 0,
  offset INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS ingested_batches (
  batch_id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS daily_summaries (
  tenant_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (tenant_id, date_key)
);

CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'server',
  message TEXT NOT NULL,
  stack TEXT NOT NULL DEFAULT '',
  context TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs (created_at);
`;

export function openEventStore(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, "events.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);

  const insertLineStmt = db.prepare(
    "INSERT INTO event_lines (tenant_id, worker_id, source, date_key, line) VALUES (@tenantId, @workerId, @source, @dateKey, @line)"
  );
  const insertLinesTx = db.transaction((rows) => {
    for (const row of rows) insertLineStmt.run(row);
    return rows.length;
  });

  const getCursorStmt = db.prepare("SELECT inode, offset FROM ingest_cursors WHERE source = ?");
  const setCursorStmt = db.prepare(`
    INSERT INTO ingest_cursors (source, inode, offset, updated_at)
    VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(source) DO UPDATE SET inode = excluded.inode, offset = excluded.offset, updated_at = excluded.updated_at
  `);

  const hasBatchStmt = db.prepare("SELECT 1 FROM ingested_batches WHERE batch_id = ?");
  const markBatchStmt = db.prepare("INSERT OR IGNORE INTO ingested_batches (batch_id, worker_id) VALUES (?, ?)");

  const linesForDateStmt = db.prepare(
    "SELECT line FROM event_lines WHERE date_key = ? AND tenant_id IN (?, '') ORDER BY id"
  );
  const dateCountsStmt = db.prepare(`
    SELECT date_key AS dateKey, COUNT(*) AS total
    FROM event_lines
    WHERE tenant_id IN (?, '') AND date_key >= ?
    GROUP BY date_key
  `);
  const tenantDatesStmt = db.prepare(
    "SELECT DISTINCT date_key AS dateKey FROM event_lines WHERE tenant_id IN (?, '') AND date_key >= ? ORDER BY date_key"
  );

  const getSummaryStmt = db.prepare("SELECT payload FROM daily_summaries WHERE tenant_id = ? AND date_key = ?");
  const setSummaryStmt = db.prepare(`
    INSERT INTO daily_summaries (tenant_id, date_key, payload, computed_at)
    VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(tenant_id, date_key) DO UPDATE SET payload = excluded.payload, computed_at = excluded.computed_at
  `);

  const insertErrorLogStmt = db.prepare(
    "INSERT INTO error_logs (source, message, stack, context) VALUES (@source, @message, @stack, @context)"
  );
  const listErrorLogsStmt = db.prepare("SELECT * FROM error_logs ORDER BY id DESC LIMIT ?");
  const countErrorLogsStmt = db.prepare("SELECT COUNT(*) AS n FROM error_logs");
  const deleteErrorLogsStmt = db.prepare("DELETE FROM error_logs");
  const capErrorLogsStmt = db.prepare(
    "DELETE FROM error_logs WHERE id NOT IN (SELECT id FROM error_logs ORDER BY id DESC LIMIT ?)"
  );

  return {
    db,

    // rows: [{ tenantId, workerId, source, dateKey, line }]
    insertLines(rows) {
      if (!rows?.length) return 0;
      return insertLinesTx(rows);
    },

    getCursor(source) {
      return getCursorStmt.get(source) || { inode: 0, offset: 0 };
    },

    setCursor(source, inode, offset) {
      setCursorStmt.run(source, Number(inode) || 0, Number(offset) || 0);
    },

    hasBatch(batchId) {
      return Boolean(hasBatchStmt.get(batchId));
    },

    markBatch(batchId, workerId) {
      markBatchStmt.run(batchId, workerId || "");
    },

    // One-time backfill: re-key existing event_lines so date_key matches the
    // Dhaka calendar day derived from each line's own offset. Touches only the
    // analytics store (never the live nginx/sGTM tracking path). Guarded by a
    // sentinel cursor so it runs once; idempotent if forced (only updates
    // mismatches). Clears cached daily summaries so they recompute on the new keys.
    rekeyDateKeys(keyFromLine, { sentinel = "__migration_dhaka_datekey_v1" } = {}) {
      if (getCursorStmt.get(sentinel)) return { migrated: false, updated: 0, scanned: 0 };
      const selectAll = db.prepare("SELECT id, date_key, line FROM event_lines");
      const updateStmt = db.prepare("UPDATE event_lines SET date_key = ? WHERE id = ?");
      // Materialize first: better-sqlite3 forbids writing on a connection that
      // is mid-iteration over a live statement, so collect the changes, then apply.
      const changes = [];
      let scanned = 0;
      for (const row of selectAll.all()) {
        scanned += 1;
        const key = keyFromLine(row.line);
        if (key && key !== row.date_key) changes.push({ id: row.id, key });
      }
      const run = db.transaction(() => {
        for (const change of changes) updateStmt.run(change.key, change.id);
        db.prepare("DELETE FROM daily_summaries").run();
        return { updated: changes.length, scanned };
      });
      const result = run();
      setCursorStmt.run(sentinel, 1, 0);
      return { migrated: true, ...result };
    },

    // Tenant's own lines plus shared-log lines (tenant resolved later by host match).
    linesForTenantDate(tenantId, dateKey) {
      return linesForDateStmt.all(dateKey, tenantId || "").map((row) => row.line);
    },

    dateCountsForTenant(tenantId, fromDateKey) {
      const counts = {};
      for (const row of dateCountsStmt.all(tenantId || "", fromDateKey)) counts[row.dateKey] = row.total;
      return counts;
    },

    tenantDates(tenantId, fromDateKey) {
      return tenantDatesStmt.all(tenantId || "", fromDateKey).map((row) => row.dateKey);
    },

    getDailySummary(tenantId, dateKey) {
      const row = getSummaryStmt.get(tenantId || "", dateKey);
      if (!row) return null;
      try {
        return JSON.parse(row.payload);
      } catch {
        return null;
      }
    },

    setDailySummary(tenantId, dateKey, snapshot) {
      setSummaryStmt.run(tenantId || "", dateKey, JSON.stringify(snapshot));
    },

    // Owner-facing error log (server exceptions + reported client-side JS errors).
    // Capped at insert time so a repeating bug can't grow this table unbounded.
    insertErrorLog({ source, message, stack, context }, keepMax = 500) {
      insertErrorLogStmt.run({
        source: String(source || "server").slice(0, 20),
        message: String(message || "").slice(0, 2000),
        stack: String(stack || "").slice(0, 8000),
        context: String(context || "").slice(0, 2000)
      });
      capErrorLogsStmt.run(keepMax);
    },

    listErrorLogs(limit = 200) {
      return listErrorLogsStmt.all(limit);
    },

    countErrorLogs() {
      return countErrorLogsStmt.get().n;
    },

    clearErrorLogs() {
      return deleteErrorLogsStmt.run().changes;
    },

    prune(retentionDays, batchRetentionDays = 7) {
      const cutoff = isoDateKeyDaysAgo(retentionDays);
      const lines = db.prepare("DELETE FROM event_lines WHERE date_key < ?").run(cutoff).changes;
      const summaries = db.prepare("DELETE FROM daily_summaries WHERE date_key < ?").run(cutoff).changes;
      const batchCutoff = new Date(Date.now() - batchRetentionDays * 86400000).toISOString();
      const batches = db.prepare("DELETE FROM ingested_batches WHERE received_at < ?").run(batchCutoff).changes;
      return { cutoff, lines, summaries, batches };
    },

    stats() {
      return {
        lines: db.prepare("SELECT COUNT(*) AS n FROM event_lines").get().n,
        tenants: db.prepare("SELECT COUNT(DISTINCT tenant_id) AS n FROM event_lines WHERE tenant_id != ''").get().n,
        oldestDate: db.prepare("SELECT MIN(date_key) AS d FROM event_lines").get().d,
        newestDate: db.prepare("SELECT MAX(date_key) AS d FROM event_lines").get().d,
        summaries: db.prepare("SELECT COUNT(*) AS n FROM daily_summaries").get().n
      };
    },

    close() {
      db.close();
    }
  };
}

function isoDateKeyDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - Number(days || 0));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
