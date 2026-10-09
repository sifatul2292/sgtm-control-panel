import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { openEventStore } from '../db.js';

test('dedicated event reads include storefront events without sharing another tenant or global log', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tagioo-events-'));
  const store = openEventStore(dir);
  try {
    store.insertLines([
      { tenantId: 'reviewer', workerId: 'local', source: 'review.log', dateKey: '2026-10-09', line: 'Shopify storefront page_view' },
      { tenantId: 'reviewer', workerId: 'local', source: 'second.log', dateKey: '2026-10-09', line: 'second container' },
      { tenantId: 'other', workerId: 'local', source: 'other.log', dateKey: '2026-10-09', line: 'other customer' },
      { tenantId: '', workerId: 'local', source: 'shared.log', dateKey: '2026-10-08', line: 'shared customer' }
    ]);
    assert.deepEqual(store.linesForTenantDate('reviewer', '2026-10-09', 'review.log', true), ['Shopify storefront page_view']);
    assert.deepEqual(store.linesForTenantDate('reviewer', '2026-10-09', '', true), ['Shopify storefront page_view', 'second container']);
    assert.deepEqual(store.tenantDates('reviewer', '2026-10-01', '', true), ['2026-10-09']);
    assert.deepEqual(store.dateCountsForTenant('reviewer', '2026-10-01', 'review.log', true), { '2026-10-09': 1 });
    assert.deepEqual(store.linesForTenantDate('reviewer', '2026-10-08'), ['shared customer']);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('dedicated snapshots keep fresh Shopify events even when their referrer differs from tracking domain', () => {
  const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const start = source.indexOf('function sqliteSnapshotsForTenant(');
  const body = source.slice(start, source.indexOf('if (eventStore) {', start));
  const context = {
    localDateKey: () => '2026-10-09', addDays: date => date,
    todaySnapshotCache: new Map(),
    eventStore: {
      dateCountsForTenant: (_t, _d, _s, dedicated) => { assert.equal(dedicated, true); return { '2026-10-09': 1 }; },
      tenantDates: () => ['2026-10-09'], linesForTenantDate: () => ['fresh event'],
    },
    aggregateTrackingLines: () => ({ available: true, count: 1, recentEvents: [{ host: 'store.myshopify.com', eventName: 'PageView' }] }),
    filterRequestSummaryForTenant: () => { throw Error('Dedicated source must not filter on storefront referrer'); },
    historySnapshotFromSummary: summary => ({ total: summary.count }),
    console: { error: error => { throw Error(error); } }
  };
  const result = vm.runInNewContext(`${body}\nsqliteSnapshotsForTenant('reviewer', { domain: 'track.example.com' }, 1, { dedicatedOnly: true })`, context);
  assert.equal(result['2026-10-09'].total, 1);
});
