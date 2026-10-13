import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('function needsContainerUpgrade('), source.indexOf('function renderCustomerContainers('));
const needsUpgrade = vm.runInNewContext(`${helper}; needsContainerUpgrade`);
const data = (plan, requests = [{ status: 'active' }]) => ({ usage: { plan }, customerSetup: { requests } });

test('Free and Starter require an upgrade after the first container', () => {
  for (const plan of ['Free', 'Starter', ' starter ']) {
    assert.equal(needsUpgrade(data(plan), 'customer'), true);
    assert.equal(needsUpgrade(data(plan, []), 'customer'), false);
    assert.equal(needsUpgrade(data(plan, [{ status: 'deleted' }, { status: 'DELETE_REQUESTED' }]), 'customer'), false);
    assert.equal(needsUpgrade(data(plan, [{ status: 'pending' }]), 'customer'), true);
  }
});

test('Other plans and owners retain their creation flow', () => {
  for (const plan of ['Growth', 'Pro', 'Agency', 'Enterprise', 'Customer']) {
    assert.equal(needsUpgrade(data(plan), 'customer'), false);
  }
  assert.equal(needsUpgrade(data('Starter'), 'owner'), false);
  assert.equal(needsUpgrade(null, 'customer'), false);
});
