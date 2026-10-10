import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function renderCustomerPageSearch()');
const end = source.indexOf('\nfunction openCustomerPageSearch()', start);
function search(query) {
  const results = {};
  const item = (view, hidden, originalLabel) => ({ dataset: { viewTarget: view, originalLabel }, hidden });
  vm.runInNewContext(source.slice(start, end) + '\nrenderCustomerPageSearch();', {
    customerPageSearch: { value: query }, customerSearchResults: results,
    customerPageLabels: { dashboard: 'Home', billing: 'Billing', customerAccountSettings: 'Settings', admin: 'Admin' },
    els: { navItems: [item('dashboard', false, 'Dashboard'), item('billing', false, 'My Subscription'), item('customerAccountSettings', false, 'Account'), item('admin', true, 'Admin')] },
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
  });
  return results.innerHTML;
}
test('customer page search excludes hidden owner pages', () => {
  assert.match(search(''), /data-search-view="dashboard"/);
  assert.doesNotMatch(search(''), /data-search-view="admin"/);
  assert.match(search('admin'), /No matching pages/);
});
test('page search matches new labels and familiar subscription terminology', () => {
  assert.match(search(' SETTINGS '), /data-search-view="customerAccountSettings"/);
  assert.match(search('subscription'), /data-search-view="billing"/);
  assert.doesNotMatch(search('billing'), /data-search-view="dashboard"/);
});
