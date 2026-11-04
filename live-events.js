import { randomBytes } from "node:crypto";
import { open, stat } from "node:fs/promises";

// Live Event Log feed. The Event Log otherwise shows what the SQLite ingest has
// copied from the access logs, and that runs once a minute. This reads new
// lines straight from a container's access log, so an open Event Log shows a
// purchase a few seconds after nginx writes it.
//
// One tail per log file, shared by every viewer of that container: a poll
// stats the file and reads only the bytes appended since the last read, at
// most once per `minCheckMs`. No full-day scans and no history.json reads.
export function createLiveEventTails({
  parseLine,
  maxEvents = 300,
  backfillBytes = 256 * 1024,
  maxReadBytes = 1024 * 1024,
  minCheckMs = 1000,
  idleMs = 10 * 60 * 1000,
  now = () => Date.now()
} = {}) {
  // Cursors carry the process epoch: after a restart the sequence numbers start
  // again, so an old cursor falls back to `since` instead of skipping events.
  const epoch = randomBytes(4).toString("hex");
  const tails = new Map();
  let seq = 0;

  function addLines(tail, text) {
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const row = parseLine(line);
      if (row) tail.events.push({ seq: ++seq, row });
    }
    if (tail.events.length > maxEvents) tail.events.splice(0, tail.events.length - maxEvents);
  }

  async function readNew(pathname, tail) {
    const info = await stat(pathname).catch(() => null);
    if (!info) {
      tail.readable = false;
      return;
    }
    let start = tail.offset;
    // First read: start near the end, so the first poll can return the last
    // minute of events the event store has not ingested yet. Rotation (new
    // inode, or a truncated file): the new file is read from its start.
    if (tail.ino === null) start = Math.max(0, info.size - backfillBytes);
    else if (tail.ino !== info.ino || info.size < tail.offset) start = 0;
    // A burst bigger than one read keeps only its newest part.
    if (info.size - start > maxReadBytes) start = info.size - maxReadBytes;
    tail.ino = info.ino;
    tail.readable = true;
    if (info.size === start) {
      tail.offset = start;
      return;
    }
    const handle = await open(pathname, "r");
    try {
      const buffer = Buffer.alloc(info.size - start);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
      let text = buffer.subarray(0, bytesRead).toString("utf8");
      let consumed = 0;
      // Starting mid-file means the first line is a fragment.
      if (start > 0 && start !== tail.offset) {
        const firstNewline = text.indexOf("\n");
        if (firstNewline === -1) return;
        consumed = Buffer.byteLength(text.slice(0, firstNewline + 1), "utf8");
        text = text.slice(firstNewline + 1);
      }
      // Only complete lines; a line nginx is still writing is read next time.
      const lastNewline = text.lastIndexOf("\n");
      if (lastNewline !== -1) {
        addLines(tail, text.slice(0, lastNewline));
        consumed += Buffer.byteLength(text.slice(0, lastNewline + 1), "utf8");
      }
      tail.offset = start + consumed;
    } finally {
      await handle.close();
    }
  }

  function refresh(pathname) {
    let tail = tails.get(pathname);
    if (!tail) {
      tail = { ino: null, offset: 0, events: [], readable: false, checkedAt: 0, usedAt: 0, pending: null };
      tails.set(pathname, tail);
    }
    tail.usedAt = now();
    if (tail.pending) return tail.pending;
    if (tail.checkedAt && now() - tail.checkedAt < minCheckMs) return Promise.resolve();
    tail.checkedAt = now();
    tail.pending = readNew(pathname, tail)
      .catch(() => { tail.readable = false; })
      .finally(() => { tail.pending = null; });
    return tail.pending;
  }

  // Events from `paths` newer than `cursor` (from an earlier read), newest
  // first. Without a cursor from this process, events at or after `since`.
  async function read(paths, { cursor = "", since = "", limit = 200 } = {}) {
    const uniquePaths = [...new Set((paths || []).filter(Boolean))];
    for (const [pathname, tail] of tails) {
      if (!tail.pending && now() - tail.usedAt > idleMs) tails.delete(pathname);
    }
    await Promise.all(uniquePaths.map(refresh));
    const [cursorEpoch, cursorSeq] = String(cursor || "").split(".");
    const after = cursorEpoch === epoch && Number.isFinite(Number(cursorSeq)) ? Number(cursorSeq) : null;
    const sinceMs = since ? Date.parse(since) : NaN;
    const events = [];
    let readable = 0;
    for (const pathname of uniquePaths) {
      const tail = tails.get(pathname);
      if (!tail?.readable) continue;
      readable += 1;
      for (const event of tail.events) {
        const fresh = after !== null
          ? event.seq > after
          : !Number.isFinite(sinceMs) || !(Date.parse(event.row.date) < sinceMs);
        if (fresh) events.push(event);
      }
    }
    events.sort((a, b) => String(b.row.date || "").localeCompare(String(a.row.date || "")) || b.seq - a.seq);
    return {
      cursor: `${epoch}.${seq}`,
      readable,
      events: events.slice(0, limit).map((event) => event.row)
    };
  }

  return { read };
}
