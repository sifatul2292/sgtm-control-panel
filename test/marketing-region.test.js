import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { renderMarketingRegion } from "../marketing-region.js";

const publicDir = new URL("../public/", import.meta.url);
// index.html is the logged-in app shell (served by serveStatic), not a marketing page.
const pages = readdirSync(publicDir).filter((name) => name.endsWith(".html") && name !== "index.html");

test("nested and attribute-valued markers render per region", () => {
  const html = '<p>Hi<span data-bd-only> or <a href="https://wa.me/+880">WhatsApp</a> <span>x</span></span>.</p>'
    + '<a href="mailto:a@b.c" data-intl-only="">Email</a><details class="faq" data-bd-only><summary>bKash</summary><details><p>n</p></details></details>';
  assert.equal(renderMarketingRegion(html, "intl"), '<p>Hi.</p><a href="mailto:a@b.c">Email</a>');
  assert.equal(renderMarketingRegion(html, "bd"),
    '<p>Hi<span> or <a href="https://wa.me/+880">WhatsApp</a> <span>x</span></span>.</p><details class="faq"><summary>bKash</summary><details><p>n</p></details></details>');
});

test("international HTML carries no Bangladesh-only contact or payment text", () => {
  for (const name of pages) {
    const html = renderMarketingRegion(readFileSync(new URL(name, publicDir), "utf8"), "intl");
    assert.doesNotMatch(html, /8801990208987|wa\.me\//, name);
    assert.doesNotMatch(html, /bKash|Nagad/, name);
    assert.doesNotMatch(html, /\sdata-(bd|intl)-only/, name);
  }
});

test("Bangladesh HTML keeps WhatsApp and drops international-only links", () => {
  for (const name of ["docs.html", "pricing.html", "shopify.html"]) {
    const html = renderMarketingRegion(readFileSync(new URL(name, publicDir), "utf8"), "bd");
    assert.match(html, /wa\.me\/\+8801990208987/, name);
    assert.doesNotMatch(html, /\sdata-(bd|intl)-only/, name);
  }
  const pricing = renderMarketingRegion(readFileSync(new URL("pricing.html", publicDir), "utf8"), "bd");
  assert.match(pricing, /bKash/);
  assert.doesNotMatch(pricing, /id="pricingFooterNote"/);
});

test("docs ships the Shopify section in server HTML for both regions", () => {
  const docs = readFileSync(new URL("docs.html", publicDir), "utf8");
  for (const region of ["intl", "bd"]) assert.match(renderMarketingRegion(docs, region), /<section id="shopify"/);
});
