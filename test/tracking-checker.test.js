import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScanUrl, isPublicAddress, resolveScanAddress, fetchScanPage, scriptUrls, analyzeTracking } from '../tracking-checker.js';

test('URL boundary rejects credentials, unusual protocols/ports, local names and alternate loopback representations', () => {
  assert.equal(normalizeScanUrl('example.com/path#fragment').href, 'https://example.com/path');
  for (const url of ['', 'http://localhost', 'http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://[::1]', 'https://user:password@example.com', 'ftp://example.com', 'https://example.com:8080', 'http://metadata.google.internal', 'http://169.254.169.254']) {
    assert.throws(() => normalizeScanUrl(url), { status: 400 }, url);
  }
});
test('public address classification blocks reserved, mapped and transition networks', () => {
  for (const address of ['127.0.0.1', '10.2.3.4', '172.31.1.2', '192.168.0.1', '100.100.100.200', '169.254.0.1', '0.0.0.0', '192.0.0.9', '198.18.0.1', '198.51.100.1', '203.0.113.9', '224.0.0.1', '255.255.255.255', '::1', '::ffff:8.8.8.8', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1', '2001::1', '2002::1', '3fff::1']) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address);
});
test('every DNS answer is checked, rather than accepting a safe first answer', async () => {
  const resolver = async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }];
  await assert.rejects(resolveScanAddress('example.com', resolver), { status: 400 });
  assert.equal((await resolveScanAddress('example.com', async () => [{ address: '1.1.1.1', family: 4 }])).address, '1.1.1.1');
});
test('redirects cannot switch to private URLs, downgrade HTTPS or leave a script origin', async () => {
  const signal = AbortSignal.timeout(1000);
  await assert.rejects(fetchScanPage('https://example.com', signal, async () => ({ location: 'http://127.0.0.1' })), { status: 400 });
  await assert.rejects(fetchScanPage('https://example.com', signal, async () => ({ location: 'http://example.org' })), { status: 422 });
  let calls = 0;
  await assert.rejects(fetchScanPage('https://example.com/a.js', signal, async () => { calls++; return { location: 'https://elsewhere.com/a.js' }; }, 'https://example.com'), { status: 422 });
  assert.equal(calls, 1);
  await assert.rejects(fetchScanPage('https://example.com', signal, async () => ({ location: '/loop' })), { status: 422 });
});
test('script inspection stays same-origin, deduplicates and caps its scope', () => {
  const html = `<script src="/a.js"></script><script src="https://thirdparty.com/a.js"></script><script src="/a.js"></script><script src='/b.js'></script><script src='/c.js'></script><script src='/d.js'></script>`;
  assert.deepEqual(scriptUrls(html, 'https://example.com'), ['https://example.com/a.js', 'https://example.com/b.js', 'https://example.com/c.js']);
});
test('report distinguishes evidence, strips cookie values and avoids unsupported quality/financial claims', () => {
  const report = analyzeTracking({ url: 'https://example.com', sources: [{ url: 'https://example.com', text: `wp-content/plugins/ woocommerce dataLayer.push({event:'purchase'}); 'GTM-ABC123'; gtag('config','G-ABC123456'); fbq('init','123456789'); ttq.load('ABCDE'); gtag('consent','default',{ad_storage:'denied'}); transport_url: 'https://track.example.com/g/collect?secret=hidden';` }], headers: { 'set-cookie': ['session=private-value; Secure; HttpOnly; SameSite=Lax; Max-Age=3600'] } });
  assert.deepEqual(report.platforms, ['WooCommerce', 'WordPress']);
  assert.equal(report.trackers.find(t => t.name === 'Meta Pixel').ids[0], '123456789');
  assert.ok(report.signals.find(s => s.name === 'First-party / server routing clues').status === 'observed');
  assert.deepEqual(report.firstPartyEndpoints, ['https://track.example.com/g/collect']);
  assert.equal(report.cookies[0].maxAge, '3600');
  assert.doesNotMatch(JSON.stringify(report), /private-value|secret=hidden/);
  assert.equal(report.score, undefined);
  assert.equal(report.adSpendImpact, undefined);
  assert.match(report.limitations, /without executing/);
});
test('an empty page makes no unsupported missing-tag or server-delivery assertions', () => {
  const report = analyzeTracking({ url: 'https://example.com', sources: [{ url: 'https://example.com', text: '<h1>Shop</h1>' }] });
  assert.equal(report.observedChecks, 1);
  assert.equal(report.trackers.length, 0);
  assert.equal(report.signals.find(s => s.name === 'Analytics / tag manager').status, 'not-observed');
  assert.match(report.limitations, /Not observed does not mean missing/);
});
test('an Ads-only gtag loader does not establish GA4', () => {
  const report = analyzeTracking({ url: 'https://example.com', sources: [{ url: 'https://example.com', text: `<script src="https://www.googletagmanager.com/gtag/js?id=AW-123456"></script>` }] });
  assert.deepEqual(report.trackers.map(t => t.name), ['Google Ads']);
});
