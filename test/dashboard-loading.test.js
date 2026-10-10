import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const cacheSource = server.slice(server.indexOf('const CUSTOMER_DASHBOARD_FRESH_MS'), server.indexOf('// ── Owner dashboard cache'));
function cache(build) {
  const context = vm.createContext({ process: { env: {} }, Date, Map, getCustomerDashboardData: build });
  vm.runInContext(cacheSource, context);
  const load = (tenantId, container = '') => context.getCustomerDashboardDataCached({ tenantId }, container);
  load.age = () => vm.runInContext('for (const entry of customerDashboardCache.values()) entry.at -= 600000;', context);
  load.invalidate = tenant => context.invalidateCustomerDashboardCache(tenant);
  return load;
}

test('returning after ten minutes serves stored data without waiting for rebuild', async () => {
  let rebuild;
  let attempts = 0;
  const load = cache(() => ++attempts === 1 ? Promise.resolve({ total: 123 }) : new Promise(resolve => { rebuild = resolve; }));
  await load('a');
  load.age();
  const result = await load('a');
  assert.equal(result.total, 123);
  assert.equal(result.timing.cache, 'stale');
  assert.equal(attempts, 2);
  rebuild({ total: 124 });
});

test('invalidation during a build prevents old data repopulating the cache', async () => {
  const pending = [];
  const load = cache(() => new Promise(resolve => pending.push(resolve)));
  const before = load('a');
  load.invalidate('a');
  const after = load('a');
  pending[0]({ total: 1 });
  await before;
  const duplicate = load('a');
  assert.equal(pending.length, 2);
  pending[1]({ total: 2 });
  assert.equal((await after).total, 2);
  assert.equal((await duplicate).total, 2);
});

test('simultaneous cold customer loads share one build and preserve container isolation', async () => {
  const pending = [];
  const load = cache((session, container) => new Promise(resolve => pending.push({ session, container, resolve })));
  const first = load('a', 'one');
  const duplicate = load('a', 'one');
  const otherContainer = load('a', 'two');
  const otherTenant = load('b', 'one');
  assert.equal(pending.length, 3);
  pending.forEach(item => item.resolve({ tenant: item.session.tenantId, container: item.container }));
  const results = await Promise.all([first, duplicate, otherContainer, otherTenant]);
  assert.equal(results[0], results[1]);
  assert.equal(results[2].container, 'two');
  assert.equal(results[3].tenant, 'b');
  assert.equal((await load('a', 'one')).timing.cache, 'fresh');
  assert.equal(pending.length, 3);
});

test('a failed cold build releases the slot for retry', async () => {
  let attempts = 0;
  const load = cache(async () => {
    if (++attempts === 1) throw Error('temporary failure');
    return { recovered: true };
  });
  await assert.rejects(load('a'), /temporary failure/);
  assert.equal((await load('a')).recovered, true);
});

test('customer database reads use the existing shared read cache', () => {
  const start = server.indexOf('async function getCustomerDashboardData(');
  assert.match(server.slice(start, start + 180), /await readDatabaseCached\(\)/);
});

test('a hung dashboard request times out, unlocks Refresh, and can be retried', async () => {
  const start = app.indexOf('let dashboardRefreshTimer;');
  const body = app.slice(start, app.indexOf('\nfunction renderContainerSwitcher', start));
  let timeout;
  let cleared = false;
  let hung = true;
  let rendered = 0;
  let reply = { generatedAt: 'now' };
  let refreshLater;
  const els = { refreshButton: {}, generatedAt: {}, containerCards: {} };
  const context = vm.createContext({
    els, AbortController, currentSession: { role: 'customer' }, selectedCustomerContainerId: 'one', latestData: null,
    setTimeout: (fn, ms) => {
      if (ms === 10000) { refreshLater = fn; return 2; }
      assert.equal(ms, 45000); timeout = fn; return 1;
    },
    clearTimeout: () => { cleared = true; },
    fetch: (url, { signal }) => {
      assert.equal(url, '/api/dashboard?container=one');
      if (!hung) return Promise.resolve({ ok: true, json: async () => reply });
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(Error('Aborted'), { name: 'AbortError' }))));
    },
    renderAll: () => { rendered++; }, escapeHtml: value => value,
    document: { body: { classList: { remove() {} } } }
  });
  vm.runInContext(body, context);
  const pending = context.loadDashboard();
  assert.equal(els.refreshButton.disabled, true);
  timeout();
  assert.equal(await pending, false);
  assert.equal(els.refreshButton.disabled, false);
  assert.match(els.generatedAt.textContent, /Click Refresh to retry/);
  assert.equal(cleared, true);
  hung = false;
  assert.equal(await context.loadDashboard(), true);
  assert.equal(rendered, 1);
  reply = { timing: { cache: 'stale' } };
  await context.loadDashboard();
  assert.equal(typeof refreshLater, 'function');
  reply = { timing: { cache: 'fresh' } };
  await refreshLater();
  assert.equal(rendered, 3);
});
