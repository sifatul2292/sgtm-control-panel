#!/usr/bin/env node
// Tagioo worker agent — ships sGTM access-log lines from a worker VPS to the
// control panel's SQLite event store. Zero dependencies; runs under pm2:
//
//   pm2 start worker-agent.mjs --name tagioo-worker-agent
//
// Configuration: /etc/tagioo/worker-agent.json (or WORKER_AGENT_CONFIG env):
// {
//   "panelUrl": "https://panel.example.com",
//   "workerId": "worker-eu-1",
//   "secret": "<same value as WORKER_INGEST_SECRET on the panel>",
//   "intervalSeconds": 60,
//   "logs": [
//     { "tenantId": "tenant-abc", "path": "/root/sgtm-instances/tenant-abc/sgtm-access.log" },
//     { "tenantId": "tenant-def", "path": "/root/sgtm-instances/tenant-def/sgtm-access.log" }
//   ]
// }
//
// Delivery is at-least-once: the byte cursor only advances after the panel
// acknowledges the batch, and the panel deduplicates by batchId, so a retried
// batch after a network failure never double-counts events.

import { createHmac, randomUUID } from "node:crypto";
import { open, readFile, rename, stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const CONFIG_PATH = process.env.WORKER_AGENT_CONFIG || "/etc/tagioo/worker-agent.json";
const STATE_PATH = process.env.WORKER_AGENT_STATE || "/var/lib/tagioo/worker-agent-state.json";
const MAX_LINES_PER_BATCH = 5000;
const MAX_BYTES_PER_TICK = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30000;

async function loadConfig() {
  const raw = await readFile(CONFIG_PATH, "utf8");
  const config = JSON.parse(raw);
  for (const key of ["panelUrl", "workerId", "secret"]) {
    if (!config[key]) throw new Error(`worker-agent config missing "${key}" (${CONFIG_PATH})`);
  }
  if (!Array.isArray(config.logs) || !config.logs.length) {
    throw new Error(`worker-agent config has no "logs" entries (${CONFIG_PATH})`);
  }
  return config;
}

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8"));
  } catch {
    return { cursors: {} };
  }
}

async function saveState(state) {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  const tmp = `${STATE_PATH}.tmp`;
  await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(tmp, STATE_PATH);
}

async function postBatch(config, body) {
  const payload = JSON.stringify(body);
  const signature = createHmac("sha256", config.secret).update(payload).digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("/api/worker/ingest", config.panelUrl), {
      method: "POST",
      headers: { "content-type": "application/json", "x-worker-signature": signature },
      body: payload,
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`panel responded ${response.status}: ${text.slice(0, 300)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Read complete new lines from the log since the cursor. Inode change or shrink
// means logrotate replaced the file, so reading restarts at byte 0.
async function readNewLines(logPath, cursor) {
  const fileStat = await stat(logPath).catch(() => null);
  if (!fileStat) return null;
  let offset = Number(cursor?.offset) || 0;
  if (Number(cursor?.inode) !== Number(fileStat.ino) || fileStat.size < offset) offset = 0;
  if (fileStat.size === offset) return { lines: [], inode: fileStat.ino, offset };
  const handle = await open(logPath, "r");
  try {
    const toRead = Math.min(fileStat.size - offset, MAX_BYTES_PER_TICK);
    const buffer = Buffer.alloc(toRead);
    const { bytesRead } = await handle.read(buffer, 0, toRead, offset);
    const chunk = buffer.subarray(0, bytesRead).toString("utf8");
    const lastNewline = chunk.lastIndexOf("\n");
    if (lastNewline === -1) return { lines: [], inode: fileStat.ino, offset };
    const consumed = Buffer.byteLength(chunk.slice(0, lastNewline + 1), "utf8");
    const lines = chunk.slice(0, lastNewline).split("\n").map((line) => line.trim()).filter(Boolean);
    return { lines, inode: fileStat.ino, offset: offset + consumed };
  } finally {
    await handle.close();
  }
}

let ticking = false;
async function tick(config, state) {
  if (ticking) return;
  ticking = true;
  try {
    for (const log of config.logs) {
      const cursorKey = log.path;
      const result = await readNewLines(log.path, state.cursors[cursorKey]);
      if (!result) continue;
      if (!result.lines.length) {
        state.cursors[cursorKey] = { inode: result.inode, offset: result.offset };
        continue;
      }
      // Ship in capped batches; cursor advances only after the panel acknowledges,
      // so a crash or network failure replays the batch (panel dedupes by batchId).
      for (let start = 0; start < result.lines.length; start += MAX_LINES_PER_BATCH) {
        const lines = result.lines.slice(start, start + MAX_LINES_PER_BATCH);
        const response = await postBatch(config, {
          workerId: config.workerId,
          batchId: randomUUID(),
          tenantId: log.tenantId || "",
          source: `${config.workerId}:${log.path}`,
          lines
        });
        console.log(`[agent] ${log.path}: shipped ${lines.length} lines, panel inserted ${response.inserted}`);
      }
      state.cursors[cursorKey] = { inode: result.inode, offset: result.offset };
      await saveState(state);
    }
    await saveState(state);
  } catch (error) {
    console.error(`[agent] tick failed: ${error.message}`);
  } finally {
    ticking = false;
  }
}

const config = await loadConfig();
const state = await loadState();
const intervalMs = Math.max(10, Number(config.intervalSeconds) || 60) * 1000;
console.log(`[agent] worker ${config.workerId} shipping ${config.logs.length} log(s) to ${config.panelUrl} every ${intervalMs / 1000}s`);
await tick(config, state);
setInterval(() => tick(config, state), intervalMs);
