import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const start = source.indexOf("function tagiooMetaCapiTemplateData()");
const templateData = new Function(source.slice(start, source.indexOf("`;\n}\n", start) + 5) + ";return tagiooMetaCapiTemplateData;")()();
const code = templateData.split("___SANDBOXED_JS_FOR_SERVER___")[1].split("___SERVER_PERMISSIONS___")[0];
const sha = (v) => createHash("sha256").update(v).digest("hex");

// Runs the sandboxed template with stubbed GTM server APIs; returns the Meta
// payload and any cookie the template set.
function run(eventData, { cookies = {}, headers = {}, data = {} } = {}) {
  const sent = [], setCookies = [];
  const apis = {
    getAllEventData: () => eventData,
    getCookieValues: (name) => (cookies[name] ? [cookies[name]] : []),
    getRequestHeader: (name) => headers[name],
    getTimestampMillis: () => 1700000000000,
    getType: (v) => (Array.isArray(v) ? "array" : typeof v),
    JSON, Math, logToConsole: () => {},
    makeString: (v) => String(v), makeNumber: (v) => Number(v),
    sendHttpRequest: (url, opts, body) => { sent.push(JSON.parse(body)); return { then: () => {} }; },
    setCookie: (name, value, options) => setCookies.push({ name, value, options }),
    sha256Sync: (v) => sha(v)
  };
  const fn = new Function("require", "data", code);
  fn((name) => apis[name], { pixelId: "1", accessToken: "t", gtmOnSuccess() {}, gtmOnFailure() {}, ...data });
  return { event: sent[0]?.data[0], setCookies, body: sent[0] };
}

test("purchase remembers hashed identity; later PageView reuses it", () => {
  const purchase = run({ event_name: "purchase", event_id: "1001", transaction_id: "1001",
    user_data: { email_address: "A@B.co", phone_number: "8801700000000", first_name: "Ann", city: "dhaka", country: "bd" } },
    { cookies: { FPID: "fpid-1" } });
  assert.equal(purchase.event.user_data.em, sha("a@b.co"));
  assert.equal(purchase.event.user_data.external_id, sha("fpid-1"));
  assert.equal(purchase.setCookies.length, 1);
  const cookie = purchase.setCookies[0];
  assert.equal(cookie.name, "tagioo_ud");
  assert.equal(cookie.options.httpOnly, true);
  assert.doesNotMatch(cookie.value, /a@b\.co|8801700000000|Ann/i, "only hashes are stored");

  const pageView = run({ event_name: "page_view" }, { cookies: { tagioo_ud: cookie.value, FPID: "fpid-1" } });
  for (const key of ["em", "ph", "fn", "ct", "country", "external_id"]) assert.equal(pageView.event.user_data[key], purchase.event.user_data[key], key);
  assert.equal(pageView.setCookies.length, 1, "refreshes the remembered identity");
});

test("cookie-less backend purchase falls back to hashed phone for external_id", () => {
  const { event } = run({ event_name: "purchase", transaction_id: "9", user_data: { phone_number: "8801711111111" } });
  assert.equal(event.user_data.external_id, sha("8801711111111"));
});

test("ad_storage denied: identity cookie is neither read nor written", () => {
  const { event, setCookies } = run({ event_name: "purchase", "x-ga-gcs": "G100", user_data: { email_address: "a@b.co" } },
    { cookies: { tagioo_ud: "ph:" + sha("1") } });
  assert.equal(setCookies.length, 0);
  assert.equal(event.user_data.ph, undefined);
});

test("country: pushed value, then Cloudflare header, then store default, never a hard-coded bd", () => {
  assert.equal(run({ event_name: "page_view" }, { headers: { "cf-ipcountry": "US" } }).event.user_data.country, sha("us"));
  assert.equal(run({ event_name: "page_view" }, { headers: { "cf-ipcountry": "XX" }, data: { defaultCountry: "CA" } }).event.user_data.country, sha("ca"));
  assert.equal(run({ event_name: "page_view" }).event.user_data.country, undefined);
  assert.equal(run({ event_name: "page_view", user_data: { country: "GB" } }, { headers: { "cf-ipcountry": "US" } }).event.user_data.country, sha("gb"));
});

test("tampered identity cookie values are ignored", () => {
  const { event } = run({ event_name: "page_view" }, { cookies: { tagioo_ud: "em:not-a-hash~zz:" + sha("x") } });
  assert.equal(event.user_data.em, undefined);
});

test("template declares the cookie and header permissions it uses", () => {
  const permissions = templateData.split("___SERVER_PERMISSIONS___")[1];
  assert.match(permissions, /"set_cookies"[\s\S]*"tagioo_ud"/);
  assert.match(permissions, /"string": "tagioo_ud" \}\] \} \}/);
  assert.match(permissions, /"cf-ipcountry"/);
  assert.match(permissions, /"x-tagioo-country"/);
});

test("server export passes BD default only for BDT stores", () => {
  const vm = new Function("source", `const ctx = {COOKIE_DAYS_DEFAULT: 730, clampCookieDays: Number};
    return new Function(...Object.keys(ctx), source + ";return buildSetupAssistantTemplates;")(...Object.values(ctx));`);
  const build = vm(source.slice(source.indexOf("function cleanTemplateValue("), source.indexOf("function loginPage(")));
  const country = (input) => JSON.stringify(build({ businessType: "ecommerce", platform: "woocommerce", destinations: ["meta"], metaPixelId: "1", ...input })
    .server.containerVersion.tag.find((t) => /Meta/.test(t.name)).parameter.find((p) => p.key === "defaultCountry").value);
  assert.equal(country({ currency: "BDT" }), '"BD"');
  assert.equal(country({ currency: "USD" }), '""');
  assert.equal(country({ currency: "USD", defaultCountry: "us" }), '"US"');
});
