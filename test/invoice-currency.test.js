import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("Paddle invoices use USD while legacy manual invoices keep BDT", () => {
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const start = source.indexOf("function invoiceMoney(");
  const helper = source.slice(start, source.indexOf("\n}\n", start) + 3);
  const context = vm.createContext({});
  vm.runInContext(helper, context);
  assert.equal(vm.runInContext('invoiceMoney(32.66, "USD")', context), "$32.66");
  assert.equal(vm.runInContext('invoiceMoney(2900, "BDT")', context), "৳2,900");
  assert.equal(vm.runInContext("invoiceMoney(2900)", context), "৳2,900");
  assert.match(source, /invoiceMoney\(c.amount, c.currency\)/);
  assert.match(source, /invoiceMoney\(n, payment.currency\)/);
});
