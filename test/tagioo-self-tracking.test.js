import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
function extract(name) {
  const start = source.search(new RegExp("(?:async )?function " + name + "\\("));
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}
test("own GA events retain browser identity and fresh session without leaking signup query", async () => {
  let sent;
  const ctx = vm.createContext({
    URL, URLSearchParams, Date,
    TAGIOO_OWN_TRACKING: { measurementId: "G-TEST", domain: "https://server.example.com" },
    parseCookies: () => ({ _ga: "GA1.1.123.456", _ga_TEST: "GS2.1.s789$o1", tg_vid: "visitor" }),
    getClientIp: () => "192.0.2.1", mpClientId: seed => "fallback-" + seed,
    fetch: async (url) => { sent = new URL(url); return { ok: true }; }
  });
  vm.runInContext(["tagiooVisitorContext", "forwardTagiooOwnEvent", "storedTagiooVisitor"].map(extract).join("\n"), ctx);
  const visitor = ctx.tagiooVisitorContext({ headers: { host: "tagioo.com" }, url: "/signup?email=private@example.com" });
  assert.equal(visitor.gaClientId, "123.456");
  assert.equal(visitor.gaSessionId, "789");
  await ctx.forwardTagiooOwnEvent("sign_up", { seed: "account", visitor });
  assert.equal(sent.searchParams.get("cid"), "123.456");
  assert.equal(sent.searchParams.get("sid"), "789");
  assert.equal(sent.searchParams.get("dl"), "https://tagioo.com/signup");
  const stored = ctx.storedTagiooVisitor({ tracking: { tagiooVisitor: { ...visitor, at: new Date(Date.now() - 3600000).toISOString() } } });
  assert.equal(stored.gaClientId, "123.456");
  assert.equal(stored.gaSessionId, "");
  await ctx.forwardTagiooOwnEvent("purchase", { seed: "invoice", visitor: { vid: "visitor" } });
  assert.equal(sent.searchParams.get("cid"), "fallback-visitor");
});
test("own Meta purchases preserve USD Paddle currency and BDT manual fallback", async () => {
  let sent;
  const ctx = vm.createContext({
    tagiooNameParts: () => ({}), sha256Hex: value => value || "",
    capiEventTime: () => 123, storedTagiooVisitor: () => null,
    applyTagiooVisitorContext: event => event,
    sendTagiooOwnMetaEvent: async event => { sent = event; }
  });
  vm.runInContext(extract("sendTagiooPurchaseToMetaCapi"), ctx);
  await ctx.sendTagiooPurchaseToMetaCapi({ email: "buyer@example.com" }, { id: "p1", amount: 30, currency: "USD" }, "purchase_p1");
  assert.equal(sent.custom_data.currency, "USD");
  assert.equal(sent.custom_data.value, 30);
  await ctx.sendTagiooPurchaseToMetaCapi({ email: "buyer@example.com" }, { id: "p2", amount: 3000 }, "purchase_p2");
  assert.equal(sent.custom_data.currency, "BDT");
});
