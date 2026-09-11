import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("./server.js", import.meta.url), "utf8");
const definitionStart = source.indexOf("function tagiooTikTokEventsApiTemplateData() {");
const definitionEnd = source.indexOf("\nfunction gtmTag(", definitionStart);
const definition = source.slice(definitionStart, definitionEnd).trim();
assert.ok(definitionStart >= 0 && definitionEnd > definitionStart, "TikTok Events API template must remain defined");
const templateData = vm.runInNewContext(`(${definition})`)();

test("TikTok server template imports fully configured", async () => {
  assert.match(templateData, /___SANDBOXED_JS_FOR_SERVER___/);
  assert.match(templateData, /business-api\.tiktok\.com\/open_api\/v1\.3\/event\/track/);
  for (const section of ["INFO", "TEMPLATE_PARAMETERS", "SERVER_PERMISSIONS"]) {
    const value = templateData.split(`___${section}___`)[1].split(/\n\n___/)[0].trim();
    assert.doesNotThrow(() => JSON.parse(value), `${section} must contain valid JSON`);
  }
  assert.match(source, /"Tagioo TikTok Events API - All Events", "cvt_0_102"/);
  assert.match(source, /gtmCustomTemplate\(102, "Tagioo TikTok Events API"/);
  assert.doesNotMatch(source, /TikTok still requires the TikTok Events API template/);

  const sandboxedJs = templateData.split("___SANDBOXED_JS_FOR_SERVER___")[1].split("___SERVER_PERMISSIONS___")[0];
  let sent;
  const eventData = {
    event_name: "purchase",
    event_id: "order-42",
    page_location: "https://shop.example/thank-you",
    currency: "BDT",
    value: 1200,
    items: [{ item_id: "sku-1", item_name: "Book", price: 1200, quantity: 1 }],
    user_data: { email_address: "buyer@example.com" }
  };
  const dependencies = {
    getAllEventData: () => eventData,
    getCookieValues: () => [],
    getRequestHeader: () => undefined,
    getTimestampMillis: () => 1000000,
    getType: (value) => Array.isArray(value) ? "array" : typeof value,
    JSON,
    logToConsole: () => {},
    makeNumber: Number,
    makeString: String,
    Math,
    sendHttpRequest: (url, options, body) => {
      sent = { url, options, body: JSON.parse(body) };
      return Promise.resolve({ statusCode: 200, body: "ok" });
    },
    sha256Sync: (value) => createHash("sha256").update(value).digest("hex")
  };
  const data = { pixelId: "PIXEL", accessToken: "TOKEN", gtmOnSuccess() {}, gtmOnFailure() {} };
  vm.runInNewContext(`(function(data, require) {${sandboxedJs}\n})(data, require)`, {
    data,
    require: (name) => dependencies[name]
  });
  await Promise.resolve();
  assert.equal(sent.body.event_source_id, "PIXEL");
  assert.equal(sent.body.data[0].event, "CompletePayment");
  assert.equal(sent.body.data[0].event_id, "order-42");
  assert.equal(sent.body.data[0].properties.contents[0].content_id, "sku-1");
  assert.equal(sent.options.headers["Access-Token"], "TOKEN");
});
