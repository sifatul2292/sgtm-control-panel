import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("./server.js", import.meta.url), "utf8");
const definition = source.match(/function normalizeContainerId\(value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(definition, "normalizeContainerId must remain defined in server.js");
const normalizeContainerId = vm.runInNewContext(`(${definition})`);

test("generated container IDs survive exact ownership lookup", () => {
  const storedId = "setup_mtsvfp57_abcdef";
  const owned = [{ id: storedId }];
  assert.equal(owned.some(({ id }) => id === normalizeContainerId(storedId)), true);
  assert.equal(owned.some(({ id }) => id === normalizeContainerId(`../${storedId}`)), false);
  assert.equal(owned.some(({ id }) => id === normalizeContainerId(`${storedId}-unexpected-suffix`)), false);
});
