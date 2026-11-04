import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { appendFileSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { createLiveEventTails } from '../live-events.js';

// An nginx line in the panel's sgtm log format, stamped with Dhaka time.
function accessLine({ at = new Date(), event = 'page_view', transactionId = '', host = 'track.example.com', agent = 'Mozilla/5.0 (Macintosh)' } = {}) {
  const dhaka = new Date(at.getTime() + 6 * 3600000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (value) => String(value).padStart(2, '0');
  const time = `${pad(dhaka.getUTCDate())}/${months[dhaka.getUTCMonth()]}/${dhaka.getUTCFullYear()}:${pad(dhaka.getUTCHours())}:${pad(dhaka.getUTCMinutes())}:${pad(dhaka.getUTCSeconds())} +0600`;
  const params = new URLSearchParams({ v: '2', tid: 'G-TEST123', cid: 'abc.123', en: event, dl: 'https://store.example.com/' });
  if (transactionId) {
    params.set('ep.transaction_id', transactionId);
    params.set('ep.event_id', transactionId);
    params.set('cu', 'USD');
    params.set('epn.value', '27.99');
  }
  return `203.0.113.7 - - [${time}] "POST /g/collect?${params} HTTP/2.0" 204 0 "https://store.example.com/" "${agent}" host="${host}"\n`;
}

const parseLine = (line) => {
  const match = line.match(/en=([a-z_]+)/);
  if (!match || line.includes('bot')) return null;
  const date = line.match(/at=(\d+)/);
  return { eventName: match[1], line, date: date ? new Date(Number(date[1])).toISOString() : null };
};

test('live tail backfills recent lines, then returns only lines appended after the cursor', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tagioo-live-'));
  const log = join(dir, 'shop-sgtm-access.log');
  try {
    writeFileSync(log, 'en=page_view at=1000\nen=view_item at=2000\nnot tracking\nen=add_to_cart at=3000\nen=begin_chec');
    const tails = createLiveEventTails({ parseLine, minCheckMs: 0 });
    const first = await tails.read([log]);
    assert.equal(first.readable, 1);
    // Newest first; the line nginx is still writing is not read yet.
    assert.deepEqual(first.events.map((event) => event.eventName), ['add_to_cart', 'view_item', 'page_view']);

    appendFileSync(log, 'kout at=4000\nen=purchase at=5000\nen=page_view bot at=5000\n');
    const second = await tails.read([log], { cursor: first.cursor });
    assert.deepEqual(second.events.map((event) => event.eventName), ['purchase', 'begin_checkout']);

    const third = await tails.read([log], { cursor: second.cursor });
    assert.deepEqual(third.events, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('live tail starts a big log near its end and drops the cut first line', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tagioo-live-'));
  const log = join(dir, 'big.log');
  try {
    writeFileSync(log, `${'en=page_view at=1000\n'.repeat(500)}en=purchase at=9000\n`);
    const tails = createLiveEventTails({ parseLine, backfillBytes: 100, minCheckMs: 0 });
    const { events } = await tails.read([log]);
    assert.ok(events.length <= 5);
    assert.equal(events[0].eventName, 'purchase');
    assert.ok(events.every((event) => event.line.startsWith('en=')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('live tail follows log rotation and survives a missing file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tagioo-live-'));
  const log = join(dir, 'rotating.log');
  try {
    const tails = createLiveEventTails({ parseLine, minCheckMs: 0 });
    const missing = await tails.read([log]);
    assert.equal(missing.readable, 0);
    writeFileSync(log, 'en=page_view at=1000\n');
    const first = await tails.read([log], { cursor: missing.cursor });
    assert.deepEqual(first.events.map((event) => event.eventName), ['page_view']);
    renameSync(log, `${log}.1`);
    writeFileSync(log, 'en=purchase at=2000\n');
    const rotated = await tails.read([log], { cursor: first.cursor });
    assert.deepEqual(rotated.events.map((event) => event.eventName), ['purchase']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a cursor from an earlier server process falls back to the since time', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tagioo-live-'));
  const log = join(dir, 'restart.log');
  try {
    writeFileSync(log, 'en=page_view at=1000\nen=view_item at=2000\nen=purchase at=3000\n');
    const tails = createLiveEventTails({ parseLine, minCheckMs: 0 });
    const result = await tails.read([log], { cursor: 'oldepoch.99', since: new Date(2000).toISOString() });
    assert.deepEqual(result.events.map((event) => event.eventName), ['purchase', 'view_item']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('viewers polling the same log within a second share one read', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tagioo-live-'));
  const log = join(dir, 'shared.log');
  let clock = 10000;
  try {
    writeFileSync(log, 'en=page_view at=1000\n');
    const tails = createLiveEventTails({ parseLine, minCheckMs: 1000, now: () => clock });
    const first = await tails.read([log]);
    appendFileSync(log, 'en=purchase at=2000\n');
    clock = 10500;
    assert.deepEqual((await tails.read([log], { cursor: first.cursor })).events, []);
    clock = 11000;
    assert.deepEqual((await tails.read([log], { cursor: first.cursor })).events.map((event) => event.eventName), ['purchase']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// The browser half: rows from the live feed merged into the dashboard payload.
function clientMerge() {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('function liveEventKey('), app.indexOf('function newestEventDate('));
  const context = vm.createContext({ LIVE_EVENTS_KEEP: 300, Map, Set, Number, String });
  vm.runInContext(source, context);
  return context.mergeLiveEvents;
}

const row = (date, eventName = 'PageView', transactionId = '') => ({
  date, eventName, transactionId, method: 'POST', status: '204', host: 'track.example.com',
  path: `/g/collect?en=${eventName}&t=${date}${transactionId ? `&ep.transaction_id=${transactionId}` : ''}`
});

function payload(rows = [], purchases = []) {
  return {
    nginx: {
      retainedEvents: { available: true, count: rows.length, recentEvents: [...rows], purchaseEvents: [...purchases], purchases: { rawCount: purchases.length, uniqueCount: purchases.length } },
      todayEvents: { available: true, count: rows.length, recentEvents: [...rows], purchaseEvents: [...purchases], purchases: { rawCount: purchases.length, uniqueCount: purchases.length } }
    }
  };
}

test('a live purchase shows in the event table, Purchase Inspector rows and purchase count once', () => {
  const merge = clientMerge();
  const data = payload([row('2026-11-04T09:00:00.000Z')]);
  const purchase = row('2026-11-04T09:00:05.000Z', 'Purchase', '1001');
  assert.equal(merge(data, [purchase]), true);
  for (const summary of [data.nginx.retainedEvents, data.nginx.todayEvents]) {
    assert.equal(summary.recentEvents[0].transactionId, '1001');
    assert.equal(summary.purchaseEvents.length, 1);
    assert.equal(summary.purchases.uniqueCount, 1);
    assert.equal(summary.count, 2);
  }
  // Every dashboard reload re-merges the buffered rows; nothing doubles.
  assert.equal(merge(data, [purchase]), false);
  assert.equal(data.nginx.retainedEvents.recentEvents.length, 2);
  assert.equal(data.nginx.retainedEvents.purchases.uniqueCount, 1);
});

test('rows the event store already has are not added again', () => {
  const merge = clientMerge();
  const purchase = row('2026-11-04T09:00:05.000Z', 'Purchase', '1001');
  const data = payload([purchase, row('2026-11-04T09:00:00.000Z')], [purchase]);
  assert.equal(merge(data, [{ ...purchase }]), false);
  assert.equal(data.nginx.todayEvents.recentEvents.length, 2);
  assert.equal(data.nginx.todayEvents.purchases.uniqueCount, 1);
});

test('the browser and server copies of one order count as one purchase', () => {
  const merge = clientMerge();
  const browser = row('2026-11-04T09:00:05.000Z', 'Purchase', '1001');
  const data = payload([browser], [browser]);
  const server = { ...row('2026-11-04T09:00:09.000Z', 'Purchase', '1001'), path: '/g/collect?en=purchase&ep.transaction_id=1001&server=1' };
  assert.equal(merge(data, [server]), true);
  assert.equal(data.nginx.retainedEvents.purchaseEvents.length, 2);
  assert.equal(data.nginx.retainedEvents.purchases.rawCount, 2);
  assert.equal(data.nginx.retainedEvents.purchases.uniqueCount, 1);
});

test('two identical requests in the same second stay two', () => {
  const merge = clientMerge();
  const view = row('2026-11-04T09:00:05.000Z');
  const data = payload([view]);
  merge(data, [view, { ...view }]);
  assert.equal(data.nginx.todayEvents.recentEvents.length, 2);
});

test('rows older than a full server list are not re-added after it moved on', () => {
  const merge = clientMerge();
  const newer = [row('2026-11-04T09:00:09.000Z'), row('2026-11-04T09:00:08.000Z')];
  const data = payload(newer);
  data.nginx.todayEvents.eventLogLimit = 2;
  data.nginx.retainedEvents.eventLogLimit = 2;
  assert.equal(merge(data, [row('2026-11-04T09:00:01.000Z')]), false);
  assert.equal(data.nginx.todayEvents.count, 2);
  assert.equal(merge(data, [row('2026-11-04T09:00:10.000Z')]), true);
  assert.equal(data.nginx.todayEvents.recentEvents[0].date, '2026-11-04T09:00:10.000Z');
});

test('an empty Event Log gets a summary for its first live events', () => {
  const merge = clientMerge();
  const data = { nginx: { retainedEvents: { available: false }, todayEvents: { available: false } } };
  assert.equal(merge(data, [row('2026-11-04T09:00:05.000Z', 'Purchase', '1001')]), true);
  assert.equal(data.nginx.todayEvents.available, true);
  assert.equal(data.nginx.todayEvents.recentEvents[0].eventName, 'Purchase');
  assert.equal(data.nginx.todayEvents.purchases.uniqueCount, 1);
});

test('Event Logs polls the live feed and reloads the full dashboard less often while it works', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(app, /fetch\(`\/api\/customer\/live-events\?\$\{params\}`/);
  assert.match(app, /currentViewName === "logs" && liveEventsAvailable \? LOGS_FULL_REFRESH_MS : LIVE_REFRESH_MS/);
  assert.match(app, /applyLiveEvents\(data\);\n    latestData = data;/);
  assert.match(html, /app\.js\?v=126/);
});

// End to end: a real server, a tenant's container access log on disk, and a
// customer session polling the live feed the way the Event Log does.
async function freePort() {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

function customerCookie(secret, tenantId) {
  const payloadText = JSON.stringify({ username: `${tenantId}@example.com`, role: 'customer', tenantId, issuedAt: String(Date.now()) });
  const signature = createHmac('sha256', secret).update(payloadText).digest('hex');
  return `sgtm_session=${Buffer.from(payloadText).toString('base64url')}.${signature}`;
}

test('a purchase written to the container log reaches the open Event Log feed within seconds', { timeout: 30000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tagioo-live-e2e-'));
  const secret = 'live-event-test-secret';
  const shopLog = join(dir, 'shop-sgtm-access.log');
  const multiA = join(dir, 'multi-a-sgtm-access.log');
  const multiB = join(dir, 'multi-b-sgtm-access.log');
  writeFileSync(shopLog, accessLine({ at: new Date(Date.now() - 20000) }));
  writeFileSync(multiA, accessLine({ host: 'a.example.com' }));
  writeFileSync(multiB, accessLine({ host: 'b.example.com', event: 'view_item' }));
  const tenant = (id) => ({ id, name: id, plan: 'Free', subscriptionStatus: 'free', paymentStatus: 'free', requestLimit: 15000 });
  writeFileSync(join(dir, 'history.json'), JSON.stringify({
    tenants: [tenant('shop-review'), tenant('multi'), tenant('no-container')],
    customerAccounts: [],
    customerSetupRequests: [
      { id: 'req-shop', tenantId: 'shop-review', trackingDomain: 'track.example.com', status: 'live' },
      { id: 'req-a', tenantId: 'multi', trackingDomain: 'a.example.com', status: 'live' },
      { id: 'req-b', tenantId: 'multi', trackingDomain: 'b.example.com', status: 'live' }
    ],
    provisioning: {
      requests: [
        { tenantId: 'shop-review', sourceRequestId: 'req-shop', containerName: 'sgtm-shop', plan: { accessLog: shopLog } },
        { tenantId: 'multi', sourceRequestId: 'req-a', containerName: 'sgtm-a', plan: { accessLog: multiA } },
        { tenantId: 'multi', sourceRequestId: 'req-b', containerName: 'sgtm-b', plan: { accessLog: multiB } }
      ]
    }
  }));
  const port = await freePort();
  const child = spawn(process.execPath, [join(process.cwd(), 'server.js')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATA_DIR: dir,
      PORT: String(port),
      HOST: '127.0.0.1',
      AUTH_ENABLED: 'true',
      AUTH_USERNAME: 'owner',
      AUTH_PASSWORD: 'owner-test-password',
      AUTH_SECRET: secret,
      TAGIOO_DATA_ENCRYPTION_KEY: '',
      RESEND_API_KEY: '',
      BREVO_API_KEY: '',
      SGTM_ACCESS_LOG: join(dir, 'missing-access.log'),
      SGTM_ERROR_LOG: join(dir, 'missing-error.log'),
      INGEST_INTERVAL_MS: '600000',
      PERSIST_SNAPSHOT_INTERVAL_MS: '600000',
      OWNER_DASHBOARD_WARM_MS: '600000',
      AUTO_LAUNCH_ENABLED: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}/api/customer/live-events`;
  const get = async (query, tenantId = 'shop-review') => {
    const response = await fetch(`${base}${query}`, { headers: tenantId ? { cookie: customerCookie(secret, tenantId) } : {} });
    return { status: response.status, body: await response.json() };
  };
  try {
    let opened = null;
    for (let attempt = 0; attempt < 100 && !opened; attempt += 1) {
      opened = await get('').catch(() => null);
      if (!opened) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(opened, output);
    assert.equal(opened.status, 200);
    assert.equal(opened.body.available, true);
    assert.equal(opened.body.events[0].eventName, 'PageView');

    // The Shopify web pixel's purchase lands in nginx's log for this container.
    const writtenAt = Date.now();
    appendFileSync(shopLog, accessLine({ event: 'purchase', transactionId: '19060219740464' }));
    let cursor = opened.body.cursor;
    let purchase = null;
    while (!purchase && Date.now() - writtenAt < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const poll = await get(`?cursor=${encodeURIComponent(cursor)}`);
      cursor = poll.body.cursor;
      purchase = poll.body.events.find((event) => event.eventName === 'Purchase');
    }
    assert.ok(purchase, 'purchase did not reach the live feed within 5 s');
    assert.equal(purchase.transactionId, '19060219740464');
    assert.equal(purchase.host, 'track.example.com');

    assert.equal((await get('', '')).status, 401);
    const stranger = await get('', 'no-container');
    assert.equal(stranger.body.available, false);
    assert.deepEqual(stranger.body.events, []);
    const second = await get('?container=req-b', 'multi');
    assert.deepEqual(second.body.events.map((event) => event.host), ['b.example.com']);
  } finally {
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});
