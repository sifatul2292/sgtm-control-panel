import { timingSafeEqual } from "node:crypto";

export const SHOPIFY_BILLING_PLANS = new Set(["Free", "Starter", "Pro", "Enterprise"]);
export const SHOPIFY_APP_HANDLE = "tagioo-tracking";
export const SHOPIFY_HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;
export const SIGNUP_STORE_PLATFORMS = ["shopify", "woocommerce", "custom", "other"];

export function normalizeShopDomain(value) {
  const shop = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) ? shop : "";
}

// Shopify App Pricing hosts plan selection in the merchant's own admin.
export function shopifyPlanSelectionUrl(shop) {
  const handle = normalizeShopDomain(shop).replace(/\.myshopify\.com$/, "");
  return handle ? `https://admin.shopify.com/store/${encodeURIComponent(handle)}/charges/${SHOPIFY_APP_HANDLE}/pricing_plans` : "";
}

// The embedded app links merchants here with their shop. The cookie only marks
// the browser's next signup or login as Shopify-billed; `sign` is the panel's
// session HMAC, so the shop cannot be edited client-side. `verified` records
// that the link was signed by the app, which proves the merchant came from that
// store's admin; a bare ?shop= link only decides billing.
export function makeShopifyHandoffCookie(shop, sign, now = Date.now(), verified = false) {
  const payload = `${normalizeShopDomain(shop)}:${now}${verified ? ":app" : ""}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function readShopifyHandoff(value, sign, now = Date.now()) {
  const none = { shop: "", verified: false };
  const [encoded, signature] = String(value || "").split(".");
  if (!encoded || !signature) return none;
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return none;
  const [shop, issuedAt, mark] = payload.split(":");
  const age = now - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > SHOPIFY_HANDOFF_TTL_MS) return none;
  const normalized = normalizeShopDomain(shop);
  return { shop: normalized, verified: Boolean(normalized) && mark === "app" };
}

export function readShopifyHandoffCookie(value, sign, now = Date.now()) {
  return readShopifyHandoff(value, sign, now).shop;
}

// A workspace already paying outside Shopify (or waiting on a manual claim) must
// settle that first; flipping it to Shopify billing would strand the payment.
export function shopifyAdoptionBlocker(tenant, payments = []) {
  if (!tenant) return "Customer account was not found.";
  if (tenant.plan !== "Free" && tenant.paymentStatus === "paid" && tenant.paymentProvider !== "shopify" && !tenant.lifetimeAccess) {
    return "This workspace has a paid plan billed outside Shopify. Cancel that subscription and move the workspace to Free first, or create a separate Tagioo account for your Shopify store.";
  }
  if (payments.some((payment) => payment.tenantId === tenant.id && payment.status === "pending")) {
    return "This workspace has a payment waiting for confirmation. Contact Tagioo support before connecting it to Shopify.";
  }
  return "";
}

export function shopifyShopForTenant(tenant) {
  const tracking = tenant?.tracking || {};
  const connected = [tracking, ...Object.values(tracking.containerConfigs || {})]
    .map((entry) => normalizeShopDomain(entry?.shopify?.shop))
    .find(Boolean);
  return connected || normalizeShopDomain(tenant?.shopifyShop);
}

export function normalizeShopifyBillingState(payload) {
  const plan = String(payload?.plan || "").trim();
  const shop = String(payload?.shop || "").trim().toLowerCase();
  const cycleStart = String(payload?.cycleStart || "").trim();
  const cycleEnd = String(payload?.cycleEnd || "").trim();
  const amount = Number(payload?.amount || 0);
  const currency = String(payload?.currency || "USD").trim().toUpperCase();
  if (!SHOPIFY_BILLING_PLANS.has(plan)) return { ok: false, error: "Unknown Shopify billing plan." };
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) return { ok: false, error: "Invalid Shopify store domain." };
  if (payload?.status === "disconnected" && plan !== "Free") return { ok: false, error: "A disconnected Shopify store must use the Free entitlement." };
  if (plan !== "Free" && (!cycleEnd || Number.isNaN(new Date(cycleEnd).getTime()))) {
    return { ok: false, error: "A paid Shopify plan requires a valid billing-cycle end date." };
  }
  if (cycleStart && Number.isNaN(new Date(cycleStart).getTime())) return { ok: false, error: "Invalid billing-cycle start date." };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Invalid Shopify billing amount." };
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "Invalid Shopify billing currency." };
  return {
    ok: true,
    value: {
      shop,
      plan,
      status: payload?.status === "disconnected" ? "disconnected" : plan === "Free" ? "free" : "active",
      billingPeriod: String(payload?.billingPeriod || "").trim().slice(0, 40),
      cycleStart,
      cycleEnd,
      cancelAtEndOfCycle: Boolean(payload?.cancelAtEndOfCycle),
      amount,
      currency
    }
  };
}

export function highestActiveShopifyPlan(billings, rankFor) {
  return (billings || [])
    .filter((billing) => billing?.status === "active" && SHOPIFY_BILLING_PLANS.has(billing.plan))
    .sort((a, b) => rankFor(b.plan) - rankFor(a.plan))[0] || null;
}

// Reserve Shopify workspaces before the first successful billing sync.
export function requiresShopifyBilling(tenant) {
  if (!tenant) return false;
  if (tenant.paymentProvider === "shopify" || tenant.shopifyBillingRequired
    || String(tenant.platform || "").toLowerCase() === "shopify") return true;
  const tracking = tenant.tracking || {};
  return [tracking, ...Object.values(tracking.containerConfigs || {})].some((entry) =>
    String(entry?.platform || "").toLowerCase() === "shopify"
    || Boolean(entry?.shopify?.shop || entry?.shopify?.connectCodeHash)
  );
}
