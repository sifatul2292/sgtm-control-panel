import { createHmac, timingSafeEqual } from "node:crypto";
import { scopedTrackingEntries } from "./container-scope.js";
import { normalizeShopDomain } from "./shopify-billing.js";

// The Tagioo Shopify app and the panel share TAGIOO_SHOPIFY_APP_SECRET. The app
// signs server calls and one-click dashboard links with it; shorter values are
// treated as unset so a placeholder never authenticates anything.
export const SHOPIFY_APP_SECRET_MIN_LENGTH = 32;
export const SHOPIFY_LOGIN_TOKEN_TTL_MS = 10 * 60 * 1000;
// Account links (Create account / Sign in) are rendered with the page and may
// be clicked a while later, so they live longer than one-click sign-in links.
export const SHOPIFY_START_TOKEN_TTL_MS = 60 * 60 * 1000;

export function usableShopifyAppSecret(value) {
  const secret = String(value || "");
  return secret.length >= SHOPIFY_APP_SECRET_MIN_LENGTH ? secret : "";
}

function hmac(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signShopifyAppToken(claims, secret) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${hmac(payload, secret)}`;
}

// Returns the claims of a valid, unexpired token, otherwise null. `purpose`
// keeps an account link from working as a sign-in link and the reverse.
// Single use is the caller's job (it remembers each nonce until `exp`).
export function verifyShopifyAppToken(token, secret, now = Date.now(), { purpose = "", maxTtlMs = SHOPIFY_LOGIN_TOKEN_TTL_MS } = {}) {
  if (!secret) return null;
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(hmac(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const shop = normalizeShopDomain(claims?.shop);
  const exp = Number(claims?.exp);
  if (!shop || !Number.isFinite(exp) || exp < now || exp > now + maxTtlMs) return null;
  if (String(claims.purpose || "") !== purpose) return null;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(claims.nonce || ""))) return null;
  return { shop, exp, nonce: String(claims.nonce), tenantId: String(claims.tenantId || "") };
}

export function tenantShopifyShops(tenant, requests = []) {
  const shops = new Set([tenant?.shopifyShop, ...(tenant?.shopifyShops || [])].map(normalizeShopDomain).filter(Boolean));
  for (const entry of scopedTrackingEntries(tenant, requests)) {
    const shop = normalizeShopDomain(entry.tracking?.shopify?.shop);
    if (shop) shops.add(shop);
  }
  return [...shops];
}

// Stores whose link to this workspace was proven: the app created the
// workspace, the merchant followed a link the app signed, or the store was
// connected with a one-time code. tenantShopifyShops also holds stores named
// by a bare ?shop= link, which anyone can type; those only route billing and
// must never let a store reach this workspace's containers.
export function verifiedShopifyShops(tenant, requests = []) {
  const shops = new Set((tenant?.shopifyAppShops || []).map(normalizeShopDomain).filter(Boolean));
  if (tenant?.source === "shopify_app" && normalizeShopDomain(tenant.shopifyShop)) shops.add(normalizeShopDomain(tenant.shopifyShop));
  for (const entry of scopedTrackingEntries(tenant, requests)) {
    const shop = normalizeShopDomain(entry.tracking?.shopify?.shop);
    if (shop) shops.add(shop);
  }
  return [...shops];
}

// The workspace a Shopify store belongs to. A workspace may hold several
// stores; one already connected through the app wins over a linked one.
export function findShopifyWorkspace(data, shop, tenantHint = "") {
  const wanted = normalizeShopDomain(shop);
  if (!wanted) return null;
  const requests = data?.customerSetupRequests || [];
  const matches = (data?.tenants || []).filter((tenant) => verifiedShopifyShops(tenant, requests).includes(wanted));
  const connected = (tenant) => scopedTrackingEntries(tenant, requests)
    .some((entry) => normalizeShopDomain(entry.tracking?.shopify?.shop) === wanted);
  return matches.find((tenant) => tenantHint && tenant.id === tenantHint)
    || matches.find(connected)
    || matches[0]
    || null;
}
