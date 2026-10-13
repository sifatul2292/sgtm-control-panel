import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
test('Platform controls show Web GTM only for Shopify and plugin only for WooCommerce', () => {
  const field = { hidden: true, input: { disabled: false }, querySelector() { return this.input; } };
  const plugin = { hidden: true };
  const elements = { platform: { value: 'shopify' } };
  const context = { els: { setupAssistantForm: { elements, querySelector: s => s === '[data-shopify-web-gtm]' ? field : s === '[data-woo-plugin-download]' ? plugin : null } }, document: { querySelector: () => null }, updateLaravelSelfServicePolling() {} };
  vm.createContext(context);
  const start = source.indexOf('function updateLaravelAssistantFields()');
  vm.runInContext(source.slice(start, source.indexOf('function setWooWebhookSecret', start)), context);
  for (const platform of ['shopify', 'woocommerce', 'laravel', 'custom', 'wix', 'bigcommerce']) {
    elements.platform.value = platform;
    vm.runInContext('updateLaravelAssistantFields()', context);
    assert.equal(field.hidden, platform !== 'shopify');
    assert.equal(field.input.disabled, platform !== 'shopify');
    assert.equal(plugin.hidden, platform !== 'woocommerce');
  }
});
test('Assistant starts in USD, places plugin after templates and removes video', () => {
  assert.match(markup, /name="currency" value="USD"/);
  assert.ok(markup.indexOf('data-woo-plugin-download') > markup.indexOf('id="downloadServerTemplate"'));
  assert.doesNotMatch(markup + source, /vSvpiK4vXdc|data-setup-video-play/);
});
