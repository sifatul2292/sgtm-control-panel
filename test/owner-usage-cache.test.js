import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

test("owner usage reads stored summaries without raw-event queries", async () => {
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const start = source.indexOf("function sqliteSnapshotsForTenant(");
  const body = source.slice(start, source.indexOf("if (eventStore) {", start));
  const context = {
    localDateKey: () => "2026-10-06",
    addDays: (date) => date,
    todaySnapshotCache: new Map([["test", { dateKey: "2026-10-06", snapshot: { total: 123 } }]]),
    eventStore: {
      dateCountsForTenant: () => { throw Error("Raw queries forbidden"); },
      tenantDates: () => { throw Error("Raw queries forbidden"); },
      getDailySummary: () => { throw Error("Today's cache should be used"); }
    },
    console: { error: () => { throw Error("Unexpected query failure"); } }
  };
  const result = runInNewContext(`${body}\nsqliteSnapshotsForTenant('test', {}, 1, { cachedOnly: true })`, context);
  assert.equal(result["2026-10-06"].total, 123);
  context.todaySnapshotCache.set("test", { dateKey: "2026-10-05", snapshot: { total: 999 } });
  assert.equal(Object.keys(runInNewContext(`${body}\nsqliteSnapshotsForTenant('test', {}, 1, { cachedOnly: true })`, context)).length, 0);
  assert.match(source, /sqliteSnapshotsForTenant\(tenant.id, billingTenant, 30, \{ cachedOnly: true \}\)/);
});
