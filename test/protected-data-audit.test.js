import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { appendProtectedDataAudit } from "../protected-data-audit.js";

test("audit entries contain pseudonymous references and no raw identifiers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tagioo-audit-"));
  try {
    await appendProtectedDataAudit(directory, "audit-secret", {
      actor: "shopify-app",
      action: "shopify_order_stored",
      tenantId: "merchant@example.com",
      recordId: "order-1007"
    });
    const content = await readFile(join(directory, "protected-data-access.log"), "utf8");
    const row = JSON.parse(content.trim());
    assert.equal(content.includes("merchant@example.com"), false);
    assert.equal(content.includes("order-1007"), false);
    assert.equal(row.action, "shopify_order_stored");
    assert.equal(row.tenantRef.length, 24);
    assert.equal(row.recordRef.length, 24);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
