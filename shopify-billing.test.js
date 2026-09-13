import test from "node:test";
import assert from "node:assert/strict";
import { highestActiveShopifyPlan, normalizeShopifyBillingState } from "./shopify-billing.js";

test("accepts a signed-source paid-plan payload after normalization", () => {
  assert.deepEqual(normalizeShopifyBillingState({
    shop: "Test-Store.myshopify.com",
    plan: "Starter",
    billingPeriod: "EVERY_30_DAYS",
    cycleStart: "2026-09-13T00:00:00.000Z",
    cycleEnd: "2026-10-13T00:00:00.000Z",
    amount: "30.00",
    currency: "usd"
  }), {
    ok: true,
    value: {
      shop: "test-store.myshopify.com",
      plan: "Starter",
      status: "active",
      billingPeriod: "EVERY_30_DAYS",
      cycleStart: "2026-09-13T00:00:00.000Z",
      cycleEnd: "2026-10-13T00:00:00.000Z",
      cancelAtEndOfCycle: false,
      amount: 30,
      currency: "USD"
    }
  });
});

test("rejects unknown plans and paid plans without a cycle end", () => {
  assert.equal(normalizeShopifyBillingState({ shop: "test.myshopify.com", plan: "Agency" }).ok, false);
  assert.equal(normalizeShopifyBillingState({ shop: "test.myshopify.com", plan: "Pro" }).ok, false);
});

test("accepts a disconnected store only as a free entitlement", () => {
  const result = normalizeShopifyBillingState({
    shop: "test.myshopify.com",
    plan: "Free",
    status: "disconnected"
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.status, "disconnected");
});

test("keeps the highest active Shopify plan across connected stores", () => {
  const rank = (plan) => ({ Free: 0, Starter: 1, Pro: 2, Enterprise: 3 })[plan] || 0;
  assert.equal(highestActiveShopifyPlan([
    { plan: "Starter", status: "active" },
    { plan: "Enterprise", status: "free" },
    { plan: "Pro", status: "active" }
  ], rank).plan, "Pro");
});
