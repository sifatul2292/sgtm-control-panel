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

## Safety

This version is deliberately read-only. It only reads Docker status/logs, Nginx logs, and certificate metadata.
