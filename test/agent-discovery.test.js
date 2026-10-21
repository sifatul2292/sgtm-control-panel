import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../public/.well-known/ai-catalog.json', import.meta.url), 'utf8'));
const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

test('ai-catalog.json follows the ARD manifest shape Lighthouse validates', () => {
  assert.equal(catalog.specVersion, '1.0');
  assert.deepEqual(Object.keys(catalog).sort(), ['entries', 'host', 'specVersion']);
  assert.ok(catalog.entries.length > 0);
  for (const entry of catalog.entries) {
    assert.match(entry.identifier, /^urn:air:tagioo\.com(:[a-zA-Z0-9._-]+)+$/);
    assert.ok(entry.displayName && entry.type);
    assert.ok(('url' in entry) !== ('data' in entry), 'exactly one of url or data');
    assert.ok(entry.representativeQueries.length >= 2 && entry.representativeQueries.length <= 5);
    // Every catalog URL on tagioo.com must be a file the server actually serves.
    const path = new URL(entry.url).pathname;
    readFileSync(new URL(`../public${path}`, import.meta.url));
    assert.ok(server.includes(`pathname === "${path}"`), `${path} has no route`);
  }
});

test('both well-known catalog paths are routed', () => {
  assert.ok(server.includes('pathname === "/.well-known/ai-catalog.json"'));
  assert.ok(server.includes('pathname === "/.well-known/ard.json"'));
});
