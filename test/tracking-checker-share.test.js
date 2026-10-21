import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openEventStore } from '../db.js';

test('checker reports round-trip through the store and leads are recorded', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tagioo-checker-'));
  try {
    const store = openEventStore(dir);
    const report = { url: 'https://example.com/', score: 72, grade: 'C', issues: [{ id: 'x', severity: 'high', title: 'T', fix: ['f'] }] };
    store.saveTrackingReport('AbCdEfGhJk23', 'example.com', 72, report);
    assert.deepEqual(store.getTrackingReport('AbCdEfGhJk23').report, report);
    assert.equal(store.getTrackingReport('missing00000'), null);
    store.addCheckerLead('owner@example.com', 'AbCdEfGhJk23', 'example.com', false);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM checker_leads WHERE marketing_opt_in = 0').get().n, 1);
    store.saveTrackingReport('OldReport234', 'old.com', null, { url: 'https://old.com/' }, Date.now() - 91 * 86400000);
    assert.equal(store.prune(3650).reports, 1);
    assert.equal(store.getTrackingReport('OldReport234'), null);
    store.db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('share and email routes are id-validated, rate limited, noindexed and escape report content', () => {
  const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(server, /\^\\\/website-tracking-checker\\\/r\\\/\[A-Za-z0-9\]\{12\}\$/);
  assert.match(server, /res\.setHeader\("X-Robots-Tag", "noindex, nofollow"\);\s+await servePublicPage\(req, res, "tracking-checker\.html"\)/);
  assert.match(server, /checkRateLimit\(req, "tracking-checker-email", 3, 10 \* 60 \* 1000\)/);
  const fn = server.slice(server.indexOf('async function emailCheckerReport('), server.indexOf('async function notifyOwnerLaravelManagedSetup('));
  assert.match(fn, /escapeHtml\(i\.title\)/);
  assert.match(fn, /escapeHtml\(host\)/);
  assert.doesNotMatch(fn, /\$\{i\.title\}|\$\{host\}<\/strong>/);
});
