import { readdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { parseProtectedJson, serializeProtectedJson } from "./data-protection.js";
import { unpackEventHistory, archiveEventHistory } from "./history-archive.js";
import { privacyTokenHash, removeShopifyOrders } from "./shopify-privacy.js";

// Raw event snapshots contain IPs and URLs. Backups retain aggregate billing state
// but omit Shopify event detail so rotation cannot extend its 30-day lifetime.
export async function privacySafeBackupData(data) {
  const tenantIds = new Set([
    ...(data.shopifyPrivacyRoutes || []).map(route => route.tenantId),
    ...(data.shopifyPrivacyRedactions || []).map(route => route.tenantId),
    ...(data.tenants || []).filter(tenant => [tenant.tracking, ...Object.values(tenant.tracking?.containerConfigs || {})]
      .some(tracking => tracking?.shopify?.shop)).map(tenant => tenant.id)
  ]);
  if (!tenantIds.size) return data;
  const safe = unpackEventHistory(data);
  safe.orders = (data.orders || []).filter(order => order.source !== "tagioo-shopify-app"
    || !(data.shopifyPrivacyRedactions || []).some(route => route.tenantId === order.tenantId
      && route.shopHash === privacyTokenHash(String(order.raw?.shop_domain || "").toLowerCase())));
  safe.tenantEventHistory = { ...safe.tenantEventHistory };
  for (const id of tenantIds) delete safe.tenantEventHistory[id];
  return archiveEventHistory(safe);
}

// A failed scrub must fail the webhook so Shopify retries instead of acknowledging
// deletion while a restorable copy of the customer's orders still exists.
export async function redactShopifyBackups(directory, key, options) {
  const names = await readdir(directory).catch(error => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const name of names.filter(name => /^backup-[0-9]{8}T[0-9]{6}-[a-f0-9]{6}\.json$/.test(name))) {
    const path = join(directory, name);
    const snapshot = parseProtectedJson(await readFile(path), key);
    if (!snapshot.data) throw new Error("Invalid privacy backup snapshot.");
    const orders = snapshot.data.orders || [];
    snapshot.data.orders = removeShopifyOrders(orders, options);
    const safe = unpackEventHistory(snapshot.data);
    const hadHistory = Boolean(safe.tenantEventHistory?.[options.tenantId]);
    if (hadHistory) {
      delete safe.tenantEventHistory[options.tenantId];
      snapshot.data = await archiveEventHistory(safe);
    }
    if (snapshot.data.orders.length === orders.length && !hadHistory) continue;
    const temp = `${path}.${randomBytes(8).toString("hex")}.tmp`;
    await writeFile(temp, serializeProtectedJson(snapshot, key), { mode: 0o600 });
    await rename(temp, path);
  }
}
