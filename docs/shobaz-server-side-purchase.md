# Fix Shobaz: server-side purchase recovery

## Why
Shobaz fires Purchase **browser-only**. Brave Shields / iOS / adblock block the
pixel → those purchases never reach Meta. Lost daily, silent. Fix = shobaz
backend POSTs every paid order to the panel webhook, server-to-server. No
browser = no shield can block it. Panel forwards to sGTM → Meta CAPI, deduped by
order id so caught purchases don't double-count.

## What to add
One backend call, fired when an order reaches **paid** status (after payment
gateway confirms — not on checkout click).

### Endpoint
```
POST https://<PANEL_DOMAIN>/api/orders/webhook
```

### Headers
```
Content-Type: application/json
x-order-webhook-secret: <ORDER_WEBHOOK_SECRET>
```

### Body
```json
{
  "order_id": "1781502175350_178150257385219",
  "tenant_id": "<SHOBAZ_TENANT_ID>",
  "amount": 1299.00,
  "currency": "BDT",
  "created_at": "2026-06-15T11:38:00+06:00",
  "order_type": "online",
  "status": "paid"
}
```

### Node example
```js
async function reportOrderToTagioo(order) {
  try {
    const res = await fetch("https://<PANEL_DOMAIN>/api/orders/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-order-webhook-secret": process.env.TAGIOO_ORDER_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        order_id: String(order.id),      // MUST equal browser pixel transaction_id
        tenant_id: process.env.TAGIOO_TENANT_ID,
        amount: order.total,
        currency: order.currency || "BDT",
        created_at: order.paidAt,         // ISO 8601
        order_type: "online",
        status: "paid",
      }),
    });
    if (res.status !== 202) {
      console.warn("[tagioo] order report failed", res.status, await res.text());
    }
  } catch (err) {
    console.warn("[tagioo] order report error", err.message); // fire-and-forget, never block checkout
  }
}
```

Call it right after the order is marked paid:
```js
order.status = "paid";
await order.save();
reportOrderToTagioo(order); // no await — must not block user response
```

## Non-negotiable rules

**1. `order_id` MUST equal the browser pixel's `transaction_id`/`event_id`.**
Same value both places → Meta dedups, counts once. Different → double count.
Check what shobaz browser Purchase sends as transaction_id, use that exact
string here.

**2. Fire only on PAID.**
Not on checkout-start, not on pending/failed/cancelled. Panel drops unpaid
statuses, but don't rely on it — send only real paid orders.

**3. Fire-and-forget.**
Never `await` in the checkout response path. Network hiccup to panel must not
slow or break the buyer's confirmation.

**4. `tenant_id` must match shobaz's tenant id in the panel.**
Wrong/missing → recovery forwards to wrong sGTM or default → silently skips.
Forward only fires if that tenant has GA4 `measurementId` + `apiSecret` +
tracking `domain` saved.

**5. Idempotent.**
Send once per order. Panel dedups repeat `order_id` (won't re-forward), but
retries/webhooks firing twice are fine — keep order id stable.

## Verify
1. Make test purchase in Brave (shields ON).
2. Browser pixel blocked → no Browser Purchase. Expected.
3. Within seconds, Meta Test Events shows **Server** Purchase, source Manual
   setup, event id = your order_id.
4. Panel dashboard order count increments.
   → Brave purchase recovered = fixed.

## Config needed
- `TAGIOO_ORDER_WEBHOOK_SECRET` = panel `ORDER_WEBHOOK_SECRET` env value.
- `TAGIOO_TENANT_ID` = shobaz tenant id in panel.
- `<PANEL_DOMAIN>` = your panel host.

## Panel-side reference (already built, no change needed)
- Route: `/api/orders/webhook` POST, auth `isOrderWebhookAuthorized` — server.js
- Payload parse: `normalizeOrderPayload` — server.js
- Recovery forward: `addOrderWebhook` → `forwardOrderToSgtm` — server.js
  - Sends GA4 MP `purchase` with `transaction_id: order.id` AND
    `event_id: order.id` → dedups against browser pixel.
  - Fires only if new order id, `amount > 0`, paid status, and tenant has
    `measurementId` + `apiSecret` + `domain`.
