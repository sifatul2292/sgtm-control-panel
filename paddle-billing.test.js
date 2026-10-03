import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { paddleCheckoutMatchesTenant, paddlePlanNameFromItems, paddleRenewalDate, verifyPaddleSignature } from "./paddle-billing.js";

test("Paddle signatures require a valid recent HMAC and support rotated signatures", () => {
  const secret = "pdl_ntfset_test";
  const body = Buffer.from('{"event_type":"transaction.completed"}');
  const now = 1_800_000_000_000;
  const timestamp = Math.floor(now / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}:${body}`).digest("hex");
  assert.equal(verifyPaddleSignature({ header: `ts=${timestamp};h1=wrong;h1=${signature}`, rawBody: body, secret, now }), true);
  assert.equal(verifyPaddleSignature({ header: `ts=${timestamp - 301};h1=${signature}`, rawBody: body, secret, now }), false);
  assert.equal(verifyPaddleSignature({ header: `ts=${timestamp};h1=${signature}`, rawBody: Buffer.from("changed"), secret, now }), false);
});

test("Paddle plan is derived from the server-confirmed item price", () => {
  const prices = { Starter: "pri_starter", Pro: "pri_pro", Enterprise: "pri_enterprise" };
  assert.equal(paddlePlanNameFromItems([{ price: { id: "pri_pro" } }], prices), "Pro");
  assert.equal(paddlePlanNameFromItems([{ status: "inactive", price: { id: "pri_pro" } }, { price_id: "pri_starter" }], prices), "Starter");
  assert.equal(paddlePlanNameFromItems([{ price: { id: "pri_unknown" } }], prices), "");
});

test("Paddle renewal date prefers a future provider date and otherwise uses 30 days", () => {
  const now = Date.parse("2026-09-29T00:00:00Z");
  assert.equal(paddleRenewalDate("2026-10-15T00:00:00Z", now), "2026-10-15T00:00:00.000Z");
  assert.equal(paddleRenewalDate("invalid", now), "2026-10-29T00:00:00.000Z");
});

test("new Paddle purchases must match the pending invoice and signed price plan", () => {
  const tenant = { pendingInvoiceNo: "tenant-INV001", pendingPlan: "Starter", paddleSubscriptionId: "sub_existing" };
  assert.equal(paddleCheckoutMatchesTenant(tenant, { invoiceNo: "tenant-INV001", planName: "Starter" }).ok, true);
  assert.equal(paddleCheckoutMatchesTenant(tenant, { invoiceNo: "tenant-INV001", planName: "Enterprise" }).ok, false);
  assert.equal(paddleCheckoutMatchesTenant(tenant, { invoiceNo: "other-INV001", planName: "Starter" }).ok, false);
  assert.deepEqual(paddleCheckoutMatchesTenant(tenant, { subscriptionId: "sub_existing", invoiceNo: "old", planName: "Starter" }), { ok: true, renewal: true });
});

test("Paddle activation, replay, renewal, and cancellation preserve tenant state", async () => {
  const source = readFileSync(new URL("./server.js", import.meta.url), "utf8");
  const extract = (name) => {
    const start = source.indexOf(`async function ${name}(`);
    return source.slice(start, source.indexOf("\n}\n", start) + 3);
  };
  const data = { tenants: [{ id: "test", plan: "Free", pendingPlan: "Starter", pendingInvoiceNo: "test-001" }], payments: [] };
  const profile = { monthlyRequestLimit: 500000, containerLimit: 1, domainLimit: 1, memoryMb: 256, cpuLimit: 1 };
  const context = vm.createContext({
    paddleCheckoutMatchesTenant, paddleRenewalDate,
    planResourceProfiles: { Starter: profile }, resourceProfileForPlan: () => profile,
    paddleUsdMonthly: { Starter: 30 }, FREE_CYCLE_DAYS: 30,
    readDatabase: async () => ({ available: true, data }), writeDatabase: async () => {},
    randomBytes: () => ({ toString: () => "random" }), nextInvoiceNo: () => "test-next",
    storedTagiooVisitor: () => ({}), forwardTagiooOwnEvent: async () => {},
    sendTagiooPurchaseToMetaCapi: async () => {}, emailCustomerActivated: async () => {},
    tenantRequestBaselineNow: () => 0,
  });
  vm.runInContext(extract("activatePaddleTenantLocked") + extract("deactivatePaddleTenantLocked"), context);
  const event = { tenantId: "test", planName: "Starter", amount: 0, currency: "USD", paddleTransactionId: "txn_test", paddleSubscriptionId: "sub_test", paddleInvoiceNo: "test-001" };
  assert.equal((await context.activatePaddleTenantLocked({ ...event, paddleInvoiceNo: "wrong" })).ok, false);
  assert.equal(data.payments.length, 0);
  assert.equal((await context.activatePaddleTenantLocked(event)).ok, true);
  assert.equal(data.tenants[0].paymentProvider, "paddle");
  assert.equal(data.payments[0].amount, 0);
  assert.equal((await context.activatePaddleTenantLocked(event)).duplicate, true);
  assert.equal(data.payments.length, 1);
  assert.equal((await context.activatePaddleTenantLocked({ ...event, tenantId: "", paddleTransactionId: "txn_renew", amount: 30 })).ok, true);
  assert.equal(data.payments.length, 2);
  assert.equal((await context.deactivatePaddleTenantLocked("sub_test")).ok, true);
  assert.equal(data.tenants[0].plan, "Free");
  const cycleStart = data.tenants[0].cycleStart;
  assert.equal((await context.deactivatePaddleTenantLocked("sub_test")).skipped, true);
  assert.equal(data.tenants[0].cycleStart, cycleStart);
});

test("Paddle plan changes use supported proration fields", async () => {
  const source = readFileSync(new URL("./server.js", import.meta.url), "utf8");
  const start = source.indexOf("async function updatePaddleSubscriptionPlan(");
  let request;
  const context = vm.createContext({
    config: { paddlePriceIds: { Starter: "pri_starter", Pro: "pri_pro" } },
    planRankFor: (name) => name === "Pro" ? 2 : 1,
    callPaddleApi: async (_path, _method, body) => { request = body; return { ok: true }; },
  });
  vm.runInContext(source.slice(start, source.indexOf("\n}\n", start) + 3), context);
  await context.updatePaddleSubscriptionPlan({ plan: "Starter", paddleSubscriptionId: "sub_test" }, "Pro");
  assert.equal(request.proration_billing_mode, "prorated_immediately");
  assert.equal(request.on_payment_failure, "prevent_change");
  assert.equal("effective_from" in request, false);
  await context.updatePaddleSubscriptionPlan({ plan: "Pro", paddleSubscriptionId: "sub_test" }, "Starter");
  assert.equal(request.proration_billing_mode, "prorated_next_billing_period");
});
