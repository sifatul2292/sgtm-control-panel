function text(value) {
  return String(value ?? "").trim().toLowerCase();
}

function shopifyNumericId(value) {
  const match = String(value ?? "").match(/(?:^|\/)(\d+)$/);
  return match ? match[1] : "";
}

function isShopifyOrderForConnection(order, tenantId, containerId) {
  return order?.source === "tagioo-shopify-app"
    && order.tenantId === tenantId
    && String(order.containerId || "") === String(containerId || "");
}

export function shopifyCustomerOrders(orders, { tenantId, containerId = "", customer = {}, orderIds = [] }) {
  const requestedIds = new Set(orderIds.map(shopifyNumericId).filter(Boolean));
  const customerId = shopifyNumericId(customer.id);
  const email = text(customer.email);
  const phone = text(customer.phone);

  return (orders || []).filter((order) => {
    if (!isShopifyOrderForConnection(order, tenantId, containerId)) return false;
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
      options.containerId
    ));
  }
  const matches = new Set(shopifyCustomerOrders(orders, options));
  return (orders || []).filter((order) => !matches.has(order));
}
