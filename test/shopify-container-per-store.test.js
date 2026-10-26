import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalizeShopDomain } from "../shopify-billing.js";
import { customerContainerRequests, primaryContainerId, scopedTrackingEntries, setTrackingForContainer, trackingForContainer } from "../container-scope.js";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
function extractFunction(name, async = false) {
  const start = source.indexOf(`${async ? "async " : ""}function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}
const code = "one-time-code-123";
const codeHash = createHash("sha256").update(code).digest("hex");
const future = () => new Date(Date.now() + 10 * 60_000).toISOString();

function setup(shopify) {
  const data = {
    tenants: [{ id: "review", plan: "Pro", paymentProvider: "shopify", paymentStatus: "paid", tracking: { domain: "https://review-track.example", measurementId: "G-TEST", shopify } }],
    customerSetupRequests: [],
  };
  let writes = 0;
  const ctx = vm.createContext({
    createHash, randomBytes, normalizeShopDomain, scopedTrackingEntries, primaryContainerId, setTrackingForContainer,
    trackingForContainer, customerContainerRequests,
    safeEqual: (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)),
    retainShopifyPrivacyRoute: () => {},
    withDbLock: async (fn) => fn(),
    readDatabase: async () => ({ available: true, data }),
    writeDatabase: async () => { writes++; },
  });
  vm.runInContext([
    extractFunction("redeemShopifyConnectionCode", true),
    extractFunction("connectShopifyContainerLocked"),
    extractFunction("createShopifyConnectionCode", true),
  ].join("\n"), ctx);
  return { ctx, data, writes: () => writes };
}

test("a code for a container connected to another store is refused and stays usable", async () => {
  const { ctx, data, writes } = setup({ shop: "store-a.myshopify.com", status: "connected", integrationToken: "a-token", connectCodeHash: codeHash, connectCodeExpiresAt: future() });
  const result = await ctx.redeemShopifyConnectionCode({ code, shop: "store-b.myshopify.com" });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.code, "container_in_use");
  assert.match(result.errors[0], /already connected to store-a\.myshopify\.com/);
  assert.match(result.errors[0], /add a container for this store/);
  assert.equal(writes(), 0);
  assert.equal(data.tenants[0].tracking.shopify.shop, "store-a.myshopify.com");
  assert.equal(data.tenants[0].tracking.shopify.integrationToken, "a-token");
});

test("the same store can reconnect its own container", async () => {
  const { ctx, data } = setup({ shop: "store-a.myshopify.com", status: "connected", integrationToken: "a-token", connectCodeHash: codeHash, connectCodeExpiresAt: future() });
  const result = await ctx.redeemShopifyConnectionCode({ code, shop: "STORE-A.myshopify.com" });
  assert.equal(result.ok, true);
  assert.notEqual(data.tenants[0].tracking.shopify.integrationToken, "a-token");
  assert.deepEqual([...data.tenants[0].shopifyShops], ["store-a.myshopify.com"]);
});

test("a free or disconnected container accepts a new store, which is recorded on the workspace", async () => {
  for (const shopify of [
    { status: "waiting", connectCodeHash: codeHash, connectCodeExpiresAt: future() },
    { shop: "store-a.myshopify.com", status: "disconnected", connectCodeHash: codeHash, connectCodeExpiresAt: future() },
  ]) {
    const { ctx, data } = setup(shopify);
    const result = await ctx.redeemShopifyConnectionCode({ code, shop: "store-b.myshopify.com" });
    assert.equal(result.ok, true);
    assert.equal(data.tenants[0].tracking.shopify.shop, "store-b.myshopify.com");
    assert.ok(data.tenants[0].shopifyShops.includes("store-b.myshopify.com"));
    assert.equal(data.tenants[0].shopifyShop, "store-b.myshopify.com");
  }
});

test("generating a code tells the dashboard which store already uses the container", async () => {
  const { ctx } = setup({ shop: "store-a.myshopify.com", status: "connected" });
  const result = await ctx.createShopifyConnectionCode({ tenantId: "review" }, "");
  assert.equal(result.ok, true);
  assert.equal(result.connectedShop, "store-a.myshopify.com");
  const fresh = setup(undefined);
  assert.equal((await fresh.ctx.createShopifyConnectionCode({ tenantId: "review" }, "")).connectedShop, "");
});

test("the dashboard sends Shopify merchants to the app instead of a code, and upgrades go to Shopify", () => {
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(app, /shopify\/connect-code/);
  assert.doesNotMatch(html, /generateShopifyConnectCode|connection code/i);
  assert.match(html, /click <strong>Connect<\/strong> next to the one for your store\. There is no code to copy/);
  assert.match(app, /usage\.paymentProvider === "shopify" && usage\.shopifyPlanSelectionUrl\) window\.location\.assign\(usage\.shopifyPlanSelectionUrl\)/);
});
