import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { privacyTokenHash, retainShopifyPrivacyRoute, removeShopifyOrders, shopifyCustomerOrders } from '../shopify-privacy.js';
import { scopedTrackingEntries, primaryContainerId } from '../container-scope.js';

const shop = 'old.myshopify.com';
const token = 'old-private-token';
const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const route = source.slice(source.indexOf('    if (pathname === "/api/integrations/shopify/privacy"'), source.indexOf('    if (pathname === "/api/integrations/shopify/connect"'));

test('delayed redaction after uninstall deletes only old shop and survives retry', async () => {
  const tenant = { id: 'test', tracking: { shopify: { shop, integrationToken: token } } };
  const data = { tenants: [tenant], orders: [
    { id: '1', tenantId: 'test', containerId: '', source: 'tagioo-shopify-app', raw: { customer_id: '5' } },
    { id: '2', tenantId: 'other', containerId: '', source: 'tagioo-shopify-app', raw: { shop_domain: shop } },
  ] };
  retainShopifyPrivacyRoute(data, tenant, '', tenant.tracking);
  delete tenant.tracking.shopify;
  tenant.tracking.shopify = { shop: 'new.myshopify.com', integrationToken: 'new-token' };
  data.orders.push({ id: '3', tenantId: 'test', containerId: '', source: 'tagioo-shopify-app', raw: { shop_domain: 'new.myshopify.com' } });
  let syncCalls = 0;
  async function invoke(topic, suppliedToken = token, requestedShop = shop) {
    const body = Buffer.from(JSON.stringify({ shop: requestedShop, topic, payload: { customer: { id: 5 } } }));
    const req = { headers: { 'x-tagioo-privacy-token': suppliedToken, signature: createHmac('sha256', suppliedToken).update(body).digest('hex') } };
    let response;
    const context = {
      pathname: '/api/integrations/shopify/privacy', req: { ...req, method: 'POST' }, res: {},
      reqUrl: new URL('https://test/api/integrations/shopify/privacy?tenant=test'),
      sanitizeId: v => v, readRawBody: async () => body,
      readDatabaseCached: async () => ({ available: true, data }), readDatabase: async () => ({ available: true, data }),
      writeDatabase: async () => {}, withDbLock: async fn => fn(),
      scopedTrackingEntries, primaryContainerId, retainShopifyPrivacyRoute, privacyTokenHash, removeShopifyOrders, shopifyCustomerOrders,
      isShopifyIntegrationAuthorized: (r, b, t) => r.headers.signature === createHmac('sha256', t).update(b).digest('hex'),
      jsonResponse: (_r, status, result) => { response = { status, result }; },
      syncShopifySubscription: async () => { syncCalls++; return { ok: true }; },
      recordProtectedDataAccess: async () => {},
    };
    await vm.runInNewContext(`(async()=>{${route}})()`, context);
    return response;
  }
  assert.equal((await invoke('CUSTOMERS_REDACT', 'wrong')).status, 401);
  assert.equal((await invoke('SHOP_REDACT', token, 'new.myshopify.com')).status, 400);
  assert.equal(data.orders.length, 3);
  assert.equal((await invoke('CUSTOMERS_REDACT')).status, 200);
  assert.deepEqual(data.orders.map(o => o.id), ['2', '3']);
  assert.equal((await invoke('SHOP_REDACT')).status, 200);
  assert.equal(data.shopifyPrivacyRoutes.length, 0);
  assert.equal(JSON.stringify(data.shopifyPrivacyRedactions).includes(token), false);
  assert.equal((await invoke('SHOP_REDACT')).status, 200);
  assert.equal((await invoke('CUSTOMERS_REDACT')).status, 400);
  assert.equal(syncCalls, 0);
  assert.equal(tenant.tracking.shopify.shop, 'new.myshopify.com');
});
