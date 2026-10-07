import Database from "better-sqlite3";
import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { protectText, unprotectText } from "./data-protection.js";

// Separate, small durable store: webhook receipt must not parse history.json.
export function openPaddleInbox(dataDir, key = "") {
  mkdirSync(dataDir, { recursive: true });
  const path = join(dataDir, "paddle-inbox.db");
  const db = new Database(path);
  chmodSync(path, 0o600);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.pragma("busy_timeout = 1000");
  db.exec(`CREATE TABLE IF NOT EXISTS paddle_inbox (
    event_id TEXT PRIMARY KEY, digest TEXT NOT NULL, payload BLOB,
    status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
    due_at INTEGER NOT NULL DEFAULT 0, received_at INTEGER NOT NULL,
    completed_at INTEGER, last_error TEXT NOT NULL DEFAULT ''
  ); CREATE INDEX IF NOT EXISTS paddle_inbox_due ON paddle_inbox(status, due_at);`);
  return {
    accept(raw) {
      const event = JSON.parse(raw.toString());
      if (!/^evt_[a-z0-9]+$/i.test(event.event_id || "") || !Number.isFinite(Date.parse(event.occurred_at))) {
        throw new Error("Invalid Paddle event identity or timestamp.");
      }
      // Replays have a new notification_id but retain the same event identity.
      const digest = createHash("sha256").update(JSON.stringify({ event_id: event.event_id,
        occurred_at: event.occurred_at, event_type: event.event_type, data: event.data })).digest("hex");
      const existing = db.prepare("SELECT digest FROM paddle_inbox WHERE event_id=?").get(event.event_id);
      if (existing) {
        if (existing.digest !== digest) throw new Error("Conflicting Paddle event payload.");
        return { duplicate: true };
      }
      db.prepare("INSERT INTO paddle_inbox(event_id,digest,payload,received_at) VALUES(?,?,?,?)")
        .run(event.event_id, digest, protectText(raw.toString(), key), Date.now());
      return { duplicate: false };
    },
    claim(now = Date.now()) {
      return db.transaction(() => {
        const row = db.prepare("SELECT * FROM paddle_inbox WHERE status != 'done' AND due_at <= ? ORDER BY received_at,event_id LIMIT 1").get(now);
        if (!row) return null;
        db.prepare("UPDATE paddle_inbox SET status='processing',attempts=attempts+1,due_at=? WHERE event_id=?").run(now + 60000, row.event_id);
        return { id: row.event_id, event: JSON.parse(unprotectText(row.payload, key).toString()), attempts: row.attempts + 1 };
      })();
    },
    complete(id) {
      db.prepare("UPDATE paddle_inbox SET status='done',payload=NULL,completed_at=?,last_error='' WHERE event_id=?").run(Date.now(), id);
    },
    retry(id, attempts, message) {
      // Never discard a billing event after a fixed number of failures.
      db.prepare("UPDATE paddle_inbox SET status='pending',due_at=?,last_error=? WHERE event_id=?")
        .run(Date.now() + Math.min(300000, 1000 * 2 ** Math.min(attempts, 8)), String(message).slice(0, 240), id);
    },
    stats() {
      return db.prepare("SELECT status,count(*) AS count FROM paddle_inbox GROUP BY status").all();
    },
    close() { db.close(); }
  };
}
