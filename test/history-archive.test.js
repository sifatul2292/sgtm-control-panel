import test from "node:test";
import assert from "node:assert/strict";
import { attachEventHistory, archiveEventHistory, unpackEventHistory } from "../history-archive.js";

test("event history round-trips losslessly, stays lazy on billing writes, supports mutation and legacy rollback", async () => {
  const history = { tenant: { "2026-10-07": { purchaseEvents: [{ transaction: "test", value: 30 }], total: 900 } } };
  const legacy = { version: 3, tenants: [{ id: "tenant" }], payments: [], tenantEventHistory: history };
  const encoded = await archiveEventHistory(legacy);
  assert.deepEqual(await archiveEventHistory({ ...encoded }), encoded);
  assert.equal(encoded.tenantEventHistory, undefined);
  const read = attachEventHistory({ ...encoded }, encoded);
  read.payments.push({ id: "payment" });
  const billingWrite = await archiveEventHistory(read);
  assert.equal(billingWrite.tenantEventHistoryArchive, encoded.tenantEventHistoryArchive);
  assert.deepEqual(read.tenantEventHistory, history);
  read.tenantEventHistory.tenant["2026-10-07"].total = 901;
  const updated = await archiveEventHistory(read);
  const rollback = unpackEventHistory(updated);
  assert.equal(rollback.tenantEventHistory.tenant["2026-10-07"].total, 901);
  assert.equal(rollback.tenantEventHistoryArchive, undefined);
  assert.equal(rollback.payments.length, 1);
  delete read.tenantEventHistory.tenant;
  assert.deepEqual(unpackEventHistory(await archiveEventHistory(read)).tenantEventHistory, {});
});

test("untouched archive is not decompressed by core reads/writes", async () => {
  const source = { tenants: [], tenantEventHistoryArchive: { codec: "gzip-json-v1", data: "invalid-test-archive" } };
  const data = attachEventHistory({}, source);
  assert.equal((await archiveEventHistory(data)).tenantEventHistoryArchive, source.tenantEventHistoryArchive);
  assert.throws(() => data.tenantEventHistory);
});
