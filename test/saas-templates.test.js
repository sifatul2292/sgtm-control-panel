import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const ctx = vm.createContext({ COOKIE_DAYS_DEFAULT: 730, clampCookieDays: Number });
vm.runInContext(source.slice(source.indexOf("function cleanTemplateValue("), source.indexOf("function loginPage(")), ctx);
const input = { businessType: "saas", platform: "shopify", destinations: ["ga4", "meta"], ga4MeasurementId: "G-TEST", metaPixelId: "123", metaCapiToken: "SERVER_SECRET", trackingDomain: "https://track.example.com" };
test("SaaS web export has lifecycle events, no cart tags, and keeps secrets server-side", () => {
  const result = ctx.buildSetupAssistantTemplates(input);
  const web = result.web.containerVersion;
  const names = web.tag.map(t => t.name);
  for (const name of ["sign_up", "start_trial", "subscribe", "begin_checkout", "purchase"]) assert.ok(names.includes("Tagioo GA4 - " + name));
  for (const name of ["CompleteRegistration", "StartTrial", "Subscribe", "Purchase"]) assert.ok(names.includes("Tagioo Meta - " + name));
  assert.equal(names.some(n => /add_to_cart|shipping|view_item|Shopify/.test(n)), false);
  assert.equal(JSON.stringify(result.web).includes("SERVER_SECRET"), false);
  assert.equal(result.shopifyCustomPixel, "");
  assert.match(result.saasGuide, /AFTER the action succeeds/);
  assert.match(result.saasGuide, /one authoritative sender/);
  const ids = new Set(web.trigger.map(t => t.triggerId).concat(["2147479553", "2147479573"]));
  for (const tag of web.tag) for (const id of tag.firingTriggerId) assert.ok(ids.has(id));
  for (const tag of web.tag.filter(t => t.type === "gaawe")) {
    assert.equal(tag.tagFiringOption, "ONCE_PER_EVENT");
    assert.equal(JSON.stringify(tag).includes('user_data.'), false);
  }
});
test("SaaS server maps Meta trial/subscription and accepts GA4 transport for Meta-only setups", () => {
  const result = ctx.buildSetupAssistantTemplates({ ...input, destinations: ["meta"] });
  const server = result.server.containerVersion;
  assert.ok(server.client.some(c => c.type === "gaaw_client"));
  assert.equal(server.tag.some(t => t.type === "sgtmgaaw"), false);
  assert.match(server.customTemplate[0].templateData, /start_trial: 'StartTrial'/);
  assert.match(server.customTemplate[0].templateData, /subscribe: 'Subscribe'/);
  assert.equal(server.trigger.some(t => /add_to_cart|view_item/.test(t.name)), false);
});
test("existing ecommerce exports keep cart tags and Shopify instrumentation", () => {
  const result = ctx.buildSetupAssistantTemplates({ ...input, businessType: "ecommerce", webGtmContainerId: "GTM-TEST" });
  assert.ok(result.web.containerVersion.tag.some(t => t.name === "Tagioo GA4 - add_to_cart"));
  assert.match(result.shopifyCustomPixel, /Shopify Custom Pixel/);
  assert.equal(result.saasGuide, "");
});
