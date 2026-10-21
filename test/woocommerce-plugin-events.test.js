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
  assert.match(plugin, /Version:\s+2\.6\.0/);
  assert.match(plugin, /define\('TAGIOO_VERSION', '2\.6\.0'\)/);
});

test("quantity changes queue add/remove events and passive refreshes only fetch when flagged", () => {
  assert.match(plugin, /add_action\('woocommerce_after_cart_item_quantity_update'/);
  assert.match(plugin, /\$name = \$increase \? 'add_to_cart' : 'remove_from_cart'/);
  assert.match(plugin, /if \(passive && document\.cookie\.indexOf\('tagioo_q=1'\) === -1\) return;/);
  assert.doesNotMatch(plugin, /WC\(\)->session\?->set\('tagioo_(atc|rfc)', \$push\)/, "all queued events go through tagioo_queue_event");
});

test("server purchase event_time stays inside Meta's 7-day window", () => {
  const fn = plugin.slice(plugin.indexOf("function tagioo_purchase_event_time("), plugin.indexOf("// Enqueue the send out-of-band"));
  assert.match(fn, /7 \* DAY_IN_SECONDS - HOUR_IN_SECONDS/);
  assert.match(fn, /get_date_created\(\)/);
  assert.match(fn, /get_date_paid\(\)/);
  assert.match(fn, /return \$now;/);
  assert.match(plugin, /\$ts = tagioo_purchase_event_time\(\$order\);/);
  assert.match(plugin, /'ep\.event_time'\s*=> \(string\) \$ts/);
});

test("consent works like Stape: optional consent-gated GTM, backend hit always sent with consent state", () => {
  assert.match(plugin, /'gtm_placement'\s*=> 'code'/, "default keeps loading GTM");
  assert.match(plugin, /'gtm_placement'\s*=> \(\$in\['gtm_placement'\] \?\? ''\) === 'consent' \? 'consent' : 'code'/);
  assert.match(plugin, /ad_storage==='granted'\|\|c\.analytics_storage==='granted'/);
  assert.match(plugin, /if \(tagioo_wait_for_consent\(\)\) return;\s+\/\/ no JS/);
  const fn = plugin.slice(plugin.indexOf("function tagioo_marketing_consent("), plugin.indexOf("// Classic (shortcode) checkout."));
  for (const source of ["wp_consent_api", "cookieyes", "complianz", "cookiebot", "onetrust", "usprivacy"]) assert.match(fn, new RegExp("'" + source + "'"), source);
  assert.match(fn, /return \['unknown', ''\];/);
  assert.match(plugin, /update_meta_data\(TAGIOO_META_CONSENT, \$consent\)/);
  assert.match(plugin, /\$params\['ep\.consent_marketing'\] = \(string\)/);
  assert.doesNotMatch(plugin, /\$params\['gcs'\]/, "no Consent Mode override on backend hits");
  assert.match(plugin, /apply_filters\('tagioo_server_purchase_params', \$params, \$order\)/);
  // Server-set first-party Meta cookies stay unconditional, as Stape's _sbp does.
  assert.match(plugin, /setcookie\('_fbp', \$fbp, \$opts\);/);
});

test("generated Meta and TikTok server tags skip backend events with denied consent", () => {
  const server = ctx.buildSetupAssistantTemplates({ businessType: "ecommerce", platform: "woocommerce", destinations: ["meta", "tiktok"], metaPixelId: "1", tiktokPixelId: "T" }).server.containerVersion;
  const templates = server.customTemplate.map((t) => t.templateData);
  assert.equal(templates.length, 2);
  for (const data of templates) assert.match(data, /eventData\.consent_marketing === 'denied'/);
});

test("cookie consent is off by default; the Tagioo banner and external banners are opt-in", () => {
  assert.match(plugin, /'consent_mode'\s*=> 'off',/, "consent not required by default");
  assert.doesNotMatch(plugin, /ignore_consent/, "old checkbox removed");
  assert.match(plugin, /in_array\(\$in\['consent_mode'\] \?\? '', \['banner', 'external'\], true\) \? \$in\['consent_mode'\] : 'off'/);
  assert.match(plugin, /return tagioo_consent_mode\(\) !== 'off';/);
  assert.match(plugin, /return tagioo_consent_enabled\(\) && tagioo_opt\('gtm_placement'\) === 'consent';/);
  // Tagioo banner: Consent Mode v2 defaults before GTM, Accept/Reject UI, cookie, reopen shortcode.
  assert.match(plugin, /if \(tagioo_consent_mode\(\) !== 'banner' \|\| is_admin\(\)\) return;\s+echo "\\n<!-- Tagioo consent defaults -->/);
  assert.match(plugin, /gtag\('consent','default',\{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'/);
  assert.match(plugin, /\}, 0\);\s+function tagioo_default_consent_text/, "defaults run before GTM (priority 0 < 1)");
  assert.match(plugin, /data-tagioo-consent="denied">Reject<\/button>/);
  assert.match(plugin, /data-tagioo-consent="granted">Accept<\/button>/);
  assert.match(plugin, /tagioo_consent='\+v\+';path=\/;max-age=15552000/);
  assert.match(plugin, /add_shortcode\('tagioo_cookie_settings'/);
  // With the banner, no choice yet means no consent; Meta cookies wait for Accept.
  assert.match(plugin, /return \[\$v === 'granted' \? 'granted' : 'denied', 'tagioo_banner'\];/);
  assert.match(plugin, /if \(tagioo_consent_mode\(\) === 'banner' \? \$consent !== 'granted' : \$consent === 'denied'\) return;/);
  assert.match(plugin, /if \(tagioo_consent_enabled\(\) && !\$order->get_meta\(TAGIOO_META_CONSENT\)\)/);
  assert.match(plugin, /if \(tagioo_consent_enabled\(\)\) \{\s+\$params\['ep\.consent_marketing'\]/);
});
