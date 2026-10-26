import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { makeShopifyHandoffCookie, normalizeShopDomain, readShopifyHandoff, readShopifyHandoffCookie } from "../shopify-billing.js";
import { SHOPIFY_START_TOKEN_TTL_MS, findShopifyWorkspace, signShopifyAppToken, verifyShopifyAppToken } from "../shopify-workspace.js";
import { customerContainerRequests, primaryContainerId, scopedTrackingEntries, setTrackingForContainer, trackingForContainer } from "../container-scope.js";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
function extractFunction(name, async = false) {
  const start = source.indexOf(`${async ? "async " : ""}function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}
function extractConst(name) {
  const start = source.indexOf(`const ${name} =`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf(";\n", start) + 2);
}
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const secret = "x".repeat(40);
const sign = (payload) => createHmac("sha256", "session-secret").update(payload).digest("hex");

test("only a handoff started from a link the app signed counts as proven", () => {
  const plain = makeShopifyHandoffCookie("store-a.myshopify.com", sign);
  const proven = makeShopifyHandoffCookie("store-a.myshopify.com", sign, Date.now(), true);
  assert.deepEqual(readShopifyHandoff(plain, sign), { shop: "store-a.myshopify.com", verified: false });
  assert.deepEqual(readShopifyHandoff(proven, sign), { shop: "store-a.myshopify.com", verified: true });
  assert.equal(readShopifyHandoffCookie(proven, sign), "store-a.myshopify.com");
  // Adding the mark to a plain cookie breaks its signature.
  const [encoded, signature] = plain.split(".");
  const marked = Buffer.from(`${Buffer.from(encoded, "base64url").toString("utf8")}:app`).toString("base64url");
  assert.deepEqual(readShopifyHandoff(`${marked}.${signature}`, sign), { shop: "", verified: false });
});

test("account links and sign-in links cannot stand in for each other", () => {
  const now = Date.now();
  const nonce = randomBytes(18).toString("base64url");
  const start = signShopifyAppToken({ shop: "store-a.myshopify.com", purpose: "start", nonce, exp: now + 50 * 60_000 }, secret);
  const startOptions = { purpose: "start", maxTtlMs: SHOPIFY_START_TOKEN_TTL_MS };
  assert.equal(verifyShopifyAppToken(start, secret, now, startOptions).shop, "store-a.myshopify.com");
  assert.equal(verifyShopifyAppToken(start, secret, now), null);
  // Even inside the sign-in window, an account link never signs anyone in.
  assert.equal(verifyShopifyAppToken(start, secret, now + 45 * 60_000), null);
  const login = signShopifyAppToken({ shop: "store-a.myshopify.com", tenantId: "review", nonce, exp: now + 5 * 60_000 }, secret);
  assert.equal(verifyShopifyAppToken(login, secret, now, startOptions), null);
  assert.equal(verifyShopifyAppToken(login, secret, now).tenantId, "review");
  const tooLong = signShopifyAppToken({ shop: "store-a.myshopify.com", purpose: "start", nonce, exp: now + 2 * SHOPIFY_START_TOKEN_TTL_MS }, secret);
  assert.equal(verifyShopifyAppToken(tooLong, secret, now, startOptions), null);
});

test("routes: account links are verified as start links, signed calls are checked before any intent", () => {
  const start = between('if (pathname === "/shopify/start" && req.method === "GET")', 'if (pathname === "/shopify/login" && req.method === "GET")');
  assert.match(start, /verifyShopifyAppToken\(reqUrl\.searchParams\.get\("token"\), config\.shopifyAppSecret, Date\.now\(\), \{ purpose: "start", maxTtlMs: SHOPIFY_START_TOKEN_TTL_MS \}\)/);
  assert.match(start, /makeShopifyHandoffCookie\(shop, signSession, Date\.now\(\), verified\)/);
  const login = between('if (pathname === "/shopify/login" && req.method === "GET")', 'if (pathname === "/shopify/start" && req.method === "POST")');
  assert.match(login, /verifyShopifyAppToken\(reqUrl\.searchParams\.get\("token"\), config\.shopifyAppSecret\)/);
  const startPost = between('if (pathname === "/shopify/start" && req.method === "POST")', 'if (pathname === "/signup" && req.method === "GET")');
  assert.match(startPost, /adoptShopifyBilling\(session\.tenantId, shop, \{ verified \}\)/);
  const api = between('if (pathname === "/api/integrations/shopify/workspace" && req.method === "POST")', 'if (pathname === "/api/integrations/shopify/connect"');
  const authorized = api.indexOf("isShopifyIntegrationAuthorized(req, rawBody, config.shopifyAppSecret)");
  for (const intent of ["connectShopifyAppContainer(", "createShopifyAppContainer(", "retryShopifyAppContainerLaunch(", "shopifyAppServerTemplate("]) {
    assert.ok(authorized > 0 && authorized < api.indexOf(intent), intent);
  }
});

test("a verified link is recorded only when the handoff was signed", async () => {
  const data = { tenants: [{ id: "review", plan: "Free" }], payments: [] };
  const ctx = vm.createContext({
    normalizeShopDomain,
    shopifyAdoptionBlocker: () => "",
    unpaidSignupReleasable: () => false,
    withDbLock: async (fn) => fn(),
    readDatabase: async () => ({ available: true, data }),
    writeDatabase: async () => {},
  });
  vm.runInContext(extractFunction("adoptShopifyBilling", true), ctx);
  await ctx.adoptShopifyBilling("review", "plain.myshopify.com");
  assert.equal(data.tenants[0].shopifyAppShops, undefined);
  assert.equal(findShopifyWorkspace(data, "plain.myshopify.com"), null);
  await ctx.adoptShopifyBilling("review", "signed.myshopify.com", { verified: true });
  assert.deepEqual([...data.tenants[0].shopifyAppShops], ["signed.myshopify.com"]);
  assert.equal(findShopifyWorkspace(data, "signed.myshopify.com").id, "review");
  assert.deepEqual([...data.tenants[0].shopifyShops], ["plain.myshopify.com", "signed.myshopify.com"]);
});

function appContext(data, overrides = {}) {
  let writes = 0;
  const launches = [];
  const ctx = vm.createContext({
    Date, Map, Math, URL, randomBytes, normalizeShopDomain, findShopifyWorkspace, scopedTrackingEntries, primaryContainerId,
    setTrackingForContainer, trackingForContainer, customerContainerRequests,
    config: { provisionDnsTarget: "bd.tagioo.example" },
    retainShopifyPrivacyRoute: () => {},
    withDbLock: async (fn) => fn(),
    readDatabase: async () => ({ available: true, data }),
    readDatabaseCached: async () => ({ available: true, data }),
    writeDatabase: async () => { writes++; },
    addCustomerSetupRequest: async (input, session) => {
      const request = { id: `setup_${data.customerSetupRequests.length + 1}`, tenantId: session.tenantId, status: "dns_pending", trackingDomain: input.trackingDomain, containerName: input.containerName, websiteUrl: input.websiteUrl, platform: input.platform };
      data.customerSetupRequests.unshift(request);
      return { ok: true, request };
    },
    buildSetupAssistantTemplates: (input) => ({ fileNames: { server: "tagioo-server-template.json" }, server: { input } }),
    autoLaunchProvisioningRequest: async (_data, request) => { launches.push(request.id); request.status = "live"; return request; },
    ...overrides,
  });
  vm.runInContext([
    extractFunction("sanitizeId"),
    extractFunction("isDeletedStatus"),
    extractFunction("getTenantContainers"),
    extractFunction("trackingOrigin"),
    extractFunction("saveTenantTrackingConfig", true),
    extractFunction("connectShopifyContainerLocked"),
    extractFunction("shopifyAppContainers"),
    extractFunction("shopifyAppWorkspaceFor"),
    extractConst("shopifyAppWorkspaceMissing"),
    extractFunction("connectShopifyAppContainer", true),
    extractFunction("createShopifyAppContainer", true),
    extractFunction("shopifyConnectedContainer"),
    extractFunction("shopifyAppServerTemplate"),
    extractConst("shopifyDnsChecks"),
    extractFunction("retryShopifyAppContainerLaunch", true),
  ].join("\n"), ctx);
  return { ctx, writes: () => writes, launches };
}

function reviewData() {
  return {
    tenants: [
      {
        id: "review",
        name: "Shopify Review Workspace",
        plan: "Pro",
        paymentProvider: "shopify",
        paymentStatus: "paid",
        shopifyAppShops: ["reviewer.myshopify.com"],
        tracking: {
          domain: "https://review-track.tagioo.example",
          measurementId: "G-REVIEW",
          containerConfigs: { setup_b: { domain: "https://second.tagioo.example", measurementId: "G-SECOND", shopify: { shop: "owner-store.myshopify.com", status: "connected" } } },
        },
      },
      { id: "attacker", shopifyShop: "reviewer.myshopify.com", shopifyShops: ["reviewer.myshopify.com"], tracking: { domain: "https://evil.example", measurementId: "G-EVIL" } },
    ],
    customerSetupRequests: [
      { id: "setup_b", tenantId: "review", containerName: "second", trackingDomain: "second.tagioo.example", status: "live" },
      { id: "setup_a", tenantId: "review", containerName: "review-track", trackingDomain: "review-track.tagioo.example", status: "live" },
    ],
    provisioning: { requests: [] },
  };
}

test("the app lists the workspace's containers and which ones this store may use", () => {
  const data = reviewData();
  const { ctx } = appContext(data);
  const listed = ctx.shopifyAppContainers(data, data.tenants[0], "reviewer.myshopify.com");
  assert.deepEqual(listed.map((item) => [item.id, item.name, item.status, item.connectable, item.connectedShop]), [
    ["setup_a", "review-track", "live", true, ""],
    ["setup_b", "second", "live", false, "owner-store.myshopify.com"],
  ]);
});

test("one click connects a store to a container of its own verified workspace", async () => {
  const data = reviewData();
  const { ctx, writes } = appContext(data);
  const result = await ctx.connectShopifyAppContainer({ shop: "reviewer.myshopify.com", tenantId: "review", containerId: "setup_a" });
  assert.equal(result.ok, true);
  assert.equal(result.trackingDomain, "https://review-track.tagioo.example");
  assert.match(result.integrationToken, /^[0-9a-f]{64}$/);
  assert.equal(data.tenants[0].tracking.shopify.shop, "reviewer.myshopify.com");
  assert.equal(data.tenants[0].tracking.shopify.status, "connected");
  assert.ok(data.tenants[0].shopifyShops.includes("reviewer.myshopify.com"));
  assert.equal(writes(), 1);
});

test("connect refuses another store's container, an unlinked workspace and an unfinished container", async () => {
  const data = reviewData();
  const { ctx, writes } = appContext(data);
  const inUse = await ctx.connectShopifyAppContainer({ shop: "reviewer.myshopify.com", tenantId: "review", containerId: "setup_b" });
  assert.equal(inUse.status, 409);
  assert.equal(inUse.code, "container_in_use");
  // The attacker linked this store with a bare ?shop= link: not proven, so not reachable.
  const attacker = await ctx.connectShopifyAppContainer({ shop: "reviewer.myshopify.com", tenantId: "attacker", containerId: "" });
  assert.equal(attacker.status, 404);
  assert.equal(attacker.code, "workspace_not_linked");
  assert.equal(data.tenants[1].tracking.shopify, undefined);
  const stranger = await ctx.connectShopifyAppContainer({ shop: "stranger.myshopify.com", tenantId: "review", containerId: "setup_a" });
  assert.equal(stranger.status, 404);
  delete data.tenants[0].tracking.measurementId;
  const unfinished = await ctx.connectShopifyAppContainer({ shop: "reviewer.myshopify.com", tenantId: "review", containerId: "setup_a" });
  assert.equal(unfinished.status, 400);
  assert.equal(writes(), 0);
});

function freshWorkspace() {
  return {
    tenants: [{ id: "new-store", name: "New Store", plan: "Free", source: "shopify_app", shopifyShop: "new-store.myshopify.com", shopifyShops: ["new-store.myshopify.com"] }],
    customerSetupRequests: [],
    provisioning: { requests: [] },
  };
}
const containerInput = {
  shop: "new-store.myshopify.com",
  tenantId: "new-store",
  shopName: "New Store",
  websiteUrl: "https://newstore.example",
  trackingDomain: "track.newstore.example",
  containerConfig: "aWQ9R1RNLVRFU1QmZW52PTEmYXV0aD1hYmM=",
  ga4MeasurementId: "g-abc123",
  metaPixelId: "1234567890",
  metaAccessToken: "EAAB-token",
};

test("a new container created in the app is saved, connected and ready for its template", async () => {
  const data = freshWorkspace();
  const { ctx } = appContext(data);
  const result = await ctx.createShopifyAppContainer(containerInput);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.containerId, "setup_1");
  assert.equal(result.trackingDomain, "https://track.newstore.example");
  assert.equal(result.measurementId, "G-ABC123");
  const tracking = data.tenants[0].tracking;
  assert.equal(tracking.shopify.shop, "new-store.myshopify.com");
  assert.deepEqual({ ...tracking.meta }, { pixelId: "1234567890", capiToken: "EAAB-token" });
  assert.equal(data.customerSetupRequests[0].platform, "shopify");
  assert.equal(data.customerSetupRequests[0].containerName, "New Store");

  const found = ctx.shopifyConnectedContainer(data, data.tenants[0], "new-store.myshopify.com");
  const template = ctx.shopifyAppServerTemplate(found.entry.tracking);
  assert.equal(template.includesMeta, true);
  assert.deepEqual([...template.template.input.destinations], ["ga4", "meta"]);
  assert.equal(template.template.input.metaAccessToken, "EAAB-token");
  delete found.entry.tracking.meta.capiToken;
  const gaOnly = ctx.shopifyAppServerTemplate(found.entry.tracking);
  assert.deepEqual([...gaOnly.template.input.destinations], ["ga4"]);
  assert.equal(gaOnly.template.input.metaPixelId, "");
});

test("container creation checks GA4 and Meta details and explains the plan limit", async () => {
  const data = freshWorkspace();
  const { ctx } = appContext(data);
  const bad = await ctx.createShopifyAppContainer({ ...containerInput, ga4MeasurementId: "UA-1", metaAccessToken: "" });
  assert.equal(bad.status, 400);
  assert.equal(bad.errors.length, 2);
  assert.equal(data.customerSetupRequests.length, 0);
  const limited = appContext(freshWorkspace(), { addCustomerSetupRequest: async () => ({ ok: false, status: 402, errors: ["৳ limit"] }) });
  const limit = await limited.ctx.createShopifyAppContainer(containerInput);
  assert.equal(limit.code, "container_limit");
  assert.match(limit.errors[0], /Choose a larger plan in Shopify/);
  assert.doesNotMatch(limit.errors[0], /৳/);
  const unlinked = await ctx.createShopifyAppContainer({ ...containerInput, shop: "other.myshopify.com" });
  assert.equal(unlinked.code, "workspace_not_linked");
});

test("Check DNS relaunches only a DNS-pending container, at most once a minute", async () => {
  const data = freshWorkspace();
  const { ctx, launches } = appContext(data);
  await ctx.createShopifyAppContainer(containerInput);
  data.provisioning.requests.push({ id: "req_1", sourceRequestId: "setup_1", status: "dns_pending" });
  const first = await ctx.retryShopifyAppContainerLaunch({ shop: "new-store.myshopify.com", tenantId: "new-store" });
  assert.deepEqual({ ...first }, { ok: true, status: "live", checked: true });
  assert.deepEqual(launches, ["req_1"]);
  data.provisioning.requests[0].status = "dns_pending";
  const soon = await ctx.retryShopifyAppContainerLaunch({ shop: "new-store.myshopify.com", tenantId: "new-store" });
  assert.equal(soon.checked, false);
  assert.ok(soon.retryAfterSeconds > 0);
  data.provisioning.requests[0].status = "docker_failed";
  vm.runInContext("shopifyDnsChecks.clear()", ctx);
  const other = await ctx.retryShopifyAppContainerLaunch({ shop: "new-store.myshopify.com", tenantId: "new-store" });
  assert.equal(other.checked, false);
  assert.deepEqual(launches, ["req_1"]);
});
