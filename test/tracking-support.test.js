import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function trackingFailureReport('), source.indexOf('function renderVerifyResult('));
function fixture(draft = '') {
  const nodes = [];
  const form = { elements: { subject: { value: '' }, text: { value: draft, focus() {} } } };
  const feedback = {};
  const context = {
    els: { verifyTrackingResult: { append(...items) { nodes.push(...items); } } },
    selectedCustomerContainerId: 'container-1', latestData: { tracking: { domain: 'https://track.example.com' } },
    currentSession: { role: 'customer' }, setView(view) { context.view = view; },
    document: { createElement() { return { addEventListener(_, handler) { this.click = handler; } }; },
      getElementById(id) { return id === 'ticketCreateForm' ? form : feedback; } },
  };
  vm.createContext(context); vm.runInContext(helpers, context);
  return { context, form, nodes, feedback };
}
const failure = { ok: false, at: '2026-10-13T10:00:00Z', checks: {
  container: { ok: false, detail: 'Certificate hostname mismatch.' }, ga4: { ok: true, detail: 'Passed.' },
} };
test('failed checks produce a reviewable ticket draft with scoped evidence, preserving existing text', () => {
  const f = fixture('My existing message');
  f.context.attachTrackingSupportAction(failure);
  f.nodes[1].click();
  assert.equal(f.context.view, 'support');
  assert.match(f.form.elements.text.value, /^My existing message\n\n/);
  assert.match(f.form.elements.text.value, /container-1/);
  assert.match(f.form.elements.text.value, /https:\/\/track.example.com/);
  assert.match(f.form.elements.text.value, /2026-10-13T10:00:00Z/);
  assert.match(f.form.elements.text.value, /sGTM container: Certificate hostname mismatch\./);
  assert.doesNotMatch(f.form.elements.text.value, /Passed\./);
  const previous = f.form.elements.text.value;
  f.nodes[1].click(); assert.equal(f.form.elements.text.value, previous);
});
test('passing tests have no support escalation', () => {
  const f = fixture(); f.context.attachTrackingSupportAction({ ok: true }); assert.equal(f.nodes.length, 0);
});
test('oversized existing draft stays intact and asks customer to shorten it', () => {
  const draft = 'x'.repeat(4950), f = fixture(draft);
  f.context.attachTrackingSupportAction(failure); f.nodes[1].click();
  assert.equal(f.form.elements.text.value, draft); assert.match(f.feedback.textContent, /too long/);
});
