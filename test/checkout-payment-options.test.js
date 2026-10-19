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
    tagiooCapiDirect: () => true,
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

test("Free BD accounts default to USD card pricing while manual paid accounts retain BDT", () => {
  const ctx = context();
  ctx.currencyForCountry = country => country === 'US' ? 'USD' : 'BDT';
  vm.runInContext(helper('billingCurrencyForTenant'), ctx);
  assert.equal(ctx.billingCurrencyForTenant({ plan: 'Free', country: 'BD' }), 'USD');
  assert.equal(ctx.billingCurrencyForTenant({ plan: 'Pro', country: 'BD', paymentProvider: 'manual' }), 'BDT');
  assert.equal(ctx.billingCurrencyForTenant({ plan: 'Pro', country: 'BD', paymentProvider: 'paddle' }), 'USD');
  ctx.config.paddleClientToken = '';
  assert.equal(ctx.billingCurrencyForTenant({ plan: 'Free', country: 'BD' }), 'BDT');
});

test("Paddle upgrade navigates before a billing refresh can stall or hit the checkout gate", async () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('async function selectSubscriptionPlan(');
  const fn = app.slice(start, app.indexOf('\n}\n', start) + 3);
  let destination, refreshed = false;
  const button = { dataset: { planSelect: 'Pro' }, textContent: 'Upgrade', hasAttribute: () => false };
  const ctx = vm.createContext({
    tagiooCapiDirect: () => true,
    document: { querySelectorAll: () => [button] }, selectedCycle: { id: 'monthly' },
    fetch: async () => ({ ok: true, json: async () => ({ payment: {}, checkoutProvider: 'paddle' }) }),
    window: { location: { assign: value => { destination = value; } }, alert: assert.fail },
    setView: assert.fail, loadBillingPayment: () => { refreshed = true; }
  });
  vm.runInContext(fn, ctx);
  const pending = ctx.selectSubscriptionPlan('Pro');
  assert.equal(button.textContent, 'Opening checkout…');
  await pending;
  assert.equal(destination, '/checkout');
  assert.equal(refreshed, false);
});
