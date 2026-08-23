# cPanel Laravel Bridge — Safe Rollout Runbook

The cPanel Bridge is additive and disabled by default. It does not replace or
modify WooCommerce tracking, Web GTM templates, Server GTM templates, Nginx,
container lifecycle, or existing `/g/collect` traffic.

## Production switch

Keep this value on the production panel until the pilot is signed off:

```dotenv
CPANEL_BRIDGE_ENABLED=false
CPANEL_BRIDGE_TENANTS=
```

For a pilot, set `CPANEL_BRIDGE_ENABLED=true` and put only the throwaway tenant
ID in `CPANEL_BRIDGE_TENANTS`. Both gates must pass. Do not use `*` until general
availability is approved. This reveals the self-service wizard and private
tenant-scoped download only to that customer. It does not install anything or
start background work on the Tagioo VPS.

## Self-service protocol

1. The authenticated customer starts setup with their HTTPS store URL. Tagioo
   creates a Laravel-only HMAC secret and private ZIP.
2. The cPanel Cron boots Laravel and sends a signed heartbeat containing schema
   metadata only: PHP/Laravel/database driver, table names, column names, and a
   bounded set of order status values. It never sends order rows during
   detection.
3. Tagioo returns the active flag and any customer-approved column mapping.
4. Auto-detection must report Ready, or the customer must select a mapping from
   the detected dropdown values, before activation is accepted.
5. The first active run checkpoints current orders. Later runs select only new
   or changed paid orders and submit them to `/api/orders/laravel`.
6. The customer places one test order and verifies it from the dashboard.

Heartbeat persistence is throttled when the report is unchanged, so a
once-per-minute Cron does not create a once-per-minute `history.json` write.
Pausing in the panel rejects new cPanel Bridge purchases immediately; the next
heartbeat also updates the local active state.

## Required pilot sequence

1. Use a throwaway Tagioo tenant and a staging copy of a Laravel store.
2. Enable `CPANEL_BRIDGE_ENABLED=true` and allowlist only that tenant ID in
   `CPANEL_BRIDGE_TENANTS`.
3. Start the self-service wizard and download the tenant-scoped ZIP.
4. Confirm `config.php` is outside `public_html` and permissioned to the cPanel
   account only (0600 where the host supports it).
5. Run `php bridge.php doctor`. It must report the correct Laravel root, orders
   table, ID, total, checkpoint, and optional item table. Doctor sends nothing.
6. Run `php bridge.php run` once. Confirm the dashboard receives the schema
   heartbeat but no orders, and activation is still off.
7. Activate in the customer dashboard and run the bridge again. It must
   initialize and skip every old order.
8. Create a paid test order and run the bridge again.
9. Confirm exactly one order in Tagioo, GA4 Debug/Realtime, and Meta Test Events.
10. Run it again and confirm no duplicate Purchase.
11. Simulate a failed endpoint, restore it, and confirm the local outbox retries
    successfully without affecting checkout.
12. Test a pending/COD order changing to a paid status; `updated_at` must be the
    detected checkpoint column.
13. Pause from the panel and confirm the purchase endpoint returns 409 before
    the bridge receives another heartbeat.

Do not enable the production customer download until all steps pass.

## Safety properties

- CLI-only; a web request to `bridge.php` returns 404.
- Laravel is booted read-only and all store queries use Laravel's query builder
  with `SELECT`; there are no migrations or writes to store tables.
- Non-blocking file lock prevents overlapping Cron runs.
- First run checkpoints current data and sends no historical orders.
- Required order ID, total, and timestamp columns must be unambiguous; otherwise
  the bridge remains inactive until the customer saves a detected mapping.
- Mapping values are accepted only from the table/column metadata reported by
  that tenant's signed bridge heartbeat.
- Only configured paid statuses are sent.
- Outbox/checkpoint writes use a temporary file plus atomic rename.
- Network failures use exponential retry and never touch checkout.
- Requests use a Laravel-only tenant secret and five-minute HMAC signature.
  WooCommerce secret rotation cannot break this bridge.
- Tagioo's server endpoint remains idempotent by tenant + order ID, covering the
  small retry window between HTTP acceptance and local outbox persistence.

## Emergency stop

Any one of these stops future bridge sends without changing the Laravel store:

1. rename `disabled.flag.example` to `disabled.flag`;
2. remove or disable the cPanel Cron Job;
3. set `enabled` to `false` in the private bridge `config.php`;
4. click **Pause tracking** in the customer dashboard;
5. rotate/remove the tenant's Laravel bridge secret in Tagioo.

Do not change Nginx, sGTM containers, or existing customer GTM templates as part
of this pilot.
