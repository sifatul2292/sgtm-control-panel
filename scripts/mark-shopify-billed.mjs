// Support tool: mark one workspace as billed by Shopify (App Store requirement
// 1.2.1) and drop an unpaid staged checkout, the same change a sign-in from the
// Tagioo Shopify app makes.
//
//   node --env-file=.env scripts/mark-shopify-billed.mjs <tenantId>            # dry run
//   node --env-file=.env scripts/mark-shopify-billed.mjs <tenantId> --apply    # save
//
// --apply edits history.json outside the server's write lock: stop the panel
// first (pm2 stop sgtm-control-panel) and start it again afterwards.
import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { parseProtectedJson, serializeProtectedJson } from "../data-protection.js";
import { requiresShopifyBilling, shopifyAdoptionBlocker } from "../shopify-billing.js";

const [tenantId, flag] = process.argv.slice(2);
if (!tenantId) {
  console.error("Usage: mark-shopify-billed.mjs <tenantId> [--apply]");
  process.exit(1);
}
const apply = flag === "--apply";
const key = process.env.TAGIOO_DATA_ENCRYPTION_KEY || "";
const databasePath = join(resolve(process.env.DATA_DIR || "data"), "history.json");
const data = parseProtectedJson(await readFile(databasePath), key);
const index = (data.tenants || []).findIndex((tenant) => tenant.id === tenantId);
if (index === -1) {
  console.error(`Workspace ${tenantId} was not found.`);
  process.exit(1);
}
const tenant = data.tenants[index];
const account = (data.customerAccounts || []).find((item) => item.tenantId === tenantId);
const payments = (data.payments || []).filter((payment) => payment.tenantId === tenantId);
console.log(`workspace ${tenantId}: created ${tenant.createdAt || "?"}, source ${tenant.source || "?"}, login email domain @${String(account?.email || account?.username || "").split("@")[1] || "?"}`);
console.log("payments:", JSON.stringify(payments.map((p) => ({ invoiceNo: p.invoiceNo, status: p.status, provider: p.provider || p.method || "", plan: p.plan }))));

const blocker = shopifyAdoptionBlocker(tenant, data.payments || []);
if (blocker) {
  console.error(`Not changed: ${blocker}`);
  process.exit(2);
}

const now = new Date();
// Same release as the panel's unpaidSignupReleasedToFree: nothing was charged
// for a staged checkout that never completed.
const releasable = tenant.subscriptionStatus === "pending_payment" && !(tenant.plan !== "Free" && tenant.paymentStatus === "paid");
const dhakaToday = new Date(now.getTime() + 6 * 3600000).toISOString().slice(0, 10);
const next = {
  ...tenant,
  ...(releasable ? {
    plan: "Free",
    requestLimit: 15000,
    containerLimit: 1,
    domainLimit: 1,
    extraContainers: 0,
    monthlyAmount: 0,
    subscriptionStatus: "free",
    paymentStatus: "free",
    scheduledPlan: "",
    scheduledPlanCycle: "",
    cycleStart: tenant.cycleStart || now.toISOString(),
    cycleEnd: tenant.cycleEnd || new Date(now.getTime() + 30 * 86400000).toISOString(),
    cycleBaseline: tenant.cycleStart && tenant.cycleEnd
      ? Number(tenant.cycleBaseline || 0)
      : Number(data.tenantDailyRequests?.[tenantId]?.[dhakaToday] || 0),
    suspensionEnforcedAt: ""
  } : {}),
  pendingPlan: "",
  pendingAmount: 0,
  pendingBillingCycle: "",
  pendingInvoiceNo: "",
  shopifyBillingRequired: true,
  updatedAt: now.toISOString()
};

const changed = Object.keys(next).filter((field) => field !== "updatedAt" && JSON.stringify(next[field]) !== JSON.stringify(tenant[field]));
console.log(`billed by Shopify now: ${requiresShopifyBilling(tenant)} -> ${requiresShopifyBilling(next)}`);
for (const field of changed) console.log(`  ${field}: ${JSON.stringify(tenant[field] ?? null)} -> ${JSON.stringify(next[field])}`);
if (!changed.length) {
  console.log("Nothing to change.");
  process.exit(0);
}
if (!apply) {
  console.log("Dry run: nothing saved. Re-run with --apply while the panel is stopped.");
  process.exit(0);
}

const stamp = now.toISOString().replace(/[-:.]/g, "").slice(0, 15);
await copyFile(databasePath, `${databasePath}.before-mark-shopify-${tenantId}-${stamp}`);
data.tenants[index] = next;
const tempPath = `${databasePath}.${Date.now()}.${randomBytes(4).toString("hex")}.tmp`;
await writeFile(tempPath, serializeProtectedJson(data, key), { encoding: "utf8", mode: 0o600 });
await rename(tempPath, databasePath);
console.log(`Saved. Previous file kept as history.json.before-mark-shopify-${tenantId}-${stamp}`);
