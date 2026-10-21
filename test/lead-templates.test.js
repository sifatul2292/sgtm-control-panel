import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const ctx = vm.createContext({ COOKIE_DAYS_DEFAULT: 730, clampCookieDays: Number });
vm.runInContext(source.slice(source.indexOf("function cleanTemplateValue("), source.indexOf("function loginPage(")), ctx);
const input = {
  businessType: "lead", platform: "woocommerce", destinations: ["ga4", "meta", "tiktok", "googleAds"],
  ga4MeasurementId: "G-TEST", metaPixelId: "123", metaAccessToken: "SERVER_SECRET", tiktokPixelId: "TT1", tiktokAccessToken: "TT_SECRET",
  googleAdsConversionId: "AW-1", googleAdsPurchaseLabel: "LEADLABEL", googleAdsAddToCartLabel: "ATC", googleAdsBeginCheckoutLabel: "BC",
  trackingDomain: "https://track.example.com", currency: "USD"
};

test("lead web export tracks lead events, not store events, and keeps secrets server-side", () => {
  const result = ctx.buildSetupAssistantTemplates(input);
  const web = result.web.containerVersion;
  const names = web.tag.map((t) => t.name);
  for (const name of ["generate_lead", "contact", "schedule"]) assert.ok(names.includes("Tagioo GA4 - " + name), name);
  for (const name of ["Lead", "Contact", "Schedule"]) assert.ok(names.includes("Tagioo Meta - " + name), name);
  for (const name of ["SubmitForm", "Contact"]) assert.ok(names.includes("Tagioo TikTok - " + name), name);
  assert.equal(names.some((n) => /purchase|Purchase|add_to_cart|AddToCart|view_item|ViewContent|checkout|Checkout/.test(n)), false);
  assert.equal(web.trigger.some((t) => /purchase|add_to_cart|Shopify|Woo/i.test(t.name)), false);
  for (const secret of ["SERVER_SECRET", "TT_SECRET"]) assert.equal(JSON.stringify(result.web).includes(secret), false);
  // Every tag points at a trigger that exists.
  const ids = new Set(web.trigger.map((t) => t.triggerId).concat(["2147479553", "2147479573"]));
  for (const tag of web.tag) for (const id of tag.firingTriggerId) assert.ok(ids.has(id), tag.name);
  // AJAX forms can submit more than once per page.
  for (const tag of web.tag.filter((t) => /generate_lead|Lead|SubmitForm/.test(t.name))) assert.notEqual(tag.tagFiringOption, "ONCE_PER_LOAD", tag.name);
  // Lead source and value reach GA4; user_data is passed for matching.
  const leadTag = web.tag.find((t) => t.name === "Tagioo GA4 - generate_lead");
  const rows = JSON.stringify(leadTag);
  assert.match(rows, /lead_source/);
  assert.match(rows, /dlv - value/);
  assert.match(rows, /user_data\.email_address/);
  assert.equal(rows.includes("tagioo_transport"), false);
  assert.equal(result.shopifyCustomPixel, "");
});

test("lead server export counts generate_lead as the Google Ads conversion", () => {
  const server = ctx.buildSetupAssistantTemplates(input).server.containerVersion;
  const leadTrigger = server.trigger.find((t) => t.triggerId === "2");
  assert.match(JSON.stringify(leadTrigger), /generate_lead/);
  const adsTag = server.tag.find((t) => t.type === "sgtmadsct");
  assert.equal(adsTag.name, "Tagioo Google Ads - Lead");
  assert.equal(JSON.stringify(adsTag.firingTriggerId), JSON.stringify(["2"]));
  assert.equal(server.tag.filter((t) => t.type === "sgtmadsct").length, 1, "no cart/checkout micro-conversions");
  const remarketing = server.tag.find((t) => t.type === "sgtmadsremarket");
  assert.match(JSON.stringify(remarketing), /"key":"enableDynamicRemarketing","value":"false"/);
  assert.equal(server.trigger.some((t) => /purchase|add_to_cart|Woo/i.test(t.name)), false);
  const meta = server.customTemplate.map((t) => t.templateData).join("\n");
  assert.match(meta, /contact: 'Contact'/);
  assert.match(meta, /schedule: 'Schedule'/);
});

test("lead guide explains success-only pushes and consent for user_data", () => {
  const guide = ctx.buildSetupAssistantTemplates(input).saasGuide;
  assert.match(guide, /^Lead generation setup/);
  assert.match(guide, /AFTER your form or CRM confirms/);
  assert.match(guide, /window\.dataLayer\.push\(\{ event: "generate_lead"/);
  assert.match(guide, /wpcf7mailsent/);
  assert.match(guide, /consent/);
  assert.match(guide, /currency: "USD"/);
});

test("ecommerce exports are unchanged by the lead branch", () => {
  const result = ctx.buildSetupAssistantTemplates({ ...input, businessType: "ecommerce" });
  const names = result.web.containerVersion.tag.map((t) => t.name);
  assert.ok(names.includes("Tagioo GA4 - purchase"));
  assert.ok(names.includes("Tagioo GA4 - add_to_cart"));
  assert.equal(names.includes("Tagioo GA4 - generate_lead"), false);
  const server = result.server.containerVersion;
  assert.ok(server.tag.some((t) => t.name === "Tagioo Google Ads - Purchase"));
  assert.ok(server.tag.some((t) => t.name === "Tagioo Google Ads - Add to Cart"));
  assert.equal(result.saasGuide, "");
});
