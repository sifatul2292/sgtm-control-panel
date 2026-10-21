import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScanUrl, isPublicAddress, resolveScanAddress, fetchScanPage, scriptUrls, extractGtmData, analyzeGtmContainer, parseShopifyPixels, codeOnly, buildReport, parseMetaPixelConfig } from '../tracking-checker.js';

test('URL boundary rejects credentials, unusual protocols/ports, local names and alternate loopback representations', () => {
  assert.equal(normalizeScanUrl('example.com/path#fragment').href, 'https://example.com/path');
  for (const url of ['', 'http://localhost', 'http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://[::1]', 'https://user:password@example.com', 'ftp://example.com', 'https://example.com:8080', 'http://metadata.google.internal', 'http://169.254.169.254']) {
    assert.throws(() => normalizeScanUrl(url), { status: 400 }, url);
  }
});
test('public address classification blocks reserved, mapped and transition networks', () => {
  for (const address of ['127.0.0.1', '10.2.3.4', '172.31.1.2', '192.168.0.1', '100.100.100.200', '169.254.0.1', '0.0.0.0', '192.0.0.9', '198.18.0.1', '198.51.100.1', '203.0.113.9', '224.0.0.1', '255.255.255.255', '::1', '::ffff:8.8.8.8', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1', '2001::1', '2002::1', '3fff::1']) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['8.8.8.8', '1.1.1.1', '192.0.78.9', '2001:4860:4860::8888', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address);
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

// A minimal published container in gtm.js format.
const gtmJs = (resource, permissions = {}) => `(function(){var data = ${JSON.stringify({ resource, permissions })};})();`;
const container = gtmJs({
  version: "7",
  macros: [{ function: "__e" }, { function: "__c", vtp_value: "G-ABC1234567" }, { function: "__c", vtp_value: "https://track.example.com" }],
  tags: [
    { function: "__googtag", vtp_tagId: ["macro", 1], vtp_configSettingsTable: ["list", ["map", "parameter", "server_container_url", "parameterValue", ["macro", 2]]] },
    { function: "__gaawe", vtp_eventName: "purchase", vtp_sendEcommerceData: true },
    { function: "__html", vtp_html: ["template", "<script>fbq('init','123456789012');fbq('track','Purchase',{},{eventID:'x'});</script>"] },
    { function: "__awct", vtp_conversionId: "987654321" },
    { function: "__cvt_X1", vtp_id: "t2_abc" }
  ],
  predicates: [{ function: "_eq", arg0: ["macro", 0], arg1: "purchase" }]
}, { __cvt_X1: { inject_script: { urls: ["https://www.redditstatic.com/ads/pixel.js"] } } });

test('GTM container parsing resolves constants, server URLs, events and template vendors', () => {
  const analysis = analyzeGtmContainer(extractGtmData(container));
  assert.deepEqual(analysis.serverUrls, ['https://track.example.com']);
  assert.equal(analysis.tags.find(t => t.type === 'ga4').id, 'G-ABC1234567');
  assert.equal(analysis.tags.find(t => t.type === 'ads-conversion').id, 'AW-987654321');
  assert.ok(analysis.customEvents.includes('purchase'));
  assert.match(analysis.text, /redditstatic\.com/);
  assert.equal(extractGtmData('no data here'), null);
});

test('visible text never counts as tracking: mentioning WooCommerce or Stape is not using them', () => {
  const html = `<html><body><p>We compare WooCommerce, GTM4WP and Stape. fbq('init','111') is how Meta works.</p></body></html>`;
  assert.doesNotMatch(codeOnly(html), /WooCommerce|Stape|fbq/);
  const report = buildReport({ url: 'https://example.com', pageText: html });
  assert.deepEqual(report.platforms, []);
  assert.deepEqual(report.stack.vendors, []);
  assert.equal(report.destinations.length, 0);
});

test('a live first-party server container confirms GA4 server-side; Meta is only "possible"', () => {
  const containers = [{ id: 'GTM-TEST1', status: 'ok', analysis: analyzeGtmContainer(extractGtmData(container)) }];
  const report = buildReport({ url: 'https://example.com', pageText: '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST1"></script>', containers, endpoints: [{ host: 'track.example.com', firstParty: true, healthy: true }] });
  const ga4 = report.destinations.find(d => d.key === 'ga4');
  const meta = report.destinations.find(d => d.key === 'meta');
  assert.equal(ga4.server.status, 'confirmed');
  assert.equal(meta.server.status, 'possible');
  assert.deepEqual(meta.ids, ['123456789012']);
  assert.equal(report.stack.serverSide.status, 'confirmed');
  assert.ok(!report.issues.some(i => i.id.startsWith('browser-only-')));
  assert.ok(!report.issues.some(i => i.id === 'ads-no-linker'), 'the Google tag provides the conversion linker');
  assert.ok(report.passed.some(p => /Server container is live/.test(p.title)));
});

test('browser-only pixels, duplicates and a dead server container are reported with fixes', () => {
  const page = `<script>!function(f){}(window);fbq('init','123456789012');fbq('track','PageView');</script><script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST1"></script>`;
  const containers = [{ id: 'GTM-TEST1', status: 'ok', analysis: analyzeGtmContainer(extractGtmData(container)) }];
  const report = buildReport({ url: 'https://example.com', pageText: page, containers, endpoints: [{ host: 'track.example.com', firstParty: true, healthy: false, error: 'HTTP 502' }] });
  assert.ok(report.issues.some(i => i.id === 'duplicate-meta' && i.severity === 'high'));
  assert.ok(report.issues.some(i => i.id === 'sgtm-down-track.example.com' && i.severity === 'critical'));
  for (const i of report.issues) { assert.ok(i.fix.length > 0, i.id); assert.ok(i.detail.length > 20, i.id); }
  const plain = buildReport({ url: 'https://shop.example.com', pageText: `<script>fbq('init','123456789012')</script><script src="https://connect.facebook.net/en_US/fbevents.js"></script>` });
  assert.ok(plain.issues.some(i => i.id === 'browser-only-meta' && i.severity === 'high'));
  assert.equal(plain.stack.serverSide.status, 'none');
  assert.ok(plain.score < 100 && plain.score > 0);
});

test('an unpublished GTM container is critical; JavaScript apps get an inconclusive result, not a false F', () => {
  const missing = buildReport({ url: 'https://example.com', pageText: '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-NOPE1"></script>', containers: [{ id: 'GTM-NOPE1', status: 'not-found' }] });
  assert.ok(missing.issues.some(i => i.id === 'gtm-missing-GTM-NOPE1' && i.severity === 'critical'));
  const app = buildReport({ url: 'https://example.com', pageText: '<html><body><div id="__next"></div><script src="/_next/static/chunks/main.js"></script></body></html>' });
  assert.equal(app.inconclusive, true);
  assert.equal(app.score, null);
  assert.ok(!app.issues.some(i => i.id === 'no-tracking'));
  const empty = buildReport({ url: 'https://example.com', pageText: '<html><body><h1>Shop</h1></body></html>' });
  assert.equal(empty.score, 0);
  assert.ok(empty.issues.some(i => i.id === 'no-tracking'));
});

test('Shopify app pixels are read and cookie values never reach the report', () => {
  const html = `<script src="https://cdn.shopify.com/s/files/x.js"></script><script>webPixelsConfigList: [{"id":"1","configuration":"{\\"pixel_id\\":\\"123456789012\\"}","type":"APP","apiClientId":2329312}]</script>`;
  const pixels = parseShopifyPixels(html);
  assert.equal(pixels.length, 1);
  const report = buildReport({ url: 'https://example.com', pageText: html, shopifyPixels: pixels, headers: { 'set-cookie': ['session=private-value; Secure; HttpOnly; Max-Age=3600'] } });
  const meta = report.destinations.find(d => d.key === 'meta');
  assert.deepEqual(meta.via, ['shopify-app']);
  assert.equal(meta.server.status, 'possible');
  assert.equal(report.cookies[0].maxAge, '3600');
  assert.doesNotMatch(JSON.stringify(report), /private-value/);
});

test('unconfirmed server-side tracking costs points instead of scoring as fully confirmed', () => {
  const pixels = [{ type: 'APP', configuration: '{"pixel_id":"123456789012"}' }];
  const report = buildReport({ url: 'https://example.com', pageText: '<script src="https://cdn.shopify.com/s/x.js"></script>', shopifyPixels: pixels });
  const unconfirmed = report.issues.find(i => i.id === 'unconfirmed-server-meta');
  assert.equal(unconfirmed.severity, 'medium');
  assert.match(unconfirmed.fix[0], /Events Manager/);
  assert.ok(!report.passed.some(p => p.title === 'Meta has a server-side path'));
  assert.ok(report.score < 100);
});

test('Meta pixel config reveals automatic advanced matching and the CAPI Gateway', () => {
  const js = `config.set("111222333444", "automaticMatching", {"selectedMatchKeys":["em","ph","external_id"]});
config.set("111222333444", "openbridge", {"endpoints":[{"targetDomain":null,"endpoint":"https:\/\/capig.example.on.aws\/","alwaysRetry":true}]});`;
  assert.deepEqual(parseMetaPixelConfig(js, '111222333444'), { id: '111222333444', automaticMatchingKeys: ['em', 'ph', 'external_id'], capiGateway: true, capiGatewayHost: 'capig.example.on.aws' });
  assert.deepEqual(parseMetaPixelConfig('config.set("999", "cookie", {});', '999'), { id: '999', automaticMatchingKeys: [], capiGateway: false, capiGatewayHost: '' });
});

test('EMQ estimate and ad-impact prediction follow what the setup actually sends', () => {
  const page = `<script src="https://connect.facebook.net/en_US/fbevents.js"></script><script>fbq('init','111222333444');fbq('track','PageView');</script>`;
  const browserOnly = buildReport({ url: 'https://shop.example.com', pageText: page, metaPixels: [{ id: '111222333444', automaticMatchingKeys: [], capiGateway: false }] });
  assert.equal(browserOnly.emq.score, 3.5);
  assert.equal(browserOnly.emq.label, 'Poor');
  assert.ok(browserOnly.issues.some(i => i.id === 'meta-low-emq'));
  const factor = browserOnly.adImpact.factors.find(f => f.platform === 'meta');
  assert.ok(Math.abs(factor.uplift - (1 / (1 - 0.178) - 1)) < 1e-9);
  assert.match(factor.url, /^https:\/\/www\.facebook\.com\/business\/news\//);
  assert.match(browserOnly.adImpact.disclaimer, /not a promise/);
  // Gateway on the pixel confirms CAPI: no impact factor, high EMQ, no low-EMQ issue.
  const gateway = buildReport({ url: 'https://shop.example.com', pageText: page, metaPixels: [{ id: '111222333444', automaticMatchingKeys: ['em', 'ph', 'external_id', 'fn', 'zp'], capiGateway: true, capiGatewayHost: 'x.on.aws' }] });
  assert.equal(gateway.destinations.find(d => d.key === 'meta').server.status, 'confirmed');
  assert.equal(gateway.emq.score, 10);
  assert.equal(gateway.adImpact, null);
  assert.ok(!gateway.issues.some(i => /meta-low-emq|browser-only-meta|unconfirmed-server-meta/.test(i.id)));
  // A manual fbq init with only an options object of non-PII keys is not advanced matching.
  const autoConfig = buildReport({ url: 'https://shop.example.com', pageText: page.replace("fbq('init','111222333444');", "fbq('init','111222333444',{autoConfig:false});"), metaPixels: [] });
  assert.equal(autoConfig.emq.keys.find(k => k.key === 'em').sent, false);
});
