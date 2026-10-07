import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("completed checkout disables repeat payment and waits for server activation, including refresh", async () => {
  const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const start = source.indexOf("function checkoutPage(");
  const page = source.slice(start, source.indexOf("\n}\n", start) + 3);
  const ctx = vm.createContext({ escapeHtml: String, gtmHead: () => "", gtmNoscript: () => "", billingCycleConfig: { monthly: { months: 1 } } });
  vm.runInContext(page, ctx);
  const html = ctx.checkoutPage({ instructions: { billingCycle: "monthly", plan: "Starter" }, paddle: { enabled: true, env: "sandbox", invoiceNo: "test" } });
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  const button = { addEventListener() {} }, status = {}, skip = {}, localPayment = {};
  const storage = new Map(); let callback, timer, active = false;
  const window = { location: { href: "/checkout" } };
  const browser = vm.createContext({
    window, Date, JSON, AbortSignal,
    document: { getElementById: id => id === "coPayCard" ? button : id === "coLocalPayment" ? localPayment : status, querySelector: () => skip },
    sessionStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    Paddle: { Environment: { set() {} }, Initialize: o => { callback = o.eventCallback; }, Checkout: { open() {} } },
    fetch: async () => ({ status: 200, ok: true, json: async () => ({ active }) }),
    setTimeout: fn => { timer = fn; }
  });
  vm.runInContext(script, browser);
  callback({ name: "checkout.completed" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(button.disabled, true);
  assert.doesNotMatch(html, /action="\/checkout\/skip"|Not now — continue/);
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
