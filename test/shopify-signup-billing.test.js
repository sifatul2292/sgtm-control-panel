import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  SHOPIFY_HANDOFF_TTL_MS,
  SIGNUP_STORE_PLATFORMS,
  makeShopifyHandoffCookie,
  normalizeShopDomain,
  readShopifyHandoffCookie,
  requiresShopifyBilling,
  shopifyAdoptionBlocker,
  shopifyPlanSelectionUrl,
  shopifyShopForTenant
} from "../shopify-billing.js";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const sign = (value) => createHmac("sha256", "test-secret").update(value).digest("hex");
function extractFunction(name, async = false) {
  const start = source.indexOf(`${async ? "async " : ""}function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}
const extractBetween = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

test("handoff cookie carries only a signed, unexpired myshopify shop", () => {
  const now = Date.now();
  const cookie = makeShopifyHandoffCookie("Review-Store.myshopify.com", sign, now);
  assert.equal(readShopifyHandoffCookie(cookie, sign, now + 1000), "review-store.myshopify.com");
  assert.equal(readShopifyHandoffCookie(cookie, sign, now + SHOPIFY_HANDOFF_TTL_MS + 1), "");
  const [, signature] = cookie.split(".");
  const forged = `${Buffer.from(`other-store.myshopify.com:${now}`).toString("base64url")}.${signature}`;
  assert.equal(readShopifyHandoffCookie(forged, sign, now), "");
  assert.equal(readShopifyHandoffCookie("", sign, now), "");
  assert.equal(readShopifyHandoffCookie("garbage", sign, now), "");
  assert.equal(normalizeShopDomain("evil.example.com"), "");
});

test("plan selection URL points at Shopify App Pricing in the merchant's admin", () => {
  assert.equal(
    shopifyPlanSelectionUrl("review-store.myshopify.com"),
    "https://admin.shopify.com/store/review-store/charges/tagioo-tracking/pricing_plans"
  );
  assert.equal(shopifyPlanSelectionUrl(""), "");
  assert.equal(shopifyShopForTenant({ shopifyShop: "a.myshopify.com", tracking: { shopify: { shop: "b.myshopify.com" } } }), "b.myshopify.com");
  assert.equal(shopifyShopForTenant({ shopifyShop: "a.myshopify.com" }), "a.myshopify.com");
});

test("externally paid or pending-claim workspaces cannot be switched to Shopify billing", () => {
  assert.match(shopifyAdoptionBlocker({ id: "t", plan: "Pro", paymentStatus: "paid", paymentProvider: "paddle" }), /billed outside Shopify/);
  assert.match(shopifyAdoptionBlocker({ id: "t", plan: "Free" }, [{ tenantId: "t", status: "pending" }]), /waiting for confirmation/);
  assert.equal(shopifyAdoptionBlocker({ id: "t", plan: "Free", paymentStatus: "free" }, [{ tenantId: "t", status: "rejected" }]), "");
  assert.equal(shopifyAdoptionBlocker({ id: "t", plan: "Pro", paymentStatus: "paid", paymentProvider: "shopify" }), "");
});

function adoptionContext(data) {
  let writes = 0;
  const ctx = vm.createContext({
    requiresShopifyBilling, shopifyAdoptionBlocker, normalizeShopDomain,
    withDbLock: async (fn) => fn(),
    readDatabase: async () => ({ available: true, data }),
    writeDatabase: async () => { writes++; },
    resourceProfileForPlan: () => ({ monthlyRequestLimit: 15000, containerLimit: 1, domainLimit: 1 }),
    tenantRequestBaselineNow: () => 0,
    FREE_CYCLE_DAYS: 30,
  });
  vm.runInContext([
    extractFunction("checkoutRequired"),
    extractFunction("unpaidSignupReleasable"),
    extractFunction("unpaidSignupReleasedToFree"),
    extractFunction("adoptShopifyBilling", true),
    extractFunction("paymentInstructionsFor"),
    extractFunction("paddleCheckoutConfigFor"),
  ].join("\n"), ctx);
  return { ctx, writes: () => writes };
}

test("a staged Paddle/bKash signup from Shopify is released to Free and becomes Shopify-billed", async () => {
  const tenant = { id: "test", plan: "Free", subscriptionStatus: "pending_payment", paymentStatus: "pending", pendingPlan: "Enterprise", pendingAmount: 100, pendingInvoiceNo: "test-INV001" };
  const data = { tenants: [tenant], payments: [] };
  const { ctx, writes } = adoptionContext(data);
  const result = await ctx.adoptShopifyBilling("test", "review-store.myshopify.com");
  assert.equal(result.ok, true);
  assert.equal(writes(), 1);
  const adopted = data.tenants[0];
  assert.equal(adopted.shopifyBillingRequired, true);
  assert.equal(adopted.shopifyShop, "review-store.myshopify.com");
  assert.equal(adopted.subscriptionStatus, "free");
  assert.equal(adopted.pendingPlan, "");
  assert.equal(adopted.pendingInvoiceNo, "");
  assert.equal(requiresShopifyBilling(adopted), true);
  assert.equal(ctx.checkoutRequired(adopted, data), false);
  assert.equal(ctx.paymentInstructionsFor(adopted, data), null);
  assert.equal(ctx.paddleCheckoutConfigFor(adopted).enabled, false);
});

test("adoption refuses an externally paid workspace without writing", async () => {
  const data = { tenants: [{ id: "paid", plan: "Pro", paymentStatus: "paid", paymentProvider: "paddle", subscriptionStatus: "active" }], payments: [] };
  const { ctx, writes } = adoptionContext(data);
  const result = await ctx.adoptShopifyBilling("paid", "review-store.myshopify.com");
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(writes(), 0);
  assert.equal(data.tenants[0].shopifyBillingRequired, undefined);
});

const signupFunctions = [
  extractBetween("async function addCustomerAccountLocked", "async function resetCustomerAccountPassword"),
  extractBetween("function signupTenantBase", "// Validate signup fields"),
  extractBetween("async function addCustomerSignup(", "// Read the owner's manual-payment"),
  extractBetween("async function selectCustomerPlanLocked", "// Customer reports they paid")
].join("\n");

async function runSignup(input) {
  let saved;
  const context = {
    requiresShopifyBilling, randomBytes, SIGNUP_STORE_PLATFORMS, normalizeShopDomain,
    withDbLock: async (fn) => fn(),
    readDatabase: async () => ({ available: true, data: { tenants: [], customerAccounts: [], payments: [] } }),
    writeDatabase: async (data) => { saved = structuredClone(data); },
    validateCustomerAccountInput: (value) => ({ errors: [], value }),
    publicCustomerAccount: (account) => account,
    resourceProfileForPlan: () => ({ monthlyRequestLimit: 15000, containerLimit: 1, domainLimit: 1 }),
    monthlyAmountForPlan: () => 0,
    sanitizeId: (value) => value.toLowerCase().replace(/\s/g, "-"),
    emailWelcome: async () => {},
    billingCycleConfig: { monthly: { months: 1 } },
    planResourceProfiles: { Free: {}, Starter: {}, Pro: {}, Enterprise: {} },
    planRankFor: (value) => ["Free", "Starter", "Pro", "Enterprise"].indexOf(value),
    computeCycleAmount: () => 2900,
    nextInvoiceNo: () => "test-INV001",
    paymentInstructionsFor: (tenant) => ({ amount: tenant.pendingAmount, invoiceNo: tenant.pendingInvoiceNo }),
    input: { fullName: "Shopify Merchant", email: "merchant@example.invalid", phone: "0000000000", passwordHash: "test-hash", ...input },
  };
  const result = await vm.runInNewContext(`${signupFunctions}\naddCustomerSignup(input)`, context);
  return { result, tenant: saved.tenants[0] };
}

test("a Shopify signup never stages an external checkout, even with a paid plan in the URL", async () => {
  const { result, tenant } = await runSignup({ storePlatform: "shopify", shopifyShop: "Review-Store.myshopify.com", plan: "Enterprise" });
  assert.equal(result.ok, true);
  assert.equal(Boolean(result.checkout), false);
  assert.equal(tenant.pendingPlan, undefined);
  assert.equal(tenant.signupPlatform, "shopify");
  assert.equal(tenant.shopifyShop, "review-store.myshopify.com");
  assert.equal(requiresShopifyBilling(tenant), true);
});

test("other platforms keep the existing paid-plan checkout", async () => {
  const { result, tenant } = await runSignup({ storePlatform: "woocommerce", plan: "Pro" });
  assert.equal(result.checkout, true);
  assert.equal(tenant.pendingPlan, "Pro");
  assert.equal(tenant.signupPlatform, "woocommerce");
  assert.equal(requiresShopifyBilling(tenant), false);
});

test("signup and login honour only the signed handoff cookie and clear it once used", () => {
  const signup = extractBetween('if (pathname === "/signup" && req.method === "POST")', 'if (pathname === "/verify" && req.method === "GET")');
  assert.match(signup, /delete values\.shopifyShop/);
  assert.match(signup, /readShopifyHandoffCookie\(/);
  assert.match(signup, /values\.plan = ""/);
  const verify = extractBetween('if (pathname === "/verify" && req.method === "POST")', 'if (pathname === "/checkout" && req.method === "GET")');
  assert.match(verify, /tg_shopify=; HttpOnly; SameSite=Lax; Path=\/; Max-Age=0/);
  const login = extractBetween('if (pathname === "/login" && req.method === "POST")', 'if (pathname === "/logout")');
  assert.match(login, /adoptShopifyBilling\(account\.tenantId, shopifyShop\)/);
  const start = extractBetween('if (pathname === "/shopify/start" && req.method === "GET")', 'if (pathname === "/signup" && req.method === "GET")');
  // The GET only sets a cookie or asks for confirmation; the workspace changes on POST.
  assert.doesNotMatch(start.slice(0, start.indexOf('req.method === "POST"')), /adoptShopifyBilling\(/);
});

test("Free-tier emails send Shopify-billed workspaces to Shopify plan selection", () => {
  const ctx = vm.createContext({ requiresShopifyBilling, shopifyPlanSelectionUrl, shopifyShopForTenant });
  vm.runInContext(extractFunction("upgradeCta"), ctx);
  const shopify = ctx.upgradeCta({ shopifyBillingRequired: true, shopifyShop: "review-store.myshopify.com" }, "Upgrade now");
  assert.equal(shopify.href, "https://admin.shopify.com/store/review-store/charges/tagioo-tracking/pricing_plans");
  assert.match(shopify.note, /billed through Shopify/);
  assert.doesNotMatch(shopify.note + shopify.label, /bKash|Nagad|Paddle|card/i);
  assert.equal(ctx.upgradeCta({ plan: "Free" }, "Upgrade now").href, "https://tagioo.com/#billing");
});
