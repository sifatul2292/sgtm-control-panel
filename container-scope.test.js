import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openEventStore } from "./db.js";
import { primaryContainerId, scopedTrackingEntries, selectedContainer, setTrackingForContainer, trackingForContainer } from "./container-scope.js";

function fixture() {
  return {
    tenant: { id: "store", tracking: { domain: "https://production.example.com", measurementId: "G-PROD" } },
    requests: [
      { id: "test", tenantId: "store", trackingDomain: "test.example.com", status: "live" },
      { id: "production", tenantId: "store", trackingDomain: "production.example.com", status: "live" }
    ]
  };
}

test("existing production tracking remains the primary container", () => {
  const { tenant, requests } = fixture();
  assert.equal(primaryContainerId(tenant, requests), "production");
  assert.equal(selectedContainer(tenant, requests).id, "production");
  assert.equal(trackingForContainer(tenant, requests, "production").measurementId, "G-PROD");
});

test("saving a second container does not overwrite production credentials", () => {
  const { tenant, requests } = fixture();
  setTrackingForContainer(tenant, requests, "test", { domain: "https://test.example.com", measurementId: "G-TEST" });
  assert.equal(tenant.tracking.domain, "https://production.example.com");
  assert.equal(tenant.tracking.measurementId, "G-PROD");
  assert.equal(trackingForContainer(tenant, requests, "test").measurementId, "G-TEST");
});

test("unknown or another account's container cannot receive scoped configuration", () => {
  const { tenant, requests } = fixture();
  assert.equal(setTrackingForContainer(tenant, requests, "someone-else", { measurementId: "G-BAD" }), null);
  assert.equal(tenant.tracking.containerConfigs, undefined);
});

test("updating the primary container preserves secondary configurations", () => {
  const { tenant, requests } = fixture();
  setTrackingForContainer(tenant, requests, "test", { domain: "https://test.example.com", measurementId: "G-TEST" });
  setTrackingForContainer(tenant, requests, "production", { domain: "https://production.example.com", measurementId: "G-NEW" });
  assert.equal(tenant.tracking.measurementId, "G-NEW");
  assert.equal(tenant.tracking.containerConfigs.test.measurementId, "G-TEST");
});

test("Shopify credentials are discoverable only under their own container", () => {
  const { tenant, requests } = fixture();
  tenant.tracking.shopify = { integrationToken: "production-secret" };
  setTrackingForContainer(tenant, requests, "test", {
    domain: "https://test.example.com",
    shopify: { integrationToken: "test-secret" }
  });
  const entries = scopedTrackingEntries(tenant, requests);
  assert.equal(entries.find((entry) => entry.containerId === "production").tracking.shopify.integrationToken, "production-secret");
  assert.equal(entries.find((entry) => entry.containerId === "test").tracking.shopify.integrationToken, "test-secret");
});

test("event history is separated by container log source without losing shared logs", () => {
  const directory = mkdtempSync(join(tmpdir(), "tagioo-container-scope-"));
  const store = openEventStore(directory);
  try {
    const dateKey = "2026-08-25";
    store.insertLines([
      { tenantId: "store", workerId: "local", source: "/logs/production.log", dateKey, line: "production purchase" },
      { tenantId: "store", workerId: "local", source: "/logs/test.log", dateKey, line: "test purchase" },
      { tenantId: "", workerId: "local", source: "/logs/shared.log", dateKey, line: "shared event" },
      { tenantId: "someone-else", workerId: "local", source: "/logs/other.log", dateKey, line: "foreign purchase" }
    ]);
    assert.deepEqual(store.linesForTenantDate("store", dateKey, "/logs/production.log"), ["production purchase", "shared event"]);
    assert.deepEqual(store.linesForTenantDate("store", dateKey, "/logs/test.log"), ["test purchase", "shared event"]);
    assert.deepEqual(store.linesForTenantDate("store", dateKey), ["production purchase", "test purchase", "shared event"]);
    assert.deepEqual(store.dateCountsForTenant("store", dateKey, "/logs/test.log"), { [dateKey]: 2 });
    assert.deepEqual(store.tenantDates("store", dateKey, "/logs/test.log"), [dateKey]);
    assert.deepEqual(store.sourceCountsForTenantDate("store", dateKey), {
      "/logs/production.log": 1,
      "/logs/test.log": 1
    });
  } finally {
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
