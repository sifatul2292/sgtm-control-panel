import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { requiresShopifyBilling } from "../shopify-billing.js";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
function helper(name) {
  const start = source.indexOf(`function ${name}(`);
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}
function context() {
  const ctx = vm.createContext({
    requiresShopifyBilling,
    config: { paddleClientToken: "test_token", paddleApiKey: "sandbox_key", paddleWebhookSecret: "secret", paddlePriceIds: { Starter: "pri_starter", Pro: "pri_pro", Enterprise: "pri_enterprise" }, paddleEnv: "sandbox" },
    paddleUsdMonthly: { Starter: 30, Pro: 50, Enterprise: 100 },
    escapeHtml: String, gtmHead: () => "", gtmNoscript: () => "",
    billingCycleConfig: { monthly: { months: 1 }, yearly: { months: 12 } }
  });
  vm.runInContext(["paddleCatalogReady", "paddleCheckoutConfigFor", "checkoutPage"].map(helper).join("\n"), ctx);
  return ctx;
}
test("USD checkout is available regardless of country, preserving BD local prices", () => {
  const ctx = context();
  for (const country of ["BD", "US", "OTHER", ""]) {
    const paddle = ctx.paddleCheckoutConfigFor({ country, pendingPlan: "Pro", pendingInvoiceNo: "invoice", id: "tenant" });
    assert.equal(paddle.enabled, true);
    assert.equal(paddle.usdAmount, 50);
    assert.equal(paddle.priceId, "pri_pro");
    const html = ctx.checkoutPage({ instructions: { plan: "Pro", amount: 2900, billingCycle: "monthly", bkashNumber: "test" }, paddle });
    assert.match(html, /Pay with card — \$50\/mo/);
    assert.match(html, /sandbox test mode/);
    assert.equal(html.includes('id="checkoutForm"'), country === "BD");
    if (country === "BD") {
      assert.match(html, /2,900 per month \(BDT\)/);
      assert.match(html, /action="\/checkout"/);
    }
    for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
  }
});
test("missing Paddle configuration or unmapped plan keeps manual checkout", () => {
  const ctx = context();
  ctx.config.paddleClientToken = "";
  assert.equal(ctx.paddleCheckoutConfigFor({ country: "BD", pendingPlan: "Pro" }).enabled, false);
  ctx.config.paddleClientToken = "test_token";
  assert.equal(ctx.paddleCheckoutConfigFor({ country: "BD", pendingPlan: "Free" }).enabled, false);
  const html = ctx.checkoutPage({ instructions: { plan: "Pro", amount: 2900, billingCycle: "monthly" } });
  assert.match(html, /id="checkoutForm"/);
  assert.doesNotMatch(html, /id="coPayCard"/);
});
