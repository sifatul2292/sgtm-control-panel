import { createHash } from "node:crypto";

function text(value) {
  return String(value ?? "").trim().toLowerCase();
}

function shopifyNumericId(value) {
  const match = String(value ?? "").match(/(?:^|\/)(\d+)$/);
  return match ? match[1] : "";
}

function isShopifyOrderForConnection(order, tenantId, containerId, shop = "") {
  return order?.source === "tagioo-shopify-app"
    && order.tenantId === tenantId
    && (shop ? text(order.raw?.shop_domain) === text(shop)
      : String(order.containerId || "") === String(containerId || ""));
}

export function shopifyCustomerOrders(orders, { tenantId, containerId = "", shop = "", customer = {}, orderIds = [] }) {
  const requestedIds = new Set(orderIds.map(shopifyNumericId).filter(Boolean));
  const customerId = shopifyNumericId(customer.id);
  const email = text(customer.email);
  const phone = text(customer.phone);

  return (orders || []).filter((order) => {
    if (!isShopifyOrderForConnection(order, tenantId, containerId, shop)) return false;
    const raw = order.raw || {};
    const orderId = shopifyNumericId(order.id);
    if (requestedIds.size && requestedIds.has(orderId)) return true;
    if (customerId && shopifyNumericId(raw.customer_id) === customerId) return true;
    if (email && text(order.email) === email) return true;
    return Boolean(phone && text(order.phone) === phone);
  });
}

export function removeShopifyOrders(orders, options) {
  if (options.allForShop) {
    return (orders || []).filter((order) => !isShopifyOrderForConnection(
      order,
      options.tenantId,
      options.containerId,
      options.shop
    ));
  }
  const matches = new Set(shopifyCustomerOrders(orders, options));
  return (orders || []).filter((order) => !matches.has(order));
}

// Keep privacy authorization separate from active tracking and billing tokens.
export function retainShopifyPrivacyRoute(data, tenant, containerId, tracking, storedContainerId = containerId) {
  const connection = tracking?.shopify;
  if (!connection?.shop || !connection.integrationToken) return;
  const routes = data.shopifyPrivacyRoutes ||= [];
  if (!routes.some((route) => route.integrationToken === connection.integrationToken)) {
    routes.push({ tenantId: tenant.id, containerId, shop: text(connection.shop), integrationToken: connection.integrationToken });
  }
  for (const order of data.orders || []) {
    if (isShopifyOrderForConnection(order, tenant.id, storedContainerId) && !order.raw?.shop_domain) {
      order.raw = { ...(order.raw || {}), shop_domain: text(connection.shop) };
    }
  }
}

export function privacyTokenHash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}
