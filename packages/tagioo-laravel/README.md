# Tagioo Laravel Bridge

The Bridge records authoritative Laravel purchase events in a local outbox and
sends them to Tagioo after the HTTP response. Tracking errors are caught and can
never fail checkout or order creation.

## Install during development

Until the package is published to Packagist, add this repository to the store's
root `composer.json`:

```json
{
  "repositories": [
    { "type": "path", "url": "packages/tagioo-laravel" }
  ]
}
```

Then run:

```bash
composer require tagioo/laravel:@dev
php artisan migrate
```

Add the connection values supplied by the Tagioo dashboard to `.env`:

```dotenv
TAGIOO_ENABLED=true
TAGIOO_ENDPOINT=https://tagioo.example/api/orders/laravel
TAGIOO_TENANT=your-tenant-id
TAGIOO_SECRET=replace-with-the-dashboard-secret
```

After the application's order transaction commits, call:

```php
use Tagioo\Laravel\Facades\Tagioo;

Tagioo::purchase($order);
```

For a custom order model, supply explicit mappings:

```php
Tagioo::purchase($order, [
    'order_id' => $order->number,
    'total' => $order->payable,
    'currency' => 'BDT',
    'status' => 'completed',
]);
```

Run `php artisan tagioo:doctor` to verify the installation. The package also
schedules `tagioo:flush` every minute; Laravel's normal scheduler must be active
for automatic retry recovery.

Emergency disable:

```dotenv
TAGIOO_ENABLED=false
```
