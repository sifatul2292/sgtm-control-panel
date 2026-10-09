import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { requiresShopifyBilling } from "../shopify-billing.js";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
function extract(name, async = false) {
  const start = source.indexOf(`${async ? "async " : ""}function ${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}
const shopifyTenants = [
  { paymentProvider: "shopify" },
  { platform: "shopify" },
  { shopifyBillingRequired: true },
  { tracking: { shopify: { shop: "review.myshopify.com" } } },
  { tracking: { shopify: { connectCodeHash: "pending" } } },
  { tracking: { containerConfigs: { secondary: { platform: "shopify" } } } },
];

test("Shopify billing is required before sync and after disconnect; other platforms stay eligible", () => {
  for (const tenant of shopifyTenants) assert.equal(requiresShopifyBilling(tenant), true);
  for (const tenant of [null, {}, { platform: "woocommerce" }, { paymentProvider: "paddle" }]) {
    assert.equal(requiresShopifyBilling(tenant), false);
  }
});

test("Shopify workspaces cannot receive external checkout or payment instructions", () => {
  const ctx = vm.createContext({ requiresShopifyBilling });
  vm.runInContext(["paymentInstructionsFor", "paddleCheckoutConfigFor", "checkoutRequired"].map((name) => extract(name)).join("\n"), ctx);
  for (const base of shopifyTenants) {
    const tenant = { ...base, pendingPlan: "Pro", subscriptionStatus: "pending_payment" };
    assert.equal(ctx.paymentInstructionsFor(tenant, {}), null);
    assert.equal(ctx.paddleCheckoutConfigFor(tenant).enabled, false);
    assert.equal(ctx.checkoutRequired(tenant, {}), false);
  }
});

test("manual plans, claims, add-ons, owner confirmation and Paddle activation reject Shopify without writes", async () => {
  for (const base of shopifyTenants) {
    const tenant = { ...base, id: "review", plan: "Free", pendingPlan: "Pro" };
    const data = { tenants: [tenant], payments: [{ id: "old-claim", tenantId: "review", status: "pending" }] };
    let writes = 0;
    const ctx = vm.createContext({
      requiresShopifyBilling,
      readDatabase: async () => ({ available: true, data }),
      writeDatabase: async () => { writes++; },
      billingCycleConfig: { monthly: {} }, planResourceProfiles: { Pro: {} },
    });
    const names = ["selectCustomerPlanLocked", "submitPaymentClaimLocked", "submitExtraContainerClaimLocked", "confirmPaymentLocked", "activatePaddleTenantLocked"];
    vm.runInContext(names.map((name) => extract(name, true)).join("\n"), ctx);
    const session = { tenantId: "review" };
    const claim = { method: "bkash", txnId: "test", senderNumber: "test" };
    const results = [
      await ctx.selectCustomerPlanLocked({ plan: "Pro" }, session),
      await ctx.submitPaymentClaimLocked(claim, session),
      await ctx.submitExtraContainerClaimLocked(claim, session),
      await ctx.confirmPaymentLocked("old-claim", { role: "owner" }),
      await ctx.activatePaddleTenantLocked({ tenantId: "review", planName: "Pro", paddleTransactionId: "test" }),
    ];
    for (const result of results) { assert.equal(result.ok, false); assert.equal(result.status, 409); }
    assert.equal(writes, 0);
    assert.equal(data.payments.length, 1);
    assert.equal(tenant.plan, "Free");
  }
});

test("Shopify workspaces cannot request a Paddle plan change or portal", async () => {
  const ctx = vm.createContext({ requiresShopifyBilling });
  vm.runInContext(["updatePaddleSubscriptionPlan", "createPaddlePortalSession"].map((name) => extract(name, true)).join("\n"), ctx);
  for (const tenant of shopifyTenants) {
    assert.equal((await ctx.updatePaddleSubscriptionPlan(tenant, "Pro")).status, 409);
    assert.equal((await ctx.createPaddlePortalSession(tenant)).status, 409);
  }
});
