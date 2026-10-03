import { createHmac, timingSafeEqual } from "node:crypto";

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyPaddleSignature({ header, rawBody, secret, now = Date.now(), toleranceSeconds = 300 }) {
  if (!secret || !header) return false;
  const values = {};
  for (const segment of String(header).split(";")) {
    const index = segment.indexOf("=");
    if (index === -1) continue;
    const key = segment.slice(0, index).trim();
    const value = segment.slice(index + 1).trim();
    if (!key || !value) continue;
    (values[key] ||= []).push(value);
  }
  const timestamp = Number(values.ts?.[0]);
  const signatures = values.h1 || [];
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "");
  const expected = createHmac("sha256", secret).update(`${timestamp}:${body}`).digest("hex");
  return signatures.some((signature) => constantTimeEqual(signature, expected));
}

export function paddlePlanNameFromItems(items, priceIds) {
  const configured = Object.entries(priceIds || {}).filter(([, id]) => id);
  for (const item of items || []) {
    if (item?.status === "inactive") continue;
    const priceId = String(item?.price?.id || item?.price_id || "");
    const match = configured.find(([, id]) => id === priceId);
    if (match) return match[0];
  }
  return "";
}

export function paddleRenewalDate(value, now = Date.now()) {
  const parsed = Date.parse(String(value || ""));
  if (Number.isFinite(parsed) && parsed > now) return new Date(parsed).toISOString();
  return new Date(now + 30 * 86400000).toISOString();
}

export function paddleCheckoutMatchesTenant(tenant, { subscriptionId, invoiceNo, planName }) {
  const knownSubscription = Boolean(subscriptionId && tenant?.paddleSubscriptionId === subscriptionId);
  if (knownSubscription) return { ok: true, renewal: true };
  if (!tenant?.pendingInvoiceNo || invoiceNo !== tenant.pendingInvoiceNo) {
    return { ok: false, error: "Paddle checkout does not match this customer's pending invoice." };
  }
  if (tenant.pendingPlan !== planName) {
    return { ok: false, error: "Paddle price does not match this customer's pending plan." };
  }
  return { ok: true, renewal: false };
}
