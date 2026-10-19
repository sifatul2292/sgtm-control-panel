import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const plugin = readFileSync(new URL("../tagioo-woocommerce.php", import.meta.url), "utf8");
const ctx = vm.createContext({ COOKIE_DAYS_DEFAULT: 730, clampCookieDays: Number });
vm.runInContext(source.slice(source.indexOf("function cleanTemplateValue("), source.indexOf("function loginPage(")), ctx);

test("plugin pushes every ecommerce event the WooCommerce web.json listens for", () => {
  const web = ctx.buildSetupAssistantTemplates({ businessType: "ecommerce", platform: "woocommerce", destinations: ["ga4", "meta"], ga4MeasurementId: "G-T", metaPixelId: "1" }).web.containerVersion;
  const events = web.trigger.filter((t) => t.type === "CUSTOM_EVENT")
    .map((t) => JSON.stringify(t.customEventFilter).match(/"value":"([a-z_]+)"\}\]\}\]$/)?.[1] || JSON.stringify(t).match(/"arg1","value":"([a-z_]+)"/)?.[1])
    .filter(Boolean);
  assert.ok(events.length >= 10, "found trigger event names: " + events.join(","));
  for (const name of events) {
    assert.ok(plugin.includes(`'event' => '${name}'`) || plugin.includes(`push('${name}'`) || plugin.includes(`'${name}'`), `plugin never pushes ${name}`);
  }
});

test("new event toggles default on and survive saving settings", () => {
  for (const key of ["track_view_cart", "track_remove_cart", "track_view_list", "track_search", "track_checkout_steps"]) {
    assert.match(plugin, new RegExp(`'${key}'\\s*=> '1'`), key + " default");
    assert.match(plugin, new RegExp(`'${key}'\\s*=> isset\\(\\$in\\['${key}'\\]\\)`), key + " sanitizer");
  }
  assert.match(plugin, /Version:\s+2\.5\.0/);
  assert.match(plugin, /define\('TAGIOO_VERSION', '2\.5\.0'\)/);
});
