import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function mapServerEventRow('), source.indexOf('function renderEventLogStats('))
  + source.slice(source.indexOf('function requestDateLabel('), source.indexOf('function renderEventRows('))
  + source.slice(source.indexOf('function customerFallbackHost('), source.indexOf('function setLog('));
function harness() {
  const inspector = { querySelectorAll: () => [] };
  const badge = { classList: { add() {} } };
  const context = { Date, Intl, URL, purchaseRange: 'day', els: { purchaseSearch: { value: '' }, purchaseInspector: inspector, purchaseInspectorBadge: badge },
    formatDate: value => String(value), eventDetail: () => 'metadata', purchaseRows: () => [], formatMoney: (value, currency) => `${value} ${currency}`,
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') };
  vm.createContext(context); vm.runInContext(functions, context);
  return { context, inspector, badge };
}
const event = (index, overrides = {}) => ({ date: new Date().toISOString(), eventName: 'Purchase', status: 200, transactionId: `order-${index}`, eventId: `event-${index}`, value: 100, currency: 'BDT', path: '/g/collect', client: 'GA4', host: 'demo.example.com', ...overrides });
const data = purchases => ({ nginx: { retainedEvents: { purchaseEvents: purchases, recentEvents: [event(999, { eventName: 'PageView' })] } } });
test('100 purchases render 100 table rows, independent of incoming-request cap', () => {
  const { context, inspector, badge } = harness();
  context.renderPurchaseInspector(data(Array.from({ length: 100 }, (_, i) => event(i))));
  assert.match(badge.textContent, /^100 tracked/);
  assert.equal((inspector.innerHTML.match(/class="purchase-date"/g) || []).length, 100);
  assert.match(inspector.innerHTML, /order-99/);
});
test('same-value purchases without IDs are retained, including missing metadata', () => {
  const { context, inspector, badge } = harness();
  const purchases = Array.from({ length: 100 }, (_, i) => event(i, { transactionId: '', eventId: '', date: new Date(Date.now() - i * 1000).toISOString() }));
  purchases.push(event(100, { value: null, transactionId: '', eventId: '' }));
  context.renderPurchaseInspector(data(purchases));
  assert.match(badge.textContent, /^101 tracked/);
  assert.equal((inspector.innerHTML.match(/class="purchase-date"/g) || []).length, 101);
});
test('duplicate sends collapse into one purchase and search/range remain functional', () => {
  const { context, inspector, badge } = harness();
  const events = [event(1), event(1, { date: new Date(Date.now() - 1000).toISOString() }), event(2, { date: new Date(Date.now() - 86400000).toISOString() })];
  context.renderPurchaseInspector(data(events));
  assert.match(badge.textContent, /^1 tracked/);
  assert.match(inspector.innerHTML, /re-sent ×2/);
  context.purchaseRange = 'all'; context.renderPurchaseInspector(data(events));
  assert.match(badge.textContent, /^2 tracked/);
  context.els.purchaseSearch.value = 'order-2'; context.renderPurchaseInspector(data(events));
  assert.match(badge.textContent, /^1 tracked/);
  assert.match(inspector.innerHTML, /order-2/);
});
