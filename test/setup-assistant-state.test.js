import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("completed assistants reopen at step 4 without interrupting Back edits", () => {
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const start = source.indexOf("function renderSetupAssistant(");
  const render = source.slice(start, source.indexOf("\n}\n", start) + 3);
  const context = vm.createContext({
    els: { setupAssistantForm: { reset() {}, elements: {} } },
    document: { querySelector: () => null },
    currentSession: { tenantId: "customer-a" },
    setWooWebhookSecret() {}, renderLaravelSelfService() {},
    updateLaravelAssistantFields() {}, updateSetupAssistantStep() {},
  });
  vm.runInContext(`let setupAssistantContainerId = null;
    let setupAssistantCompleted = false;
    let setupAssistantStep = 1;
    let generatedAssistantTemplates = null;
    ${render}`, context);
  const apply = (tracking, id = "container-a") => {
    context.data = { tracking, activeContainer: { id }, customerSetup: { requests: [{ id }] } };
    vm.runInContext("renderSetupAssistant(data)", context);
    return vm.runInContext("setupAssistantStep", context);
  };
  assert.equal(apply({ setupAssistantCompletedAt: "2026-10-02" }), 4);
  vm.runInContext("setupAssistantStep = 2", context);
  assert.equal(apply({ setupAssistantCompletedAt: "2026-10-02" }), 2);
  assert.equal(apply({}, "container-b"), 1);
  assert.equal(apply({ platform: "shopify", domain: "https://track.example", measurementId: "G-123" }, "container-c"), 4);
  assert.equal(apply({ platform: "shopify", domain: "https://track.example" }, "container-d"), 1);
  assert.equal(apply({ setupAssistantCompletedAt: "2026-10-02" }, ""), 4);
  context.currentSession.tenantId = "customer-b";
  assert.equal(apply({}, ""), 1);
});
