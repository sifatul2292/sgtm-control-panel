import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("completed checkout disables repeat payment and waits for server activation, including refresh", async () => {
  const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const start = source.indexOf("function checkoutPage(");
  const page = source.slice(start, source.indexOf("\n}\n", start) + 3);
  const ctx = vm.createContext({ tagiooCapiDirect: () => true, escapeHtml: String, gtmHead: () => "", gtmNoscript: () => "", billingCycleConfig: { monthly: { months: 1 } } });
  vm.runInContext(page, ctx);
  const html = ctx.checkoutPage({ instructions: { billingCycle: "monthly", plan: "Starter" }, paddle: { enabled: true, env: "sandbox", invoiceNo: "test" } });
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  const button = { addEventListener() {} }, status = {}, skip = {}, localPayment = {};
  const storage = new Map(); let callback, timer, active = false;
  const window = { location: { href: "/checkout" } };
  const browser = vm.createContext({
    window, Date, JSON, AbortSignal,
    document: { getElementById: id => id === "coPayCard" ? button : id === "coLocalPayment" ? localPayment : id === "coSkipCheckout" ? skip : status, querySelector: () => skip },
    sessionStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    Paddle: { Environment: { set() {} }, Initialize: o => { callback = o.eventCallback; }, Checkout: { open() {} } },
    fetch: async () => ({ status: 200, ok: true, json: async () => ({ active }) }),
    setTimeout: fn => { timer = fn; }
  });
  vm.runInContext(script, browser);
  callback({ name: "checkout.completed" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(button.disabled, true);
  assert.match(html, /action="\/checkout\/skip"/);
  assert.equal(skip.hidden, true);
  assert.equal(localPayment.hidden, true);
  assert.match(status.textContent, /do not pay again/i);
  assert.equal(window.location.href, "/checkout");
  vm.runInContext(script, browser); // browser refresh restores receipt state
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(window.location.href, "/checkout");
  active = true; await timer();
  assert.equal(window.location.href, "/");
  assert.equal(storage.size, 0);
});

test("trial checkout discloses automatic monthly billing and cancellation", () => {
  const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const start = source.indexOf("function checkoutPage(");
  const ctx = vm.createContext({ tagiooCapiDirect: () => true, escapeHtml: String, gtmHead: () => "", gtmNoscript: () => "", billingCycleConfig: { monthly: { months: 1 } } });
  vm.runInContext(source.slice(start, source.indexOf("\n}\n", start) + 3), ctx);
  const html = ctx.checkoutPage({ instructions: { billingCycle: "monthly", plan: "Pro" }, paddle: { enabled: true, trialDays: 3, usdAmount: 50 } });
  assert.match(html, /Start 3-day free trial/);
  assert.match(html, /Nothing charged today/);
  assert.match(html, /After 3 days: \$50\/month plus applicable taxes, charged automatically/);
  assert.match(html, /Cancel before the trial ends/);
});

function paddleCheckoutBrowser({ statusBody }) {
  const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const start = source.indexOf("function checkoutPage(");
  const ctx = vm.createContext({ tagiooCapiDirect: () => true, escapeHtml: String, gtmHead: () => "", gtmNoscript: () => "", billingCycleConfig: { monthly: { months: 1 } } });
  vm.runInContext(source.slice(start, source.indexOf("\n}\n", start) + 3), ctx);
  const html = ctx.checkoutPage({ instructions: { billingCycle: "monthly", plan: "Pro" }, paddle: { enabled: true, trialDays: 3, usdAmount: 50, planName: "Pro", invoiceNo: "INV-7", tenantId: "t1" } });
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  const storage = new Map(); const timers = []; let callback;
  const window = { location: { href: "/checkout" } };
  const element = {};
  const browser = vm.createContext({
    window, Date, JSON, AbortSignal, Number, Boolean,
    document: { getElementById: id => id === "coPayCard" ? { addEventListener() {} } : element },
    sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    Paddle: { Environment: { set() {} }, Initialize: o => { callback = o.eventCallback; }, Checkout: { open() {} } },
    fetch: async () => ({ status: 200, ok: true, json: async () => statusBody }),
    setTimeout: fn => { timers.push(fn); }
  });
  vm.runInContext(script, browser);
  const events = () => window.dataLayer.filter(item => item.event);
  return { window, events, storage, timers, fire: name => callback({ name }) };
}

test("Paddle callbacks push begin_checkout and add_payment_info once with shared Meta IDs", () => {
  const page = paddleCheckoutBrowser({ statusBody: { active: false } });
  page.fire("checkout.loaded");
  page.fire("checkout.loaded");
  page.fire("checkout.payment.initiated");
  page.fire("checkout.payment.initiated");
  const events = page.events();
  assert.equal(events.map(e => e.event).join(","), "begin_checkout,add_payment_info");
  assert.equal(events[0].event_id, "initiate_checkout_INV-7");
  assert.equal(events[1].event_id, "add_payment_info_INV-7");
  assert.equal(events[0].ecommerce.currency, "USD");
  assert.equal(events[0].ecommerce.value, 50);
  assert.equal(events[0].plan, "Pro");
  assert.ok(page.window.dataLayer.some(item => item.ecommerce === null));
});

test("start_trial fires only after server confirms webhook trial, then continues once", async () => {
  const page = paddleCheckoutBrowser({ statusBody: { active: true, trial: true, trialEventId: "trial_sub_1" } });
  page.fire("checkout.completed");
  assert.equal(page.events().length, 0, "checkout.completed alone must not claim a trial");
  await new Promise(resolve => setImmediate(resolve));
  const events = page.events();
  assert.equal(events.map(e => e.event).join(","), "start_trial");
  assert.equal(events[0].event_id, "trial_sub_1");
  assert.equal(events[0].ecommerce.value, 0);
  assert.equal(page.window.location.href, "/checkout");
  events[0].eventCallback();
  assert.equal(page.window.location.href, "/");
  page.window.location.href = "/checkout";
  page.timers.forEach(fn => fn());
  assert.equal(page.window.location.href, "/checkout", "fallback timer must not navigate twice");
  assert.ok(!page.events().some(e => e.event === "purchase"));
});

test("paid activation never pushes trial or browser purchase", async () => {
  const page = paddleCheckoutBrowser({ statusBody: { active: true, trial: false } });
  page.fire("checkout.completed");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.events().length, 0);
  assert.equal(page.window.location.href, "/");
});

test("backend keeps GA4 single-sender: Paddle checkout and trial send Meta only", async () => {
  const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const extract = name => { const s = source.search(new RegExp("(?:async )?function " + name + "\\(")); return source.slice(s, source.indexOf("\n}\n", s) + 3); };
  const ga = [], meta = [];
  let paddleEnabled = true;
  const ctx = vm.createContext({
    readDatabase: async () => ({ available: true, data: { tenants: [{ id: "t1", pendingPlan: "Pro" }] } }),
    saveTagiooVisitorContext: async () => {}, storedTagiooVisitor: () => null,
    paddleCheckoutConfigFor: () => paddleEnabled ? { enabled: true, usdAmount: 50 } : { enabled: false },
    forwardTagiooOwnEvent: async (name, opts) => { ga.push([name, opts]); },
    sendTagiooFunnelEventToMetaCapi: async (name, tenant, opts) => { meta.push([name, opts]); }
  });
  vm.runInContext(extract("trackTagiooCheckoutStep"), ctx);
  await ctx.trackTagiooCheckoutStep("initiate_checkout", { tenantId: "t1", plan: "Pro", amount: 2900, orderId: "INV-7" });
  assert.equal(ga.length, 0);
  assert.equal(meta[0][0], "InitiateCheckout");
  assert.equal(meta[0][1].eventId, "initiate_checkout_INV-7");
  assert.equal(meta[0][1].currency, "USD");
  assert.equal(meta[0][1].amount, 50);
  paddleEnabled = false;
  await ctx.trackTagiooCheckoutStep("initiate_checkout", { tenantId: "t1", plan: "Pro", amount: 2900, orderId: "INV-8" });
  assert.equal(ga[0][0], "begin_checkout");
  assert.equal(ga[0][1].eventParams["ep.event_id"], "initiate_checkout_INV-8");
  const activation = extract("activatePaddleTenantLocked");
  const trialBranch = activation.slice(activation.indexOf("if (isTrial) {\n    const eventId"), activation.indexOf("} else {", activation.indexOf("if (isTrial) {\n    const eventId")));
  assert.match(trialBranch, /sendTagiooFunnelEventToMetaCapi\("StartTrial"/);
  assert.doesNotMatch(trialBranch, /forwardTagiooOwnEvent/);
  assert.match(source, /trialEventId: `trial_\$\{tenant\.paddleSubscriptionId\}`/);
});

test("returning customer with an older paid receipt still reaches the new checkout", () => {
  const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const s = source.indexOf("function checkoutRequired(");
  const ctx = vm.createContext({ requiresShopifyBilling: () => false });
  vm.runInContext(source.slice(s, source.indexOf("\n}\n", s) + 3), ctx);
  const tenant = { id: "t1", pendingPlan: "Starter", subscriptionStatus: "pending_payment", pendingInvoiceNo: "t1-INV003" };
  assert.equal(ctx.checkoutRequired(tenant, { payments: [{ tenantId: "t1", status: "confirmed", invoiceNo: "t1-INV002" }] }), true);
  assert.equal(ctx.checkoutRequired(tenant, { payments: [{ tenantId: "t1", status: "pending", invoiceNo: "t1-INV003" }] }), false);
});
