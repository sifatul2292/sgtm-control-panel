# SGTM Control Panel

Read-only dashboard for an SGTM server. The first version intentionally avoids restart, create, delete, or shell-action controls.

## Features

- Docker container list
- Docker running/stopped/unhealthy summary
- Request count and event mix for today from the Nginx access log
- Readable SGTM event log table for the latest matching tracking requests
- Purchase inspector for recent purchase event metadata
- Hourly trend chart for clean SGTM events, errors, and purchases
- Noise filtering for bot scans and non-tracking traffic
- Deployment health checklist for auth, logs, Docker, SSL, and host visibility
- Local persisted daily/hourly summary history
- Optional store order webhook for accurate Business Snapshot sales/revenue
- Purchase reconciliation between actual store orders and SGTM purchase tracking
- Customer/tenant overview for running the panel as a managed service
- Usage and billing guardrails with monthly request limits
- Setup wizard for DNS, SSL, GTM traffic, and order webhook onboarding
- Integration guidance for custom stores, Shopify, WooCommerce, Meta CAPI, and GA4
- Public landing/docs view for customer setup instructions
- SGTM container provisioning requests with auto-assigned internal ports and launch plans
- Recent Nginx error logs
- Recent Docker logs from one available container
- SSL expiry from either a certificate file or a public domain

## Local Run

```bash
npm start
```

Open `http://127.0.0.1:3000`.

## VPS Run

```bash
cd /var/www
git clone https://github.com/sifatul2292/sgtm-control-panel.git
cd sgtm-control-panel
cp .env.example .env
npm start
```

Set the values in `.env` for your server. Useful options:

```bash
PORT=3000
HOST=127.0.0.1
NGINX_ACCESS_LOG=/var/log/nginx/access.log
NGINX_ERROR_LOG=/var/log/nginx/error.log
SSL_CERT_PATH=/etc/letsencrypt/live/example.com/fullchain.pem
```

The process needs read permission for the Nginx logs and access to the Docker socket if you want live Docker data.

## Store Orders

SGTM access logs can only show tracking requests that are visible in Nginx logs. For accurate sales, send real orders to the panel:

```bash
ORDER_WEBHOOK_SECRET=change-this-order-webhook-secret
```

Then POST each order:

```bash
curl -X POST https://sgtm.example.com/api/orders/webhook \
  -H "content-type: application/json" \
  -H "x-order-webhook-secret: change-this-order-webhook-secret" \
  -d '{"order_id":"ORD-123","total":1496,"currency":"BDT","created_at":"2026-06-01T14:00:00+06:00"}'
```

The Business Snapshot uses webhook orders first, then falls back to SGTM purchase-log estimates.

## Productization Settings

To operate this as a customer-facing service, set tenant and billing metadata:

```bash
SERVICE_NAME=SGTM Panel
PUBLIC_BASE_URL=https://sgtm.example.com
TENANT_ID=customer-slug
TENANT_NAME="Customer Name"
TENANT_DOMAIN=server.customer.com
BILLING_PLAN=Starter
MONTHLY_REQUEST_LIMIT=100000
MONTHLY_CONTAINER_LIMIT=1
CUSTOMER_SUPPORT_EMAIL=support@example.com
```

The panel separates:

- Actual store orders from `/api/orders/webhook`
- Deduped tracked purchase events from SGTM access logs
- Raw purchase hits from Meta/GA4/Data Client copies

This is intentional. Customers should trust actual store orders for sales and use tracking coverage to diagnose missing purchase tracking.

## Customer Launch Checklist

1. Create a tenant/provisioning request in the Provisioning screen.
2. Point the customer tracking subdomain to the VPS.
3. Prepare Docker Compose and Nginx files from the generated plan.
4. Run `nginx -t`, reload Nginx, and issue SSL.
5. Install the web GTM container globally on the customer site.
6. Verify Tag Assistant sees the web container.
7. Send store orders to `/api/orders/webhook`.
8. Confirm purchase reconciliation shows actual orders and tracked purchases clearly.

## Safety

This version is deliberately read-only. It only reads Docker status/logs, Nginx logs, and certificate metadata.
