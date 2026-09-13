export const SHOPIFY_BILLING_PLANS = new Set(["Free", "Starter", "Pro", "Enterprise"]);

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
