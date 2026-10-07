import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf('els.customerSetupForm.addEventListener("submit"');
const handlerSource = source.slice(start, source.indexOf('\nwindow.addEventListener("hashchange"', start));

for (const success of [true, false]) {
  test(`container creation ${success ? "shows the created container" : "recovers after failure"}`, async () => {
    let handler, resolveResponse, calls = 0, view, rendered;
    const button = {}, attrs = new Map(), message = {};
    const form = { addEventListener: (_, fn) => { handler = fn; }, querySelector: () => button,
      setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k) };
    const context = vm.createContext({
      els: { customerSetupForm: form, customerSetupFormMessage: message, setupAssistantForm: { elements: { trackingDomain: {} } } },
      customerSubscriptionStatus: "active", selectedCustomerContainerId: "", setupAssistantContainerId: "", latestData: null,
      FormData: class { entries() { return [["containerName", "Test"]]; } },
      fetch: () => { calls++; return new Promise(resolve => { resolveResponse = resolve; }); },
      loadDashboard: async () => false,
      renderCustomerContainers: data => { rendered = data; }, setView: value => { view = value; },
      document: { querySelector: () => ({ scrollIntoView() {} }) }
    });
    vm.runInContext(handlerSource, context);
    const pending = handler({ preventDefault() {} });
    assert.equal(button.disabled, true);
    assert.match(button.innerHTML, /container-create-spinner.*Creating Container/);
    assert.equal(attrs.get("aria-busy"), "true");
    await handler({ preventDefault() {} });
    assert.equal(calls, 1);
    resolveResponse({ ok: success, json: async () => success
      ? { request: { id: "new", trackingDomain: "track.example.com", status: "dns_pending" } }
      : { errors: ["Invalid container config"] } });
    await pending;
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, "Create Container");
    assert.equal(attrs.has("aria-busy"), false);
    if (success) {
      assert.equal(view, "customerContainers");
      assert.equal(rendered.customerSetup.requests[0].id, "new");
      assert.equal(rendered.customerSetup.requests[0].status, "dns_pending");
      assert.equal(context.els.setupAssistantForm.elements.trackingDomain.value, "https://track.example.com");
    } else assert.equal(message.textContent, "Invalid container config");
  });
}
