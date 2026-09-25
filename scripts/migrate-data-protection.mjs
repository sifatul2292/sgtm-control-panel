#!/usr/bin/env node
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isProtectedText,
  parseDataProtectionKey,
  parseProtectedJson,
  serializeProtectedJson
} from "../data-protection.js";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = resolve(rootDir, process.env.DATA_DIR || "data");
const key = process.env.TAGIOO_DATA_ENCRYPTION_KEY || "";
parseDataProtectionKey(key);
if (!key) throw new Error("TAGIOO_DATA_ENCRYPTION_KEY is required for migration.");

async function protectFile(path) {
  const current = await readFile(path, "utf8");
  if (isProtectedText(current)) {
    parseProtectedJson(current, key);
    return "already-protected";
  }

  const parsed = JSON.parse(current);
  const replacement = serializeProtectedJson(parsed, key);
  const temporary = `${path}.protected.tmp`;
  await writeFile(temporary, replacement, { encoding: "utf8", mode: 0o600 });
  parseProtectedJson(await readFile(temporary, "utf8"), key);
  await rename(temporary, path);
  return "protected";
}

await mkdir(dataDir, { recursive: true, mode: 0o700 });
const candidates = [join(dataDir, "history.json")];
const backupDir = join(dataDir, "backups");
for (const name of await readdir(backupDir).catch(() => [])) {
  if (/^backup-[A-Za-z0-9.-]+\.json$/.test(name)) candidates.push(join(backupDir, name));
}

let protectedCount = 0;
let existingCount = 0;
for (const path of candidates) {
  try {
    const result = await protectFile(path);
    if (result === "protected") protectedCount += 1;
    else existingCount += 1;
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw new Error(`${path}: ${error.message}`);
  }
}

console.log(`Protected ${protectedCount} file(s); verified ${existingCount} existing protected file(s).`);
