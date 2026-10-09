import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('account overview follows selected connection rather than global default', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('function renderAccountOverview(');
  const fn = source.slice(start, source.indexOf('\n}\n', start) + 3);
  const grid = {};
  const context = vm.createContext({ els: { accountOverviewGrid: grid }, escapeHtml: s => s, formatDate: s => s });
  vm.runInContext(fn, context);
  context.data = { config: { tenantDomain: 'wrong.example.com' }, tracking: { domain: 'https://review.example.com', shopify: { shop: 'review.myshopify.com', status: 'connected' } } };
  vm.runInContext('renderAccountOverview(data, {})', context);
  assert.match(grid.innerHTML, /https:\/\/review.example.com/);
  assert.doesNotMatch(grid.innerHTML, /wrong.example.com/);
  assert.match(grid.innerHTML, />Connected</);
  context.data = { tracking: { domain: 'https://second.example.com', shopify: { status: 'disconnected' } } };
  vm.runInContext('renderAccountOverview(data, {})', context);
  assert.match(grid.innerHTML, /second.example.com/);
  assert.match(grid.innerHTML, />Not connected</);
  assert.doesNotMatch(grid.innerHTML, /review.example.com/);
});
