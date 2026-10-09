import { readdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import { parseProtectedJson, serializeProtectedJson } from "../data-protection.js";
import { privacySafeBackupData } from "../shopify-privacy-backups.js";

// Run with node --env-file=.env. Dry run by default; no credentials or PII output.
const directory = resolve(process.env.DATA_DIR || "data");
const key = process.env.TAGIOO_DATA_ENCRYPTION_KEY || "";
const current = parseProtectedJson(await readFile(join(directory, "history.json")), key);
const routes = current.shopifyPrivacyRedactions || [];
let snapshots = 0, removedOrders = 0;
for (const name of await readdir(join(directory, "backups"))) {
  if (!/^backup-[0-9]{8}T[0-9]{6}-[a-f0-9]{6}\.json$/.test(name)) continue;
  const file = join(directory, "backups", name);
  const snapshot = parseProtectedJson(await readFile(file), key);
  const before = (snapshot.data.orders || []).length;
  const data = { ...snapshot.data, shopifyPrivacyRedactions: [...(snapshot.data.shopifyPrivacyRedactions || []), ...routes] };
  snapshot.data = await privacySafeBackupData(data);
  removedOrders += before - (snapshot.data.orders || []).length;
  if (process.argv.includes("--apply")) {
    const temp = `${file}.${randomBytes(8).toString("hex")}.tmp`;
    await writeFile(temp, serializeProtectedJson(snapshot, key), { mode: 0o600 });
    await rename(temp, file);
  }
  snapshots++;
}
console.log(JSON.stringify({ applied: process.argv.includes("--apply"), snapshots, removedOrders }));
