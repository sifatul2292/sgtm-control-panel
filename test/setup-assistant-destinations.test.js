import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

test("step 3 matches all destination combinations and preserves values when toggled", () => {
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const start = source.indexOf("function updateSetupAssistantDestinationFields(");
  const helper = source.slice(start, source.indexOf("\n}\n", start) + 3);
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const fields = [...html.matchAll(/<label data-assistant-destination="([^"]+)">([\s\S]*?)<\/label>/g)].map(m => ({
    dataset: { assistantDestination: m[1] }, input: { name: m[2].match(/name="([^"]+)"/)[1], value: "retained" },
    querySelectorAll() { return [this.input]; }
  }));
  assert.equal(fields.length, 11);
  assert.equal(fields.some(f => f.input.name === "webGtmContainerId"), false);
  let selected = [];
  const ctx = vm.createContext({ els: { setupAssistantForm: { querySelectorAll: selector => selector.includes(":checked") ? selected.map(value => ({ value })) : fields } } });
  vm.runInContext(helper, ctx);
  const destinations = ["ga4", "meta", "googleAds", "tiktok"];
  for (let mask = 0; mask < 16; mask++) {
    selected = destinations.filter((_, i) => mask & (1 << i));
    ctx.updateSetupAssistantDestinationFields();
    for (const field of fields) {
      const enabled = selected.includes(field.dataset.assistantDestination);
      assert.equal(field.hidden, !enabled);
      assert.equal(field.input.disabled, !enabled);
      assert.equal(field.input.value, "retained");
    }
  }
});
