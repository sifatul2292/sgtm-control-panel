import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
function extract(name) {
  const start = source.indexOf("function " + name + "(");
  return source.slice(start, source.indexOf("\n}\n", start) + 3);
}
function harness() {
  const body = {}, guide = { open: true, querySelector: () => body };
  const els = { downloadWebTemplate: {}, downloadServerTemplate: {}, copyShopifyCustomPixel: {}, shopifyCustomPixelPreview: {}, setupAssistantResult: {} };
  const ctx = vm.createContext({
    document: { querySelector: () => guide }, els,
    escapeHtml: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    generatedAssistantTemplates: { web: {}, server: {} }
  });
  vm.runInContext(extract("renderSaasSetupGuide") + extract("invalidateSetupAssistantTemplates"), ctx);
  return { ctx, guide, body, els };
}
test("guide separates prose and code, escapes content and resets disclosure", () => {
  const { ctx, guide, body } = harness();
  ctx.renderSaasSetupGuide('After success only.\n// Signup\ndataLayer.push({event:"sign_up"});\nNever send <script>personal data</script>.');
  assert.equal(guide.hidden, false);
  assert.equal(guide.open, false);
  assert.match(body.innerHTML, /<p>After success only\.<\/p>/);
  assert.match(body.innerHTML, /<pre><code>\/\/ Signup\ndataLayer.push/);
  assert.doesNotMatch(body.innerHTML, /<script>/);
  ctx.renderSaasSetupGuide("");
  assert.equal(guide.hidden, true);
  assert.equal(body.innerHTML, "");
});
test("edited settings disable stale downloads and hide old guide", () => {
  const { ctx, els, guide } = harness();
  ctx.invalidateSetupAssistantTemplates();
  assert.equal(ctx.generatedAssistantTemplates, null);
  assert.equal(els.downloadWebTemplate.disabled, true);
  assert.equal(els.downloadServerTemplate.disabled, true);
  assert.equal(els.copyShopifyCustomPixel.disabled, true);
  assert.equal(guide.hidden, true);
  assert.match(els.setupAssistantResult.textContent, /Regenerate/);
  assert.match(source, /requestContainer !== setupAssistantContainerId/);
  assert.match(source, /requestPayload !== JSON.stringify\(setupAssistantPayload\(\)\)/);
});
test("guide uses a dedicated responsive disclosure instead of download card grid", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(html, /id="saasSetupGuide" class="assistant-saas-guide"/);
  assert.match(css, /\.assistant-saas-guide-body pre\s*\{[^}]*white-space: pre-wrap;[^}]*overflow-wrap: anywhere;/);
});
