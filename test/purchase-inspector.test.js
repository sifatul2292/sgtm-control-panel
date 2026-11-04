import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function normalizeEventName('), source.indexOf('function queryEventName('))
  + source.slice(source.indexOf('function queryEventName('), source.indexOf('\n}\n', source.indexOf('function queryEventName(')) + 3)
  + source.slice(source.indexOf('function mapServerEventRow('), source.indexOf('function renderEventLogStats('))
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

test('registrations and trials appear separately without changing purchase totals', () => {
  const { context, inspector, badge } = harness();
  const signup = event(10, { eventName: 'Lead', path: '/g/collect?en=sign_up', transactionId: '', eventId: 'signup_test', value: null, currency: '' });
  const trial = event(11, { eventName: 'Tracking Request', path: '/g/collect?en=start_trial', transactionId: '', eventId: 'trial_test', value: 0, currency: 'USD' });
  const input = data([event(1)]);
  input.nginx.retainedEvents.recentEvents = [signup, trial];
  input.nginx.todayEvents = { recentEvents: [signup, trial] };
  context.renderPurchaseInspector(input);
  assert.match(badge.textContent, /^3 tracked/);
  assert.match(inspector.innerHTML, /Registration completed/);
  assert.match(inspector.innerHTML, /Trial started/);
  assert.match(inspector.innerHTML, /signup_test/);
  assert.equal(context.cleanPurchaseRows(input).length, 1);
  context.els.purchaseSearch.value = 'completeregistration';
  context.renderPurchaseInspector(input);
  assert.match(badge.textContent, /^1 tracked/);
  assert.equal(context.normalizeEventName('generate_lead'), 'Lead');
});

test('requests are labelled Browser or Server from whether they carried a Referer', () => {
  const { context } = harness();
  assert.equal(context.mapServerEventRow(event(1, { referer: 'https://store.example/' })).origin, 'Browser');
  assert.equal(context.mapServerEventRow(event(1, { referer: '' })).origin, 'Server');
  // Rows stored without the field are not guessed at.
  assert.equal(context.mapServerEventRow(event(1)).origin, '');
});

test('one order from the browser and from the server reads as Browser + Server, not a re-send', () => {
  const { context, inspector, badge } = harness();
  const browser = event(1, { referer: 'https://store.example/checkouts/thank-you', eventId: 'order-1' });
  const server = event(1, { referer: '', eventId: '', date: new Date(Date.now() - 5000).toISOString(), path: '/g/collect?server=1' });
  context.renderPurchaseInspector(data([browser, server]));
  assert.match(badge.textContent, /^1 tracked/);
  assert.match(inspector.innerHTML, /<span class="badge ok"[^>]*>Browser \+ Server<\/span>/);
  assert.doesNotMatch(inspector.innerHTML, /re-sent/);
  assert.match(inspector.innerHTML, /<th>Sent from<\/th>/);
  // The same side sending twice is still flagged.
  context.renderPurchaseInspector(data([browser, { ...browser, date: new Date(Date.now() - 1000).toISOString() }]));
  assert.match(inspector.innerHTML, /badge warn[^>]*>Browser · re-sent ×2/);
  context.renderPurchaseInspector(data([server]));
  assert.match(inspector.innerHTML, /<span title="Sent server to server[^"]*">Server<\/span>/);
});
