import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const sha = (v) => createHash("sha256").update(v).digest("hex");
function templateCode(fnName) {
  const start = source.indexOf(`function ${fnName}()`);
  const data = new Function(source.slice(start, source.indexOf("`;\n}\n", start) + 5) + `;return ${fnName};`)()();
  return data.split("___SANDBOXED_JS_FOR_SERVER___")[1].split("___SERVER_PERMISSIONS___")[0];
}
function run(fnName, eventData, { cookies = {} } = {}) {
  const sent = [], setCookies = [];
  const apis = {
    getAllEventData: () => eventData, getCookieValues: (n) => (cookies[n] ? [cookies[n]] : []),
    getRequestHeader: () => undefined, getTimestampMillis: () => 1700000000000,
    getType: (v) => (Array.isArray(v) ? "array" : typeof v), JSON, Math, logToConsole: () => {},
    makeString: (v) => String(v), makeNumber: (v) => Number(v),
    sendHttpRequest: (url, o, body) => { sent.push(JSON.parse(body)); return { then: () => {} }; },
    setCookie: (name, value, options) => setCookies.push({ name, value, options }), sha256Sync: (v) => sha(v)
  };
  new Function("require", "data", templateCode(fnName))((n) => apis[n], { pixelId: "P", accessToken: "t", gtmOnSuccess() {}, gtmOnFailure() {} });
  return { body: sent[0], setCookies };
}

test("TikTok reads dotted user_data params and falls back external_id to hashed phone", () => {
  const { body } = run("tagiooTikTokEventsApiTemplateData", { event_name: "purchase", transaction_id: "9", "user_data.phone_number": "8801711111111", "user_data.email_address": "A@B.co" });
  const user = body.data[0].user;
  assert.equal(user.email, sha("a@b.co"));
  assert.equal(user.phone, sha("8801711111111"));
  assert.equal(user.external_id, user.phone);
});

test("TikTok and Meta share one identity cookie with the same fields and hashes", () => {
  const event = { event_name: "purchase", transaction_id: "1", user_data: { email_address: "a@b.co", phone_number: "8801700000000", first_name: "Ann", city: "Dhaka", country: "BD" } };
  const fields = (cookie) => Object.fromEntries(cookie.value.split("~").map((p) => p.split(":")));
  const tiktok = fields(run("tagiooTikTokEventsApiTemplateData", event, { cookies: { FPID: "f1" } }).setCookies[0]);
  const meta = fields(run("tagiooMetaCapiTemplateData", event, { cookies: { FPID: "f1" } }).setCookies[0]);
  for (const key of ["em", "ph", "fn", "ct", "country", "external_id"]) assert.equal(tiktok[key], meta[key], key);

  const later = run("tagiooTikTokEventsApiTemplateData", { event_name: "page_view" }, { cookies: { tagioo_ud: Object.entries(meta).map(([k, v]) => k + ":" + v).join("~") } });
  assert.equal(later.body.data[0].user.email, meta.em);
  assert.equal(later.body.data[0].user.phone, meta.ph);
});

test("TikTok skips the identity cookie when ad_storage is denied", () => {
  const { setCookies, body } = run("tagiooTikTokEventsApiTemplateData", { event_name: "purchase", "x-ga-gcs": "G100", user_data: { email_address: "a@b.co" } }, { cookies: { tagioo_ud: "ph:" + sha("1") } });
  assert.equal(setCookies.length, 0);
  assert.equal(body.data[0].user.phone, undefined);
});

test("TikTok permissions allow the shared cookie", () => {
  const start = source.indexOf("function tagiooTikTokEventsApiTemplateData()");
  const perms = source.slice(start, source.indexOf("`;\n}\n", start)).split("___SERVER_PERMISSIONS___")[1];
  assert.match(perms, /"set_cookies"[\s\S]*"tagioo_ud"/);
  assert.match(perms, /"string": "FPID" \}, \{ "type": 1, "string": "tagioo_ud" \}/);
});

const ctx = vm.createContext({ COOKIE_DAYS_DEFAULT: 730, clampCookieDays: Number });
vm.runInContext(source.slice(source.indexOf("function cleanTemplateValue("), source.indexOf("function loginPage(")), ctx);

test("WooCommerce: TikTok server tag skips the browser-origin purchase like Meta", () => {
  const server = ctx.buildSetupAssistantTemplates({ businessType: "ecommerce", platform: "woocommerce", destinations: ["tiktok"], tiktokPixelId: "T" }).server.containerVersion;
  const tag = server.tag.find((t) => /TikTok/.test(t.name));
  assert.equal(JSON.stringify(tag.blockingTriggerId), '["7"]');
  assert.ok(server.trigger.some((t) => t.triggerId === "7"));
  const shopify = ctx.buildSetupAssistantTemplates({ businessType: "ecommerce", platform: "shopify", destinations: ["tiktok"], tiktokPixelId: "T" }).server.containerVersion;
  assert.equal(shopify.tag.find((t) => /TikTok/.test(t.name)).blockingTriggerId, undefined);
});

test("browser TikTok events identify the shopper from the same dataLayer push", () => {
  const web = ctx.buildSetupAssistantTemplates({ businessType: "ecommerce", platform: "woocommerce", destinations: ["tiktok"], tiktokPixelId: "T" }).web.containerVersion;
  const html = web.tag.find((t) => t.name === "Tagioo TikTok - CompletePayment").parameter.find((p) => p.key === "html").value;
  const script = html.replace(/^<script>|<\/script>$/g, "").replace("{{Tagioo - event_id}}", "1001");
  const calls = [];
  const window = { dataLayer: [{ event: "purchase", event_id: "1001", user_data: { email_address: " A@B.co ", phone_number: "+880 1700-000000" }, ecommerce: { value: 5, currency: "BDT", items: [] } }],
    ttq: { identify: (p) => calls.push(["identify", p]), track: (n, p, o) => calls.push(["track", n, o]) } };
  vm.runInNewContext(script, { window, ttq: window.ttq });
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ["identify", { email: "a@b.co", phone_number: "+8801700000000" }]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), ["track", "CompletePayment", { event_id: "1001" }]);
  const anon = { dataLayer: [{ event: "view_item", event_id: "v1", ecommerce: { items: [] } }], ttq: { identify: () => calls.push("bad"), track: () => {} } };
  vm.runInNewContext(script.replace("1001", "v1"), { window: anon, ttq: anon.ttq });
  assert.ok(!calls.includes("bad"), "no identify without customer data");
});
