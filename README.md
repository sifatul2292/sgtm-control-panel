# SGTM Control Panel

Read-only dashboard for an SGTM server. The first version intentionally avoids restart, create, delete, or shell-action controls.

Tagioo landing page and new-server setup notes are included. For the `tagioo.com` VPS, follow [docs/tagioo-vps-setup.md](docs/tagioo-vps-setup.md).

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
- SQLite event store with 30-day raw event retention that survives log rotation and container restarts, with multi-VPS worker ingest ([docs/event-store.md](docs/event-store.md))
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

### WooCommerce / WordPress (no plugin)

WooCommerce stores can use the native webhook system instead of custom code. In the WordPress admin:

1. Go to WooCommerce → Settings → Advanced → Webhooks → Add webhook.
2. Topic: `Order created`. API Version: `WP REST API Integration v3`.
3. Delivery URL: `https://sgtm.example.com/api/orders/woocommerce` (append `?tenant=<tenant-id>` for multi-tenant panels).
4. Secret: the panel's `ORDER_WEBHOOK_SECRET`.

The panel verifies the `x-wc-webhook-signature` HMAC header against the raw body and maps `id` → `order_id`, `total`, `currency`, and `date_created_gmt` → `created_at` automatically. The activation ping WooCommerce sends when the webhook is saved is acknowledged with `200`.

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

## Owner and Customer Login

The owner/admin login uses:

```bash
AUTH_USERNAME=admin
AUTH_PASSWORD=change-this-owner-password
```

Create customer logins from Admin. Customer account records are stored in `data/history.json` with salted password hashes, and each login maps to a tenant ID.

Owner users can see Admin, Provisioning, Deployment, and Settings. Customer users see the customer dashboard views only and are scoped to their tenant.

## Automatic Container Launch

Customer-created containers automatically create an owner provisioning record. To let the panel also launch Docker and Nginx automatically on the VPS, enable:

```bash
AUTO_LAUNCH_ENABLED=true
AUTO_LAUNCH_REQUIRE_DNS=true
AUTO_LAUNCH_CERTBOT=true
AUTO_LAUNCH_CERTBOT_EMAIL=admin@example.com
AUTO_LAUNCH_USE_SUDO=true
NGINX_SITES_AVAILABLE_DIR=/etc/nginx/sites-available
NGINX_SITES_ENABLED_DIR=/etc/nginx/sites-enabled
LOCAL_WORKER_ID=bdix-worker-1
LOCAL_WORKER_NAME="BDIX Worker 1"
LOCAL_WORKER_REGION="Bangladesh BDIX"
LOCAL_WORKER_MAX_CONTAINERS=200
LOCAL_WORKER_CPU_CORES=16
LOCAL_WORKER_MEMORY_GB=32
```

The server user must have permission to run Docker, copy Nginx site files, reload Nginx, and run certbot. If `AUTO_LAUNCH_ENABLED` is not true, containers are queued with generated Docker/Nginx files for owner approval.

Generated Nginx configs use the default Nginx access log format. Only set `NGINX_LOG_FORMAT=sgtm_panel` if you have already defined `log_format sgtm_panel ...;` in Nginx; otherwise `nginx -t` will fail.

The launcher supports either Docker Compose v2 (`docker compose`) or classic Compose (`docker-compose`). At least one must be installed and available to the app user, with sudo access if `AUTO_LAUNCH_USE_SUDO=true`.

If classic `docker-compose` hits the known `ContainerConfig` recreate error, the launcher removes the stale named container and retries once automatically.

If a container was created before auto-launch was enabled, it can stay in `pending_launch`. After updating `.env` and restarting the app, open the owner Provisioning view and click **Launch Now** on that request.

Customer containers require a tracking subdomain, such as `server.customer.com`, to point to the SGTM VPS before auto-launch can finish. Set `PROVISION_DNS_TARGET` to the value customers should use in DNS, such as the VPS IP address or a host like `sgtm.example.com`.

When a customer deletes a container, the panel marks the customer container as deleted. If auto-launch is enabled, it also runs Docker compose down, removes the generated Nginx site, reloads Nginx, removes generated files, and preserves historical request/order data.

## Scaling Note

One VPS is suitable for early customers and controlled traffic, but not thousands of customers. The Admin screen now supports worker-node records so new containers can be assigned to the least-loaded healthy worker. The default worker represents the current VPS; add remote workers from Admin as the fleet grows.

For larger scale, run multiple VPS nodes or a cluster, distribute customers by region/plan, store tenant/account data in a managed database, centralize logs/metrics, and put a provisioning scheduler in front of the worker servers. Remote workers are assigned in the control panel in this version; local Docker/Nginx auto-launch still runs only on the local worker.

Container provisioning records include worker assignment plus resource limits. Default plan profiles are:

- Starter: 512MB RAM, 0.50 CPU, 100k requests/month, 1 container
- Growth: 768MB RAM, 0.75 CPU, 500k requests/month, 2 containers
- Pro: 1024MB RAM, 1.00 CPU, 1M requests/month, 4 containers
- Agency: 1536MB RAM, 1.50 CPU, 3M requests/month, 10 containers

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
