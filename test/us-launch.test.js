import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { applyMarketingContent, visibleCaseStudies } from "../marketing-content.js";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const pub = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");
function extract(name) {
  const start = source.search(new RegExp("(?:async )?function " + name + "\\("));
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}
const gtmId = source.match(/const TAGIOO_GTM_ID = "([^"]+)"/)[1];
const bootStart = source.indexOf("const TAGIOO_BOOT_SCRIPT = `") + "const TAGIOO_BOOT_SCRIPT = `".length;
const BOOT = new Function("TAGIOO_GTM_ID", "return `" + source.slice(bootStart, source.indexOf("`;", bootStart)) + "`;")(gtmId);
const marketingPages = readdirSync(new URL("../public/", import.meta.url)).filter((f) => f.endsWith(".html") && f !== "index.html");

test("static pages embed the same boot snippet as server-rendered pages", () => {
  for (const name of marketingPages) {
    const html = pub(name);
    if (!html.includes("googletagmanager.com/gtm.js")) continue;
    assert.ok(html.includes(BOOT.trim()), `${name} boot snippet out of sync with server.js`);
  }
});

function runBoot(search, cookie = "") {
  const jar = new Map(cookie.split("; ").filter(Boolean).map((c) => c.split("=")));
  const appended = [];
  const document = {
    get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); },
    set cookie(value) { const [pair, ...attrs] = value.split(";"); const [k, v] = pair.split("="); if (attrs.some((a) => a === "max-age=0")) jar.delete(k); else jar.set(k, v); },
    createElement: () => ({}),
    head: { appendChild: (el) => appended.push(el) }
  };
  const window = { crypto: { getRandomValues: (a) => a.fill(171) } };
  window.window = window;
  const script = BOOT.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, { window, document, location: { search, hostname: "tagioo.com", protocol: "https:" }, URLSearchParams, crypto: window.crypto, Date, Math });
  return { jar, appended, window };
}

test("boot snippet captures fbclid into _fbc, mints _fbp and tg_vid, loads GTM", () => {
  const { jar, appended } = runBoot("?fbclid=AbC_123&utm_source=fb");
  assert.match(jar.get("_fbc"), /^fb\.1\.\d+\.AbC_123$/);
  assert.match(jar.get("_fbp"), /^fb\.1\.\d+\.\d{10}$/);
  assert.match(jar.get("tg_vid"), /^[0-9a-f]{32}$/);
  assert.equal(appended.length, 1);
  const again = runBoot("?fbclid=AbC_123", `_fbc=fb.1.1.AbC_123; _fbp=fb.1.1.42`);
  assert.equal(again.jar.get("_fbc"), "fb.1.1.AbC_123");
  assert.equal(again.jar.get("_fbp"), "fb.1.1.42");
});

test("?internal=1 opts the browser out of GTM; ?internal=0 opts back in", () => {
  const first = runBoot("?internal=1");
  assert.equal(first.jar.get("tg_internal"), "1");
  assert.equal(first.appended.length, 0);
  assert.equal(runBoot("", "tg_internal=1").appended.length, 0);
  assert.equal(runBoot("?internal=0", "tg_internal=1").appended.length, 1);
});

test("internal visitors never reach own GA4 or Meta CAPI", async () => {
  let sent = 0;
  const ctx = vm.createContext({
    URL, URLSearchParams, Date, Symbol, console,
    TAGIOO_OWN_TRACKING: { measurementId: "G-TEST", domain: "https://s.example", metaPixelId: "1", metaCapiToken: "t", internalIps: ["203.0.113.9"] },
    parseCookies: (raw) => Object.fromEntries(String(raw || "").split("; ").filter(Boolean).map((c) => c.split("="))),
    getClientIp: (req) => req.ip, mpClientId: (s) => s, sha256Hex: (v) => (v ? "h" + v : ""),
    fetch: async () => { sent += 1; return { ok: true }; },
    sendMetaOfflineConversions: async () => { sent += 1; return { ok: true }; }
  });
  vm.runInContext('const TAGIOO_INTERNAL_EVENT = Symbol("i");\n' + ["tagiooVisitorContext", "applyTagiooVisitorContext", "sendTagiooOwnMetaEvent", "forwardTagiooOwnEvent"].map(extract).join("\n"), ctx);
  const byCookie = ctx.tagiooVisitorContext({ headers: { host: "tagioo.com", cookie: "tg_internal=1" }, url: "/signup", ip: "198.51.100.1" });
  const byIp = ctx.tagiooVisitorContext({ headers: { host: "tagioo.com" }, url: "/signup", ip: "203.0.113.9" });
  const real = ctx.tagiooVisitorContext({ headers: { host: "tagioo.com" }, url: "/signup", ip: "198.51.100.1" });
  assert.equal(byCookie.internal, true);
  assert.equal(byIp.internal, true);
  assert.equal(real.internal, false);
  for (const visitor of [byCookie, byIp]) {
    await ctx.forwardTagiooOwnEvent("generate_lead", { visitor });
    await ctx.sendTagiooOwnMetaEvent(ctx.applyTagiooVisitorContext({ event_name: "Lead", user_data: {} }, visitor), "lead");
  }
  assert.equal(sent, 0);
  await ctx.forwardTagiooOwnEvent("generate_lead", { visitor: real });
  await ctx.sendTagiooOwnMetaEvent(ctx.applyTagiooVisitorContext({ event_name: "Lead", user_data: {} }, real), "lead");
  assert.equal(sent, 2);
});

