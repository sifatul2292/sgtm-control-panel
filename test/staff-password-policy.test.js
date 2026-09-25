import assert from "node:assert/strict";
import test from "node:test";
import { staffPasswordPolicyErrors } from "../staff-password-policy.js";

test("accepts a long staff passphrase", () => {
  assert.deepEqual(staffPasswordPolicyErrors("correct horse battery staple", "owner"), []);
});

test("rejects short, common, and username-derived staff passwords", () => {
  assert.ok(staffPasswordPolicyErrors("short", "owner").length > 0);
  assert.ok(staffPasswordPolicyErrors("change-this-password", "owner").length > 0);
  assert.ok(staffPasswordPolicyErrors("owner-has-a-long-password", "owner").length > 0);
});
