import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

test("backup listing uses metadata, never reads database payloads", async () => {
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("async function listBackups()"), source.indexOf("function isValidBackupData"));
  const name = "backup-20261006T131225-abcdef.json";
  const result = await runInNewContext(`${body}\nlistBackups()`, {
    readdir: async () => [name, "ignore.tmp"],
    backupsDir: "/backups",
    BACKUP_ID_PATTERN: /^backup-[0-9]{8}T[0-9]{6}-[a-f0-9]{6}\.json$/,
    join: (...parts) => parts.join("/"),
    stat: async () => ({ mtime: new Date("2026-10-06T13:12:25Z"), size: 272 * 1024 * 1024 }),
    readFile: () => { throw new Error("Full snapshot read is forbidden"); },
    parseProtectedJson: () => { throw new Error("Full snapshot parse is forbidden"); }
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, name);
  assert.equal(result[0].createdAt, "2026-10-06T13:12:25.000Z");
  assert.equal(result[0].sizeBytes, 272 * 1024 * 1024);
});
