import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalizeShopDomain, requiresShopifyBilling } from "../shopify-billing.js";
import { findShopifyWorkspace, signShopifyAppToken, usableShopifyAppSecret, verifyShopifyAppToken } from "../shopify-workspace.js";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
function extractFunction(name, async = false) {
  const start = source.indexOf(`${async ? "async " : ""}function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const secret = "x".repeat(40);

// Same construction as tagiooDashboardUrl in the Tagioo Shopify app.
function appToken(claims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

test("panel accepts the app's dashboard token and rejects altered, stale or unsigned ones", () => {
  const now = Date.now();
  const claims = { shop: "review-store.myshopify.com", tenantId: "review", nonce: randomBytes(18).toString("base64url"), exp: now + 9 * 60_000 };
  const token = appToken(claims);
  assert.equal(token, signShopifyAppToken(claims, secret));
  assert.deepEqual(verifyShopifyAppToken(token, secret, now), { shop: claims.shop, exp: claims.exp, nonce: claims.nonce, tenantId: "review" });
  assert.equal(verifyShopifyAppToken(token, "y".repeat(40), now), null);
  assert.equal(verifyShopifyAppToken(token, secret, claims.exp + 1), null);
  assert.equal(verifyShopifyAppToken(appToken({ ...claims, exp: now + 60 * 60_000 }), secret, now), null);
  assert.equal(verifyShopifyAppToken(appToken({ ...claims, shop: "evil.example.com" }), secret, now), null);
  assert.equal(verifyShopifyAppToken(appToken({ ...claims, nonce: "short" }), secret, now), null);
  const [payload, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...claims, tenantId: "victim" })).toString("base64url");
  assert.equal(verifyShopifyAppToken(`${forged}.${signature}`, secret, now), null);
  assert.equal(verifyShopifyAppToken(`${payload}.${signature}`, "", now), null);
  assert.equal(usableShopifyAppSecret("change-me"), "");
});

test("a store finds its workspace; a connected workspace wins over a merely linked one", () => {
  const data = {
    tenants: [
      { id: "linked", shopifyShops: ["store-a.myshopify.com", "store-b.myshopify.com"], shopifyAppShops: ["store-a.myshopify.com", "store-b.myshopify.com"] },
      { id: "connected", tracking: { shopify: { shop: "store-b.myshopify.com" } } },
      { id: "app-made", source: "shopify_app", shopifyShop: "store-c.myshopify.com" },
    ],
  };
  assert.equal(findShopifyWorkspace(data, "store-a.myshopify.com").id, "linked");
  assert.equal(findShopifyWorkspace(data, "STORE-B.myshopify.com").id, "connected");
  assert.equal(findShopifyWorkspace(data, "store-b.myshopify.com", "linked").id, "linked");
  assert.equal(findShopifyWorkspace(data, "store-c.myshopify.com").id, "app-made");
  assert.equal(findShopifyWorkspace(data, "store-d.myshopify.com"), null);
  assert.equal(findShopifyWorkspace(data, "not-a-shop"), null);
});

test("a store named only by a bare ?shop= link does not find that workspace", () => {
  // Anyone can open /shopify/start?shop=<any store> and sign in; that link
  // decides billing but must never route the store to this workspace.
  const data = { tenants: [{ id: "attacker", shopifyShop: "victim.myshopify.com", shopifyShops: ["victim.myshopify.com"], shopifyBillingRequired: true }] };
  assert.equal(findShopifyWorkspace(data, "victim.myshopify.com"), null);
});

function workspaceContext(data) {
  let writes = 0;
  const ctx = vm.createContext({
    normalizeShopDomain, findShopifyWorkspace, randomBytes,
    config: { billingPlan: "Starter" },
    withDbLock: async (fn) => fn(),
    readDatabase: async () => ({ available: true, data }),
    writeDatabase: async () => { writes++; },
    normalizeWebsiteUrl: () => "",
    validDomain: () => true,
    hashPassword: (password) => `scrypt:${"0".repeat(8)}:${Buffer.from(password).toString("hex").slice(0, 16)}`,
    publicCustomerAccount: (account) => account,
    resourceProfileForPlan: () => ({ monthlyRequestLimit: 15000, containerLimit: 1, domainLimit: 1 }),
    monthlyAmountForPlan: () => 0,
  });
  vm.runInContext([
    extractFunction("sanitizeId"),
    extractFunction("uniqueTenantId"),
    extractFunction("validateCustomerAccountInput"),
    extractFunction("addCustomerAccountLocked", true),
    extractFunction("createShopifyAppWorkspace", true),
  ].join("\n"), ctx);
  return { ctx, writes: () => writes };
}

test("the app creates one Free, Shopify-billed workspace per store with no usable password", async () => {
  const data = { tenants: [], customerAccounts: [] };
  const { ctx, writes } = workspaceContext(data);
  const input = { shop: "review-store.myshopify.com", shopName: "Review Store", email: "Owner@Example.com", ownerName: "Store Owner", country: "us" };
  const created = await ctx.createShopifyAppWorkspace(input);
  assert.equal(created.ok, true);
  assert.equal(created.created, true);
  assert.equal(writes(), 1);
  const tenant = data.tenants[0];
  assert.equal(tenant.id, "review-store");
  assert.equal(tenant.plan, "Free");
  assert.equal(tenant.source, "shopify_app");
  assert.equal(tenant.country, "US");
  assert.equal(tenant.shopifyShop, "review-store.myshopify.com");
  assert.deepEqual([...tenant.shopifyShops], ["review-store.myshopify.com"]);
  assert.deepEqual([...tenant.shopifyAppShops], ["review-store.myshopify.com"]);
  assert.equal(requiresShopifyBilling(tenant), true);
  assert.equal(data.customerAccounts[0].username, "owner@example.com");
  assert.match(data.customerAccounts[0].passwordHash, /^scrypt:/);

  const again = await ctx.createShopifyAppWorkspace(input);
  assert.equal(again.ok, true);
  assert.equal(again.created, false);
  assert.equal(data.tenants.length, 1);
  assert.equal(writes(), 1);
});

test("an email already used by Tagioo must be linked by signing in, never taken over", async () => {
  const data = { tenants: [{ id: "existing", plan: "Pro", paymentProvider: "paddle" }], customerAccounts: [{ tenantId: "existing", username: "owner@example.com" }] };
  const { ctx, writes } = workspaceContext(data);
  const result = await ctx.createShopifyAppWorkspace({ shop: "review-store.myshopify.com", email: "owner@example.com" });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.code, "account_exists");
  assert.equal(writes(), 0);
  assert.equal(data.tenants[0].shopifyShop, undefined);
  assert.equal((await ctx.createShopifyAppWorkspace({ shop: "review-store.myshopify.com", email: "" })).status, 400);
});

test("each dashboard link signs in once", () => {
  const ctx = vm.createContext({ usedShopifyLoginNonces: new Map() });
  vm.runInContext(extractFunction("claimShopifyLoginNonce"), ctx);
  const now = Date.now();
  assert.equal(ctx.claimShopifyLoginNonce("nonce-aaaaaaaaaaaaaaaa", now + 1000, now), true);
  assert.equal(ctx.claimShopifyLoginNonce("nonce-aaaaaaaaaaaaaaaa", now + 1000, now), false);
  // Expired entries are swept, so memory stays bounded.
  assert.equal(ctx.claimShopifyLoginNonce("nonce-bbbbbbbbbbbbbbbb", now + 5000, now + 2000), true);
  assert.equal(ctx.usedShopifyLoginNonces.has("nonce-aaaaaaaaaaaaaaaa"), false);
});

test("app routes require the shared secret and claim the nonce before signing in", () => {
  const login = between('if (pathname === "/shopify/login" && req.method === "GET")', 'if (pathname === "/shopify/start" && req.method === "POST")');
  assert.match(login, /verifyShopifyAppToken\(reqUrl\.searchParams\.get\("token"\), config\.shopifyAppSecret\)/);
  assert.ok(login.indexOf("claimShopifyLoginNonce(") < login.indexOf("makeSessionCookie("));
  const api = between('if (pathname === "/api/integrations/shopify/workspace" && req.method === "POST")', 'if (pathname === "/api/integrations/shopify/connect"');
  assert.ok(api.indexOf("isShopifyIntegrationAuthorized(req, rawBody, config.shopifyAppSecret)") < api.indexOf("createShopifyAppWorkspace("));
  assert.match(api, /jsonResponse\(res, 503/);
});
