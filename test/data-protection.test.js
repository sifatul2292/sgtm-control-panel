import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  isProtectedText,
  parseProtectedJson,
  protectText,
  serializeProtectedJson,
  unprotectText
} from "../data-protection.js";

test("protected JSON round-trips without exposing plaintext", () => {
  const key = randomBytes(32).toString("base64");
  const value = { email: "buyer@example.com", orders: [{ id: "1007" }] };
  const protectedValue = serializeProtectedJson(value, key);

  assert.equal(isProtectedText(protectedValue), true);
  assert.equal(protectedValue.includes("buyer@example.com"), false);
  assert.deepEqual(parseProtectedJson(protectedValue, key), value);
});

test("existing plaintext JSON remains readable during migration", () => {
  const value = { tenants: [], payments: [] };
  assert.deepEqual(parseProtectedJson(JSON.stringify(value), ""), value);
});

test("tampering and incorrect keys fail authentication", () => {
  const key = randomBytes(32).toString("base64");
  const otherKey = randomBytes(32).toString("base64");
  const protectedValue = protectText("sensitive", key);

  assert.throws(() => unprotectText(protectedValue, otherKey), /could not be authenticated/);
  assert.throws(() => unprotectText(`${protectedValue.slice(0, -2)}AA`, key), /could not be authenticated/);
});
