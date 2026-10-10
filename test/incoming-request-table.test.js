import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('function requestDateLabel('), source.indexOf('\nfunction customerFallbackHost('));
function harness() {
  const rows = [];
  const tbody = { replaceChildren: fragment => { rows.push(...fragment.children); } };
  const context = {
    Date, Intl, els: { accessLog: tbody, eventLimitFilter: { value: '50' } },
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    formatMoney: value => String(value),
    document: {
      createDocumentFragment: () => ({ children: [], append(...items) { this.children.push(...items); } }),
      createElement: () => {
        const button = { expanded: 'false', getAttribute() { return this.expanded; }, setAttribute(_key, value) { this.expanded = value; }, addEventListener(_event, callback) { this.click = () => callback({ currentTarget: this }); } };
        return { button, querySelector: () => button };
      }
    }
  };
  vm.createContext(context); vm.runInContext(code, context);
  return { context, rows, tbody };
}
test('request dates use Dhaka time and malformed dates retain the fallback', () => {
  const { context } = harness();
  assert.match(context.requestDateLabel({ date: '2026-10-10T15:51:55Z' }), /Oct 10, 9:51:55 PM/);
  assert.equal(context.requestDateLabel({ date: 'invalid', displayDate: 'Unknown date' }), 'Unknown date');
  assert.equal(context.requestDateLabel({ date: null }), '—');
});
test('HTTP status distinguishes success, redirect, failure and unknown', () => {
  const { context } = harness();
  assert.equal(context.requestStatusClass(204), 'good');
  assert.equal(context.requestStatusClass(302), 'redirect');
  assert.equal(context.requestStatusClass(404), 'bad');
  assert.equal(context.requestStatusClass(503), 'bad');
  assert.equal(context.requestStatusClass('unknown'), 'unknown');
});
test('compact rows preserve escaped full URLs and expandable metadata', () => {
  const { context, rows } = harness();
  context.renderEventRows([{ date: '2026-10-10T15:51:55Z', status: 200, eventName: 'PageView', client: 'GA4', requestUrl: '/g/collect?x="<script>&value=1', detail: 'Event ID: sample' }], 'Empty');
  assert.equal(rows.length, 2);
  assert.match(rows[0].innerHTML, /request-date-cell/);
  assert.doesNotMatch(rows[0].innerHTML, /<script>/);
  assert.match(rows[1].innerHTML, /Full request URL/);
  assert.match(rows[1].innerHTML, /Event ID: sample/);
  assert.match(rows[1].innerHTML, /&lt;script&gt;/);
  assert.equal(rows[1].hidden, true);
  rows[0].button.click();
  assert.equal(rows[1].hidden, false);
  assert.equal(rows[0].button.expanded, 'true');
  rows[0].button.click(); assert.equal(rows[1].hidden, true);
});
