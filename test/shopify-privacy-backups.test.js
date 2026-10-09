import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { redactShopifyBackups, privacySafeBackupData } from "../shopify-privacy-backups.js";
import { serializeProtectedJson, parseProtectedJson } from "../data-protection.js";

test("encrypted backup redaction preserves other customers and shops and survives retry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "privacy-backups-"));
  const key = randomBytes(32).toString("base64");
  const file = join(dir, "backup-20261010T000000-abcdef.json");
  const order = (id, shop, customer) => ({ id, tenantId: "test", source: "tagioo-shopify-app", raw: { shop_domain: shop, customer_id: customer } });
  try {
    await writeFile(file, serializeProtectedJson({ data: { orders: [order("1", "one.myshopify.com", "5"), order("2", "one.myshopify.com", "6"), order("3", "two.myshopify.com", "5")] } }, key));
    const options = { tenantId: "test", shop: "one.myshopify.com", customer: { id: "5" } };
    await redactShopifyBackups(dir, key, options);
    let data = parseProtectedJson(await readFile(file), key).data;
    assert.deepEqual(data.orders.map(o => o.id), ["2", "3"]);
    await redactShopifyBackups(dir, key, { ...options, allForShop: true });
    await redactShopifyBackups(dir, key, { ...options, allForShop: true });
    data = parseProtectedJson(await readFile(file), key).data;
    assert.deepEqual(data.orders.map(o => o.id), ["3"]);
    await writeFile(file, "corrupt");
    await assert.rejects(redactShopifyBackups(dir, key, options));
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test("new backups omit Shopify raw history without changing the active data or other tenants", async () => {
  const data = { tenants: [{ id: "review", tracking: { shopify: { shop: "one.myshopify.com" } } }], tenantEventHistory: { review: { day: { recentEvents: [{ ip: "synthetic" }] } }, other: { day: { total: 4 } } } };
  const safe = await privacySafeBackupData(data);
  const { unpackEventHistory } = await import("../history-archive.js");
  const history = unpackEventHistory(safe).tenantEventHistory;
  assert.equal(history.review, undefined);
  assert.equal(history.other.day.total, 4);
  assert.equal(data.tenantEventHistory.review.day.recentEvents[0].ip, "synthetic");
});

test("hashed shop deletion ledger prevents erased orders returning through old snapshots", async () => {
  const { privacyTokenHash } = await import("../shopify-privacy.js");
  const data = { tenants: [{ id: "review", tracking: { shopify: { shop: "old.myshopify.com", integrationToken: "synthetic" } } }], shopifyPrivacyRedactions: [{ tenantId: "review", shopHash: privacyTokenHash("old.myshopify.com") }], orders: [
    { id: "1", tenantId: "review", source: "tagioo-shopify-app", raw: { shop_domain: "old.myshopify.com" } },
    { id: "2", tenantId: "other", source: "tagioo-shopify-app", raw: { shop_domain: "old.myshopify.com" } }
  ] };
  const safe = await privacySafeBackupData(data);
  assert.deepEqual(safe.orders.map(order => order.id), ["2"]);
  assert.equal(data.orders.length, 2);
  assert.equal(safe.tenants[0].tracking.shopify, undefined);
  assert.equal(data.tenants[0].tracking.shopify.integrationToken, "synthetic");
});
