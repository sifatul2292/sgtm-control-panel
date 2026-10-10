import test from 'node:test';
import assert from 'node:assert/strict';
import { communicationFeed, updateCommunication } from '../communication.js';
const owner = { role: 'owner' };
const a = { role: 'customer', tenantId: 'a', username: 'Alice' };
const b = { role: 'customer', tenantId: 'b', username: 'Bob' };
const first = '2026-10-10T01:00:00.000Z';
const second = '2026-10-10T02:00:00.000Z';

test('ticket lifecycle isolates customers, supports owner replies and close/reopen', () => {
  const data = {};
  const created = updateCommunication(data, a, 'ticket', { subject: 'Help', text: 'My question' }, first);
  const id = created.tickets[0].id;
  assert.equal(communicationFeed(data, b).tickets.length, 0);
  assert.equal(communicationFeed(data, owner).tickets[0].customer, 'Alice');
  assert.throws(() => updateCommunication(data, b, 'reply', { ticketId: id, text: 'Intruder' }), { status: 404 });
  updateCommunication(data, owner, 'reply', { ticketId: id, text: 'Our answer' }, second);
  assert.equal(communicationFeed(data, a).unread, 1);
  assert.equal(communicationFeed(data, b).notifications.length, 0);
  assert.throws(() => updateCommunication(data, a, 'status', { ticketId: id, status: 'closed' }), { status: 400 });
  updateCommunication(data, owner, 'status', { ticketId: id, status: 'closed' });
  assert.equal(data.supportTickets[0].status, 'closed');
  updateCommunication(data, a, 'reply', { ticketId: id, text: 'Follow-up' });
  assert.equal(data.supportTickets[0].status, 'open');
  assert.equal(data.supportTickets[0].messages.length, 3);
});

test('announcements reach everyone; read state persists separately and does not swallow new items', () => {
  const data = {};
  assert.throws(() => updateCommunication(data, a, 'announcement', { title: 'Bad', text: 'Bad' }), { status: 403 });
  updateCommunication(data, owner, 'announcement', { title: 'New feature', text: 'Now available' }, first);
  const displayed = communicationFeed(data, a).notifications[0].id;
  updateCommunication(data, owner, 'announcement', { title: 'Another feature', text: 'Also available' }, second);
  updateCommunication(data, a, 'read', { notificationId: displayed });
  assert.equal(communicationFeed(data, a).unread, 1);
  assert.equal(communicationFeed(data, b).unread, 2);
  const persisted = JSON.parse(JSON.stringify(data));
  updateCommunication(persisted, a, 'read', { notificationId: communicationFeed(persisted, a).notifications[0].id });
  assert.equal(communicationFeed(persisted, a).unread, 0);
  updateCommunication(persisted, a, 'read', { notificationId: displayed });
  assert.equal(communicationFeed(persisted, a).unread, 0);
});

test('invalid input cannot create partial tickets or announcements', () => {
  const data = {};
  for (const body of [null, [], { subject: '', text: 'hello' }, { subject: 'hello', text: ' ' }, { subject: 'x'.repeat(161), text: 'hello' }, { subject: 'hello', text: 'x'.repeat(5001) }]) {
    assert.throws(() => updateCommunication(data, a, 'ticket', body), { status: 400 });
    assert.equal(data.supportTickets, undefined);
  }
  assert.throws(() => updateCommunication(data, owner, 'announcement', { title: 'hello', text: ' ' }), { status: 400 });
  assert.equal(data.announcements, undefined);
  assert.throws(() => updateCommunication(data, { role: 'customer' }, 'ticket', { subject: 'x', text: 'x' }), { status: 403 });
});

// Exercise the real route branch with an isolated in-memory store, never production data.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const routeStart = server.indexOf('    if (pathname === "/api/communication"');
const routeEnd = server.indexOf('    if (pathname === "/api/customer/me"', routeStart);
async function route(data, session, method, body, available = true) {
  let result;
  let writes = 0;
  let locked = false;
  const context = {
    pathname: '/api/communication', req: { method }, res: {},
    getSession: () => session, jsonResponse: (_res, status, payload) => { result = { status, payload }; },
    readDatabaseCached: async () => ({ available, data }), readDatabase: async () => ({ available, data }),
    readJson: async () => body, checkRateLimit: () => true, tooManyRequests: () => {},
    communicationFeed, updateCommunication,
    withDbLock: async fn => { locked = true; try { return await fn(); } finally { locked = false; } },
    writeDatabase: async () => { assert.equal(locked, true); writes++; }
  };
  await vm.runInNewContext(`(async () => {${server.slice(routeStart, routeEnd)}})()`, context);
  return { ...result, writes };
}
test('API authenticates, writes under lock and scopes subsequent customer reads', async () => {
  const data = {};
  assert.equal((await route(data, null, 'GET')).status, 401);
  assert.equal((await route(data, { role: 'customer' }, 'GET')).status, 401);
  assert.equal((await route(data, a, 'POST', { action: 'ticket', subject: 'Help', text: 'Question' })).writes, 1);
  const ownerRead = await route(data, owner, 'GET');
  assert.equal(ownerRead.payload.tickets.length, 1);
  assert.equal(ownerRead.writes, 0);
  assert.equal((await route(data, b, 'GET')).payload.tickets.length, 0);
  const denied = await route(data, b, 'POST', { action: 'reply', ticketId: data.supportTickets[0].id, text: 'Bad' });
  assert.equal(denied.status, 404);
  assert.equal(denied.writes, 0);
  assert.equal((await route(data, a, 'GET', null, false)).status, 503);
  assert.equal((await route(data, a, 'POST', null)).status, 400);
});

test('mark-read UI saves without treating its panel as a form', async () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('async function saveCommunication(');
  const end = app.indexOf('\ndocument.getElementById("ticketCreateForm")', start);
  const feedback = {};
  let rendered = false;
  const button = { disabled: false };
  const context = {
    document: { getElementById: () => feedback }, communicationRevision: 0,
    fetch: async () => ({ ok: true, json: async () => ({ unread: 0 }) }),
    renderCommunication: () => { rendered = true; }, AbortSignal, JSON
  };
  vm.runInNewContext(app.slice(start, end), context);
  await context.saveCommunication({ action: 'read', notificationId: 'one' }, { tagName: 'DIV', querySelectorAll: () => [button] }, 'status');
  assert.equal(rendered, true);
  assert.equal(feedback.textContent, 'Saved.');
  assert.equal(button.disabled, false);
});
