import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyMarketingContent } from "../marketing-content.js";

const stored = JSON.parse(readFileSync(new URL("../content/marketing.json", import.meta.url), "utf8"));
const page = readFileSync(new URL("../public/founding.html", import.meta.url), "utf8");

test("founding booking button opens WhatsApp until BOOKING_URL is set", () => {
  const whatsapp = stored.founding.WHATSAPP_URL;
  assert.match(whatsapp, /^https:\/\/wa\.me\//);
  const fallback = applyMarketingContent("<!-- tagioo:founding-ctas -->", { founding: { BOOKING_URL: "", WHATSAPP_URL: whatsapp } });
  assert.equal((fallback.match(/href="https:\/\/wa\.me\//g) || []).length, 2);
  assert.match(fallback, />Book your free setup /);
  assert.match(fallback, />Message us on WhatsApp</);
  assert.match(fallback, /or email <a href="mailto:hello@tagioo\.com">hello@tagioo\.com<\/a>/);

  const booked = applyMarketingContent("<!-- tagioo:founding-ctas sticky -->", { founding: { BOOKING_URL: "https://example.com/book", WHATSAPP_URL: whatsapp } });
  assert.match(booked, /^<a class="btn btn-primary" href="https:\/\/example\.com\/book" target="_blank" rel="noopener">Book your free setup /);
  assert.equal(booked.includes("wa.me"), false);
});

test("founding page renders every CTA marker and its FAQ schema matches the visible FAQ", () => {
  const rendered = applyMarketingContent(page, stored);
  assert.equal(rendered.includes("<!-- tagioo:"), false);
  assert.equal((rendered.match(/>Book your free setup /g) || []).length, 3);
  const schema = JSON.parse(page.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  const visible = [...page.matchAll(/<summary>(.*?)<\/summary><p>(.*?)<\/p>/g)].map(([, q, a]) => [q, a]);
  assert.equal(visible.length, 4);
  assert.deepEqual(schema.mainEntity.map((entry) => [entry.name, entry.acceptedAnswer.text]), visible);
});
