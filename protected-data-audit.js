import { appendFile, mkdir } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { join } from "node:path";

function pseudonym(value, secret) {
  if (value === undefined || value === null || value === "") return "";
  return createHmac("sha256", String(secret)).update(String(value)).digest("hex").slice(0, 24);
}

export async function appendProtectedDataAudit(dataDir, secret, entry) {
  if (!secret) throw new Error("An audit pseudonymization secret is required.");
  const record = {
    at: new Date().toISOString(),
    actor: String(entry.actor || "system"),
    action: String(entry.action || "unknown"),
    outcome: String(entry.outcome || "success"),
    tenantRef: pseudonym(entry.tenantId, secret),
    recordRef: pseudonym(entry.recordId, secret),
    count: Number.isFinite(Number(entry.count)) ? Number(entry.count) : undefined
  };
  for (const key of Object.keys(record)) {
    if (record[key] === "" || record[key] === undefined) delete record[key];
  }
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  await appendFile(join(dataDir, "protected-data-access.log"), `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
}
