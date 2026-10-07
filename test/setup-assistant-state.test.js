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
    ${source.slice(source.indexOf("function savedSetupAssistantStep("), source.indexOf("function renderSetupAssistant("))}
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

test("wizard restores saved steps by account/container and reveals instructions only on step 4", () => {
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const helper = source.slice(source.indexOf("function savedSetupAssistantStep("), source.indexOf("function renderSetupAssistant("));
  const start = source.indexOf("function updateSetupAssistantStep(");
  const update = source.slice(start, source.indexOf("\n}\n", start) + 3);
  const storage = new Map(), instructions = {};
  const context = vm.createContext({
    window: { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } },
    document: { querySelectorAll: selector => selector === "[data-assistant-final-only]" ? [instructions] : [] },
    els: {}, updateSetupAssistantDestinationFields() {}
  });
  vm.runInContext(`let setupAssistantContainerId="account-a:container-a"; let setupAssistantStep=2; let prevAssistantStep=1; ${helper}\n${update}\nupdateSetupAssistantStep();`, context);
  assert.equal(instructions.hidden, true);
  assert.equal(vm.runInContext('savedSetupAssistantStep("account-a:container-a", 1)', context), 2);
  assert.equal(vm.runInContext('savedSetupAssistantStep("account-b:container-a", 1)', context), 1);
  assert.equal(vm.runInContext('savedSetupAssistantStep("account-a:container-b", 1)', context), 1);
  vm.runInContext("setupAssistantStep=4;updateSetupAssistantStep()", context);
  assert.equal(instructions.hidden, false);
  vm.runInContext("setupAssistantStep=2;updateSetupAssistantStep()", context);
  // A new browser page/login instance reads the same durable preference.
  const reloaded = vm.createContext({ window: context.window });
  vm.runInContext(helper, reloaded);
  assert.equal(vm.runInContext('savedSetupAssistantStep("account-a:container-a", 4)', reloaded), 2);
  storage.set("tagioo_assistant_step_account-a:container-a", "99");
  assert.equal(vm.runInContext('savedSetupAssistantStep("account-a:container-a", 1)', reloaded), 1);
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /class="assistant-instructions panel" data-assistant-final-only hidden/);
});
