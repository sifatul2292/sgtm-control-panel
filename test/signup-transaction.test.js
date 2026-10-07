import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { randomBytes } from "node:crypto";

const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const functions = [
  extract("async function addCustomerAccountLocked", "async function resetCustomerAccountPassword"),
  extract("function signupTenantBase", "// Validate signup fields"),
  extract("async function addCustomerSignup(", "// Read the owner's manual-payment"),
  extract("async function selectCustomerPlanLocked", "// Customer reports they paid")
].join("\n");

for (const plan of ["Free", "Starter", "Pro", "Enterprise"]) {
  test(`${plan} verified signup commits account, attribution and plan in one read/write`, async () => {
    let reads = 0, writes = 0, locks = 0, welcomes = 0, saved;
    const context = {
      randomBytes,
      withDbLock: async (fn) => { locks++; return fn(); },
      readDatabase: async () => { reads++; return { available: true, data: { tenants: [], customerAccounts: [], payments: [] } }; },
      writeDatabase: async (data) => { writes++; saved = structuredClone(data); },
      validateCustomerAccountInput: (value) => ({ errors: [], value }),
      publicCustomerAccount: (account) => account,
      resourceProfileForPlan: () => ({ monthlyRequestLimit: 15000, containerLimit: 1, domainLimit: 1 }),
      monthlyAmountForPlan: () => 0,
      sanitizeId: (value) => value.toLowerCase().replace(/\s/g, "-"),
      emailWelcome: async () => { welcomes++; },
      billingCycleConfig: { monthly: { months: 1 } },
      planResourceProfiles: { Free: {}, Starter: {}, Pro: {}, Enterprise: {} },
      planRankFor: (value) => ["Free", "Starter", "Pro", "Enterprise"].indexOf(value),
      computeCycleAmount: () => 2900,
      nextInvoiceNo: () => "test-INV001",
      paymentInstructionsFor: (tenant) => ({ amount: tenant.pendingAmount, invoiceNo: tenant.pendingInvoiceNo }),
      input: { fullName: "Signup Smoke", email: "smoke@example.invalid", phone: "0000000000", passwordHash: "test-hash", plan },
    };
    const result = await runInNewContext(`${functions}\naddCustomerSignup(input, { userAgent: 'smoke' })`, context);
    assert.equal(result.ok, true);
    assert.equal(reads, 1);
    assert.equal(writes, 1);
    assert.equal(locks, 1);
    assert.equal(saved.customerAccounts.length, 1);
    const tenant = saved.tenants[0];
    assert.equal(tenant.plan, "Free", "paid limits must wait for confirmed payment");
    assert.equal(tenant.requestLimit, 15000);
    assert.equal(tenant.tracking.tagiooVisitor.userAgent, "smoke");
    assert.equal(tenant.pendingPlan, plan === "Free" ? undefined : plan);
    assert.equal(Boolean(result.checkout), plan !== "Free");
    assert.equal(welcomes, plan === "Free" ? 1 : 0, "paid signups wait for the payment activation email");
    assert.equal(tenant.paymentStatus, plan === "Free" ? "free" : "pending");
  });
}

test("login preserves unpaid signup and verification does not queue a second database write", () => {
  const login = extract('if (pathname === "/login" && req.method === "POST")', 'if (pathname === "/logout")');
  assert.doesNotMatch(login, /releaseUnpaidSignupToFree/);
  assert.match(login, /account\.releaseUnpaidSignup \? "\/checkout"/);
  const verify = extract('if (pathname === "/verify" && req.method === "POST")', 'if (pathname === "/checkout" && req.method === "GET")');
  assert.doesNotMatch(verify, /await selectCustomerPlan\(/);
  assert.doesNotMatch(verify, /saveTagiooVisitorContext\(/);
});
