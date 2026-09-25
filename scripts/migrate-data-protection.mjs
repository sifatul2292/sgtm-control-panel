#!/usr/bin/env node
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, mkdir, open, readdir, rename, stat } from "node:fs/promises";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isProtectedText, parseDataProtectionKey, V2_MAGIC } from "../data-protection.js";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = resolve(rootDir, process.env.DATA_DIR || "data");
const key = parseDataProtectionKey(process.env.TAGIOO_DATA_ENCRYPTION_KEY || "");
if (!key) throw new Error("TAGIOO_DATA_ENCRYPTION_KEY is required for migration.");

function hashingTransform(hash) {
  return new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    }
  });
}

async function verifyProtectedFile(path, expectedDigest) {
  const info = await stat(path);
  const headerSize = V2_MAGIC.length + 12;
  if (info.size < headerSize + 16) throw new Error("Encrypted output is truncated.");
  const handle = await open(path, "r");
  const header = Buffer.alloc(headerSize);
  const tag = Buffer.alloc(16);
  try {
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, tag.length, info.size - tag.length);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, V2_MAGIC.length).equals(V2_MAGIC)) throw new Error("Encrypted output has an invalid header.");
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(V2_MAGIC.length));
  decipher.setAAD(V2_MAGIC);
  decipher.setAuthTag(tag);
  const digest = createHash("sha256");
  await pipeline(
    createReadStream(path, { start: headerSize, end: info.size - 17 }),
    decipher,
    hashingTransform(digest),
    new Transform({ transform(_chunk, _encoding, callback) { callback(); } })
  );
  if (digest.digest("hex") !== expectedDigest) throw new Error("Encrypted output failed plaintext checksum verification.");
}

async function protectFile(path) {
  const source = await open(path, "r");
  const header = Buffer.alloc(V2_MAGIC.length);
  try {
    await source.read(header, 0, header.length, 0);
  } finally {
    await source.close();
  }
  if (isProtectedText(header)) return "already-protected";

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(V2_MAGIC);
  const digest = createHash("sha256");
  const temporary = `${path}.protected.tmp`;
  const output = createWriteStream(temporary, { flags: "w", mode: 0o600 });
  output.write(V2_MAGIC);
  output.write(iv);
  await pipeline(createReadStream(path), hashingTransform(digest), cipher, output);
  await appendFile(temporary, cipher.getAuthTag());
  const expectedDigest = digest.digest("hex");
  await verifyProtectedFile(temporary, expectedDigest);
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