test("Lead fires on a valid signup submission, not on viewing /signup", () => {
  const getSignup = source.slice(source.indexOf('if (pathname === "/signup" && req.method === "GET")'), source.indexOf('if (pathname === "/signup" && req.method === "POST")'));
  assert.doesNotMatch(getSignup, /sendTagiooLeadToMetaCapi|generate_lead/);
  const postSignup = source.slice(source.indexOf('if (pathname === "/signup" && req.method === "POST")'), source.indexOf('if (pathname === "/verify" && req.method === "GET")'));
  assert.ok(postSignup.indexOf("if (!check.ok)") < postSignup.indexOf("sendTagiooLeadToMetaCapi"));
  assert.match(postSignup, /tg_lead_sent !== leadKey/);
  const leadSender = extract("sendTagiooLeadToMetaCapi");
  assert.match(leadSender, /userData\.em = \[em\]/);
});

test("own CompleteRegistration carries hashed email and external_id", async () => {
  let sent;
  const ctx = vm.createContext({
    tagiooNameParts: () => ({ firstName: "Ann", lastName: "Lee" }), sha256Hex: (v) => (v ? "h:" + v : ""),
    applyTagiooVisitorContext: (event) => event, sendTagiooOwnMetaEvent: async (event) => { sent = event; }
  });
  vm.runInContext(extract("sendTagiooSignupToMetaCapi"), ctx);
  await ctx.sendTagiooSignupToMetaCapi({ email: "a@b.co", phone: "+1 202", fullName: "Ann Lee" }, "signup_1", null, "tenant-1");
  assert.deepEqual([...sent.user_data.em], ["h:a@b.co"]);
  assert.deepEqual([...sent.user_data.external_id], ["h:tenant-1"]);
  assert.equal(sent.event_id, "signup_1");
  assert.equal(sent.event_name, "CompleteRegistration");
});

test("sGTM Meta template skips hits the backend already sent to CAPI", () => {
  const template = source.slice(source.indexOf("const eventMap = {"), source.indexOf("const mappedEventName = eventMap[eventData.event_name];"));
  assert.match(template, /makeString\(eventData\.tagioo_capi_direct\) === '1'/);
  assert.match(extract("forwardTagiooOwnEvent"), /"ep\.tagioo_capi_direct": "1"/);
});

test("WhatsApp, bKash and +880 are Bangladesh-only on marketing pages", () => {
  for (const name of marketingPages.filter((n) => n !== "privacy.html")) {
    const html = pub(name).replace(/<script[\s\S]*?<\/script>/g, "");
    for (const match of html.matchAll(/<a [^>]*wa\.me[^>]*>/g)) {
      const before = html.slice(Math.max(0, match.index - 120), match.index);
      assert.ok(match[0].includes("data-bd-only") || /<span data-bd-only>[^<]*$/.test(before), `${name}: ${match[0]}`);
    }
  }
  assert.match(pub("assets/site-base.css"), /\[data-bd-only\] \{ display: none !important; \}/);
});

test("case-study and video markers render placeholders clearly and respect flags", () => {
  const stored = JSON.parse(readFileSync(new URL("../content/marketing.json", import.meta.url), "utf8"));
  assert.ok(stored.caseStudies.every((s) => s.placeholder), "only placeholders until real data is added");
  assert.equal(stored.showPlaceholders, false, "case studies stay hidden until real data exists");
  const content = { ...stored, showPlaceholders: true };
  const html = applyMarketingContent('<!-- tagioo:case-studies platform=Shopify heading="Shopify stores" --><!-- tagioo:video shopify title="Shopify setup" --><!-- tagioo:robots-if-placeholder -->', content);
  assert.match(html, /PLACEHOLDER — not a real customer/);
  assert.doesNotMatch(html, /WooCommerce<\/span>/);
  assert.match(html, /data-video-id="LX7BDDENcII"/);
  assert.match(html, /noindex/);
  assert.equal(visibleCaseStudies({ ...content, showPlaceholders: false }).length, 0);
  assert.equal(applyMarketingContent('<!-- tagioo:case-studies heading="x" -->', { ...content, showPlaceholders: false }), "");
  const video = applyMarketingContent("<!-- tagioo:video woocommerce -->", content);
  assert.match(video, /data-video-id="9PGfxptCQtk"/);
  assert.doesNotMatch(video, /<iframe/);
  assert.equal(applyMarketingContent('<!-- tagioo:case-studies -->', { caseStudies: [{ placeholder: false, storeName: "<b>x</b>", metrics: [] }] }).includes("<b>x</b>"), false);
});
