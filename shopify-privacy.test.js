import test from "node:test";
import assert from "node:assert/strict";
import { removeShopifyOrders, shopifyCustomerOrders } from "./shopify-privacy.js";

const orders = [
  { id: "gid://shopify/Order/299938", tenantId: "a", containerId: "", source: "tagioo-shopify-app", email: "buyer@example.com", raw: { customer_id: "191167" } },
  { id: "gid://shopify/Order/2", tenantId: "a", containerId: "second", source: "tagioo-shopify-app", email: "buyer@example.com", raw: { customer_id: "191167" } },
  { id: "gid://shopify/Order/3", tenantId: "b", containerId: "", source: "tagioo-shopify-app", email: "buyer@example.com", raw: { customer_id: "191167" } },
  { id: "299938", tenantId: "a", containerId: "", source: "woocommerce", email: "buyer@example.com" },
];

test("finds only the requested customer's orders inside one Shopify connection", () => {
  assert.deepEqual(
    shopifyCustomerOrders(orders, { tenantId: "a", customer: { id: 191167 }, orderIds: [299938] }),
    [orders[0]],
  );
});

test("shop redaction leaves other containers, tenants, and integrations intact", () => {
  assert.deepEqual(
    removeShopifyOrders(orders, { tenantId: "a", containerId: "", allForShop: true }),
    orders.slice(1),
  );
});
