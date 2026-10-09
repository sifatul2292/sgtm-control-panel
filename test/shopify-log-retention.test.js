import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openEventStore } from "../db.js";

test("Shopify log expiry preserves other tenant and similarly named shared hosts", () => {
  const dir = mkdtempSync(join(tmpdir(), "shopify-retention-"));
  const store = openEventStore(dir);
  try {
    store.insertLines([
      { tenantId: "review", dateKey: "2020-01-01", source: "fixture", workerId: "local", line: 'host="review.example.com"' },
      { tenantId: "other", dateKey: "2020-01-01", source: "fixture", workerId: "local", line: 'host="other.example.com"' },
      { tenantId: "", dateKey: "2020-01-01", source: "fixture", workerId: "local", line: 'host="review.example.com"' },
      { tenantId: "", dateKey: "2020-01-01", source: "fixture", workerId: "local", line: 'host="other-review.example.com"' },
      { tenantId: "review", dateKey: "2099-01-01", source: "fixture", workerId: "local", line: 'host="review.example.com"' }
    ]);
    assert.equal(store.pruneShopifyTenant("review", ["review.example.com"]).lines, 2);
    assert.equal(store.stats().lines, 3);
    assert.equal(store.pruneShopifyTenant("review", ["review.example.com"]).lines, 0);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
