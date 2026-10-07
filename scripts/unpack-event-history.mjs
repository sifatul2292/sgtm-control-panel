// Run only with the panel stopped, before rolling back to a legacy reader.
// Does not delete archived history; creates a protected backup before replacement.
import { readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { parseProtectedJson, serializeProtectedJson } from "../data-protection.js";
import { unpackEventHistory } from "../history-archive.js";
if (!process.argv.includes("--panel-stopped")) throw new Error("Stop the panel first; pass --panel-stopped to confirm.");
const path = join(process.env.DATA_DIR || "./data", "history.json");
const key = process.env.TAGIOO_DATA_ENCRYPTION_KEY || "";
const data = parseProtectedJson(await readFile(path), key);
if (!data.tenantEventHistoryArchive) { console.log("Already legacy-compatible."); process.exit(0); }
const backup = `${path}.before-unpack-${Date.now()}`;
await copyFile(path, backup);
const temp = `${path}.unpack-${Date.now()}.tmp`;
await writeFile(temp, serializeProtectedJson(unpackEventHistory(data), key), { mode: 0o600 });
await rename(temp, path);
console.log("Legacy-compatible event history restored. Backup:", backup);
