import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
function extract(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}

function fixture() {
  let saved = { tenants: [{ id: "review", tracking: { domain: "https://track.example.com", measurementId: "G-TEST" } }], orders: [] };
  let fail = true;
  let attempts = 0;
  let meta = 0;
  const ctx = vm.createContext({
    withDbLock: async fn => fn(),
    readDatabase: async () => ({ available: true, data: structuredClone(saved) }),
    writeDatabase: async data => { saved = structuredClone(data); },
    normalizeOrderPayload: body => ({ ...body, items: [] }),
    trackingForContainer: tenant => tenant.tracking,
    isPaidOrderStatus: order => order.status === "paid",
    forwardOrderToSgtm: async () => { attempts++; if (fail) throw new Error("temporary tracking outage"); },
    sendOrderToMetaCapi: async () => { meta++; },
  });
  vm.runInContext([extract("addOrderWebhook"), extract("addOrderWebhookLocked")].join("\n"), ctx);
  return { ctx, saved: () => saved, attempts: () => attempts, meta: () => meta, recover: () => { fail = false; } };
}

const order = { id: "42", tenantId: "review", containerId: "", amount: 36.92, currency: "USD", status: "paid", source: "tagioo-shopify-app" };

test("a failed Shopify purchase stays retryable until sGTM accepts it; replays stay one order", async () => {
  const f = fixture();
  const first = await f.ctx.addOrderWebhook(order);
  assert.equal(first.ok, false);
  assert.equal(first.status, 503);
  assert.equal(f.saved().orders.length, 1);
  assert.equal(f.saved().orders[0].forwardedToSgtmAt, undefined);
  f.recover();
  assert.equal((await f.ctx.addOrderWebhook(order)).ok, true);
  assert.ok(f.saved().orders[0].forwardedToSgtmAt);
  assert.equal((await f.ctx.addOrderWebhook(order)).ok, true);
  assert.equal(f.attempts(), 2);
  assert.equal(f.meta(), 1);
  assert.equal(f.saved().orders.length, 1);
});

test("strict Shopify forwarding treats HTTP rejection as retryable and bounds the request", async () => {
  const ctx = vm.createContext({
    URLSearchParams, AbortSignal, mpClientId: () => "client", console: { warn: () => {} },
    fetch: async (_url, options) => { assert.ok(options.signal); return { ok: false, status: 503 }; },
  });
  vm.runInContext(extract("forwardOrderToSgtm"), ctx);
  await assert.rejects(ctx.forwardOrderToSgtm({ ...order, items: [] }, { domain: "https://track.example.com", measurementId: "G-TEST" }, { requireSuccess: true }), /503/);
});
