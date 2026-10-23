import { createHmac, timingSafeEqual } from "node:crypto";
import { scopedTrackingEntries } from "./container-scope.js";
import { normalizeShopDomain } from "./shopify-billing.js";

// The Tagioo Shopify app and the panel share TAGIOO_SHOPIFY_APP_SECRET. The app
// signs server calls and one-click dashboard links with it; shorter values are
// treated as unset so a placeholder never authenticates anything.
export const SHOPIFY_APP_SECRET_MIN_LENGTH = 32;
export const SHOPIFY_LOGIN_TOKEN_TTL_MS = 10 * 60 * 1000;

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

// Returns the claims of a valid, unexpired login token, otherwise null.
// Single use is the caller's job (it remembers each nonce until `exp`).
export function verifyShopifyAppToken(token, secret, now = Date.now()) {
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
  if (!shop || !Number.isFinite(exp) || exp < now || exp > now + SHOPIFY_LOGIN_TOKEN_TTL_MS) return null;
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

// The workspace a Shopify store belongs to. A workspace may hold several
// stores; one already connected through the app wins over a linked one.
export function findShopifyWorkspace(data, shop, tenantHint = "") {
  const wanted = normalizeShopDomain(shop);
  if (!wanted) return null;
  const requests = data?.customerSetupRequests || [];
  const matches = (data?.tenants || []).filter((tenant) => tenantShopifyShops(tenant, requests).includes(wanted));
  const connected = (tenant) => scopedTrackingEntries(tenant, requests)
    .some((entry) => normalizeShopDomain(entry.tracking?.shopify?.shop) === wanted);
  return matches.find((tenant) => tenantHint && tenant.id === tenantHint)
    || matches.find(connected)
    || matches[0]
    || null;
}
