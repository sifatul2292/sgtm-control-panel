<?php

declare(strict_types=1);

/**
 * Tagioo cPanel Bridge
 *
 * Standalone purchase relay for Laravel stores without SSH/Composer access.
 * It boots the existing Laravel application, performs SELECT-only order reads,
 * and sends signed purchase events from a local retry outbox.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

const TAGIOO_BRIDGE_VERSION = 3;

function tagioo_out(string $message): void
{
    fwrite(STDOUT, '[Tagioo] '.$message.PHP_EOL);
}

function tagioo_fail(string $message, int $code = 1): never
{
    fwrite(STDERR, '[Tagioo] ERROR: '.$message.PHP_EOL);
    exit($code);
}

function tagioo_identifier(string $value, string $label): string
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $value)) {
        tagioo_fail($label.' may contain only letters, numbers, and underscores.');
    }
    return $value;
}

function tagioo_config(): array
{
    $path = __DIR__.'/config.php';
    if (!is_file($path)) tagioo_fail('config.php is missing. Download a fresh bridge from Tagioo.');
    $config = require $path;
    if (!is_array($config)) tagioo_fail('config.php did not return an array.');
    foreach (['endpoint', 'tenant', 'secret', 'store_url'] as $key) {
        if (trim((string) ($config[$key] ?? '')) === '') tagioo_fail('Missing config value: '.$key.'.');
    }
    if (!str_starts_with((string) $config['endpoint'], 'https://')) {
        tagioo_fail('The Tagioo endpoint must use HTTPS.');
    }
    $config['heartbeat_endpoint'] = trim((string) ($config['heartbeat_endpoint'] ?? str_replace('/api/orders/laravel', '/api/laravel/bridge/heartbeat', (string) $config['endpoint'])));
    if (!str_starts_with($config['heartbeat_endpoint'], 'https://')) {
        tagioo_fail('The Tagioo heartbeat endpoint must use HTTPS.');
    }
    $config['orders_table'] = tagioo_identifier((string) ($config['orders_table'] ?? 'orders'), 'Orders table');
    $config['batch_size'] = max(1, min(100, (int) ($config['batch_size'] ?? 25)));
    $config['timeout'] = max(2, min(15, (int) ($config['timeout'] ?? 5)));
    $config['paid_statuses'] = array_values(array_filter(array_map(
        static fn ($value) => strtolower(trim((string) $value)),
        (array) ($config['paid_statuses'] ?? ['processing', 'completed', 'paid', 'success', 'confirmed', 'delivered'])
    )));
    return $config;
}

function tagioo_laravel_root(array $config): string
{
    $configured = trim((string) ($config['laravel_root'] ?? ''));
    $parent = dirname(__DIR__);
    $candidates = $configured !== '' ? [$configured] : [
        $parent.'/public_html',
        $parent.'/laravel',
        $parent.'/application',
        $parent,
    ];
    if ($configured === '') {
        foreach ([...(glob($parent.'/*/artisan') ?: []), ...(glob($parent.'/*/*/artisan') ?: [])] as $artisan) {
            $candidates[] = dirname($artisan);
        }
    }
    $valid = [];
    foreach (array_unique($candidates) as $candidate) {
        $real = realpath($candidate);
        if ($real && is_file($real.'/artisan') && is_file($real.'/vendor/autoload.php') && is_file($real.'/bootstrap/app.php')) {
            $valid[] = $real;
        }
    }
    if (count($valid) === 1) return $valid[0];
    if (count($valid) > 1) tagioo_fail('More than one Laravel app was found. Set laravel_root in config.php.');
    tagioo_fail('Laravel was not found. Set laravel_root in config.php to the folder containing artisan.');
}

function tagioo_boot_laravel(string $root): void
{
    require_once $root.'/vendor/autoload.php';
    $app = require $root.'/bootstrap/app.php';
    if (!is_object($app) || !method_exists($app, 'make')) tagioo_fail('Laravel bootstrap did not return an application.');
    $kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
    $kernel->bootstrap();
}

function tagioo_pick_column(array $columns, array $configured, array $defaults, bool $required, string $label): ?string
{
    $choices = array_values(array_filter(array_map('strval', [...$configured, ...$defaults])));
    foreach ($choices as $choice) {
        tagioo_identifier($choice, $label.' column');
        if (in_array($choice, $columns, true)) return $choice;
    }
    if ($required) tagioo_fail('Could not safely detect the '.$label.' column. Contact Tagioo support.');
    return null;
}

function tagioo_detect_column(array $columns, array $configured, array $defaults): ?string
{
    foreach (array_values(array_filter(array_map('strval', [...$configured, ...$defaults]))) as $choice) {
        tagioo_identifier($choice, 'Detected column');
        if (in_array($choice, $columns, true)) return $choice;
    }
    return null;
}

function tagioo_table_names(): array
{
    $connection = \Illuminate\Support\Facades\DB::connection();
    $driver = $connection->getDriverName();
    if ($driver === 'mysql') {
        $rows = \Illuminate\Support\Facades\DB::select("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name LIMIT 200");
    } elseif ($driver === 'pgsql') {
        $rows = \Illuminate\Support\Facades\DB::select("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name LIMIT 200");
    } elseif ($driver === 'sqlite') {
        $rows = \Illuminate\Support\Facades\DB::select("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT 200");
    } else {
        return [];
    }
    return array_values(array_filter(array_map(static fn ($row) => (string) ($row->name ?? ''), $rows), static fn ($name) => preg_match('/^[A-Za-z0-9_]+$/', $name)));
}

function tagioo_discovery_report(array $config): array
{
    $tables = tagioo_table_names();
    $ordersTable = (string) ($config['orders_table'] ?? 'orders');
    if (!in_array($ordersTable, $tables, true)) {
        foreach (['orders', 'sales_orders', 'customer_orders'] as $candidate) {
            if (in_array($candidate, $tables, true)) { $ordersTable = $candidate; break; }
        }
    }
    $columns = in_array($ordersTable, $tables, true)
        ? \Illuminate\Support\Facades\Schema::getColumnListing($ordersTable)
        : [];
    $overrides = (array) ($config['columns'] ?? []);
    $configured = static fn (string $key): array => isset($overrides[$key]) ? [(string) $overrides[$key]] : [];
    $detected = [
        'id' => tagioo_detect_column($columns, $configured('id'), ['order_number', 'order_no', 'invoice_number', 'invoice_no', 'invoice_id', 'invoice', 'order_code', 'order_id', 'id']),
        'primary' => tagioo_detect_column($columns, $configured('primary'), ['id']),
        'total' => tagioo_detect_column($columns, $configured('total'), ['total', 'grand_total', 'total_amount', 'payable_amount', 'amount']),
        'created' => tagioo_detect_column($columns, $configured('created'), ['created_at', 'ordered_at', 'order_date']),
        'updated' => tagioo_detect_column($columns, $configured('updated'), ['updated_at', 'modified_at']),
        'currency' => tagioo_detect_column($columns, $configured('currency'), ['currency', 'currency_code']),
        'status' => tagioo_detect_column($columns, $configured('status'), ['status', 'order_status', 'payment_status']),
        'email' => tagioo_detect_column($columns, $configured('email'), ['email', 'customer_email', 'billing_email']),
        'phone' => tagioo_detect_column($columns, $configured('phone'), ['phone', 'customer_phone', 'billing_phone']),
    ];
    $detected = array_filter($detected);
    $statusValues = [];
    if ($columns && isset($detected['status'])) {
        // Sample by the primary key so this remains a cheap indexed read even
        // when a custom store forgot to index updated_at.
        $cursorColumn = $detected['primary'] ?? $detected['id'];
        $recentStatuses = \Illuminate\Support\Facades\DB::table($ordersTable)
            ->select($detected['status'])->orderByDesc($cursorColumn)->limit(50)->pluck($detected['status'])->all();
        $statusValues = array_values(array_unique(array_filter(array_map(static fn ($value) => strtolower(trim((string) $value)), $recentStatuses), static fn ($value) => $value !== '')));
    }
    $knownPaidStatus = !$statusValues || (bool) array_intersect($statusValues, (array) $config['paid_statuses']);
    $ready = isset($detected['id'], $detected['total'], $detected['created'], $detected['status']) && $knownPaidStatus;
    $confidence = count(array_intersect(['id', 'total', 'created', 'status'], array_keys($detected))) * 25;

    $itemsTable = trim((string) ($config['items_table'] ?? ''));
    if ($itemsTable === '') {
        foreach (['order_items', 'order_details'] as $candidate) {
            if (in_array($candidate, $tables, true)) { $itemsTable = $candidate; break; }
        }
    }
    $itemColumns = $itemsTable && in_array($itemsTable, $tables, true)
        ? \Illuminate\Support\Facades\Schema::getColumnListing($itemsTable)
        : [];
    $itemOverrides = (array) ($config['item_columns'] ?? []);
    $itemConfigured = static fn (string $key): array => isset($itemOverrides[$key]) ? [(string) $itemOverrides[$key]] : [];
    $itemDetected = array_filter([
        'order_id' => tagioo_detect_column($itemColumns, $itemConfigured('order_id'), ['order_id']),
        'item_id' => tagioo_detect_column($itemColumns, $itemConfigured('item_id'), ['product_id', 'variant_id', 'sku']),
        'name' => tagioo_detect_column($itemColumns, $itemConfigured('name'), ['product_name', 'name', 'title']),
        'price' => tagioo_detect_column($itemColumns, $itemConfigured('price'), ['price', 'unit_price', 'amount']),
        'quantity' => tagioo_detect_column($itemColumns, $itemConfigured('quantity'), ['quantity', 'qty']),
    ]);
    $warnings = [];
    if (!$columns) $warnings[] = 'The orders table was not detected.';
    if (!$ready) $warnings[] = 'One or more required order fields need mapping.';
    if ($statusValues && !$knownPaidStatus) $warnings[] = 'Choose which detected order statuses represent a paid purchase.';
    if (!isset($detected['updated'])) $warnings[] = 'updated_at was not detected; later COD status changes may be missed.';
    if (!$itemColumns) $warnings[] = 'Product item rows were not detected; Purchase can still use order ID and value.';
    return [
        'php_version' => PHP_VERSION,
        'laravel_version' => function_exists('app') && method_exists(app(), 'version') ? (string) app()->version() : '',
        'database_driver' => \Illuminate\Support\Facades\DB::connection()->getDriverName(),
        'tables' => $tables,
        'orders' => ['table' => in_array($ordersTable, $tables, true) ? $ordersTable : '', 'columns' => $columns, 'detected' => $detected, 'status_values' => $statusValues, 'ready' => $ready, 'confidence' => $confidence],
        'items' => ['table' => in_array($itemsTable, $tables, true) ? $itemsTable : '', 'columns' => $itemColumns, 'detected' => $itemDetected, 'ready' => isset($itemDetected['order_id']) && (isset($itemDetected['item_id']) || isset($itemDetected['name']))],
        'warnings' => $warnings,
    ];
}

function tagioo_apply_mapping(array $config, array $mapping): array
{
    if (!empty($mapping['orders_table'])) $config['orders_table'] = tagioo_identifier((string) $mapping['orders_table'], 'Orders table');
    if (!empty($mapping['items_table'])) $config['items_table'] = tagioo_identifier((string) $mapping['items_table'], 'Items table');
    if (!empty($mapping['columns']) && is_array($mapping['columns'])) $config['columns'] = $mapping['columns'];
    if (!empty($mapping['item_columns']) && is_array($mapping['item_columns'])) $config['item_columns'] = $mapping['item_columns'];
    if (!empty($mapping['paid_statuses']) && is_array($mapping['paid_statuses'])) $config['paid_statuses'] = $mapping['paid_statuses'];
    return $config;
}

function tagioo_schema(array $config): array
{
    $table = $config['orders_table'];
    if (!\Illuminate\Support\Facades\Schema::hasTable($table)) {
        tagioo_fail('Orders table "'.$table.'" was not found. No data was sent.');
    }
    $columns = \Illuminate\Support\Facades\Schema::getColumnListing($table);
    $overrides = (array) ($config['columns'] ?? []);
    $configured = static fn (string $key): array => isset($overrides[$key]) ? [(string) $overrides[$key]] : [];
    $created = tagioo_pick_column($columns, $configured('created'), ['created_at', 'ordered_at', 'order_date'], true, 'created time');
    $updated = tagioo_pick_column($columns, $configured('updated'), ['updated_at', 'modified_at'], false, 'updated time');
    $status = tagioo_pick_column($columns, $configured('status'), ['status', 'order_status', 'payment_status'], false, 'status');
    if (!$status && ($config['assume_new_orders_paid'] ?? false) !== true) {
        tagioo_fail('Could not safely detect an order status column. No data was sent; open Advanced mapping in Tagioo and select the status field.');
    }
    $orderId = tagioo_pick_column($columns, $configured('id'), ['order_number', 'order_no', 'invoice_number', 'invoice_no', 'invoice_id', 'invoice', 'order_code', 'order_id', 'id'], true, 'order ID');
    $primary = tagioo_pick_column($columns, $configured('primary'), ['id'], false, 'order primary key') ?: $orderId;
    $schema = [
        'id' => $orderId,
        'primary' => $primary,
        'total' => tagioo_pick_column($columns, $configured('total'), ['total', 'grand_total', 'total_amount', 'payable_amount', 'amount'], true, 'order total'),
        'created' => $created,
        // updated_at lets pending/COD orders be seen again after they become
        // paid. Older schemas fall back to created_at and doctor reports it.
        'cursor' => $updated ?: $created,
        'currency' => tagioo_pick_column($columns, $configured('currency'), ['currency', 'currency_code'], false, 'currency'),
        'status' => $status,
        'email' => tagioo_pick_column($columns, $configured('email'), ['email', 'customer_email', 'billing_email'], false, 'email'),
        'phone' => tagioo_pick_column($columns, $configured('phone'), ['phone', 'customer_phone', 'billing_phone'], false, 'phone'),
        'first_name' => tagioo_pick_column($columns, $configured('first_name'), ['first_name', 'customer_first_name', 'billing_first_name'], false, 'first name'),
        'last_name' => tagioo_pick_column($columns, $configured('last_name'), ['last_name', 'customer_last_name', 'billing_last_name'], false, 'last name'),
        'city' => tagioo_pick_column($columns, $configured('city'), ['city', 'billing_city'], false, 'city'),
        'state' => tagioo_pick_column($columns, $configured('state'), ['state', 'region', 'billing_state'], false, 'state'),
        'postcode' => tagioo_pick_column($columns, $configured('postcode'), ['postcode', 'postal_code', 'billing_postcode'], false, 'postcode'),
        'country' => tagioo_pick_column($columns, $configured('country'), ['country', 'billing_country'], false, 'country'),
        'ip' => tagioo_pick_column($columns, $configured('ip'), ['customer_ip_address', 'customer_ip', 'ip_address'], false, 'customer IP'),
        'user_agent' => tagioo_pick_column($columns, $configured('user_agent'), ['customer_user_agent', 'user_agent'], false, 'user agent'),
    ];
    $schema['items'] = tagioo_items_schema($config);
    return $schema;
}

function tagioo_items_schema(array $config): ?array
{
    $configuredTable = trim((string) ($config['items_table'] ?? ''));
    $candidates = $configuredTable !== '' ? [$configuredTable] : ['order_items', 'order_details'];
    foreach ($candidates as $candidate) {
        $table = tagioo_identifier($candidate, 'Items table');
        if (!\Illuminate\Support\Facades\Schema::hasTable($table)) continue;
        $columns = \Illuminate\Support\Facades\Schema::getColumnListing($table);
        $overrides = (array) ($config['item_columns'] ?? []);
        $configured = static fn (string $key): array => isset($overrides[$key]) ? [(string) $overrides[$key]] : [];
        $orderId = tagioo_pick_column($columns, $configured('order_id'), ['order_id'], false, 'item order ID');
        $itemId = tagioo_pick_column($columns, $configured('item_id'), ['product_id', 'variant_id', 'sku'], false, 'item ID');
        $name = tagioo_pick_column($columns, $configured('name'), ['product_name', 'name', 'title'], false, 'item name');
        if (!$orderId || (!$itemId && !$name)) {
            if ($configuredTable !== '') tagioo_fail('The configured items table is missing safe order/product columns.');
            continue;
        }
        return [
            'table' => $table,
            'order_id' => $orderId,
            'item_id' => $itemId,
            'name' => $name,
            'price' => tagioo_pick_column($columns, $configured('price'), ['price', 'unit_price', 'amount'], false, 'item price'),
            'quantity' => tagioo_pick_column($columns, $configured('quantity'), ['quantity', 'qty'], false, 'item quantity'),
        ];
    }
    return null;
}

function tagioo_runtime_path(): string
{
    $directory = __DIR__.'/storage';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        tagioo_fail('Could not create the private storage folder.');
    }
    if (!is_writable($directory)) tagioo_fail('The bridge storage folder is not writable.');
    return $directory.'/runtime.json';
}

function tagioo_initial_state(): array
{
    return ['version' => TAGIOO_BRIDGE_VERSION, 'initialized' => false, 'remote_active' => false, 'mapping' => [], 'last' => null, 'pending' => []];
}

function tagioo_read_state(string $path): array
{
    if (!is_file($path)) return tagioo_initial_state();
    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded) || (int) ($decoded['version'] ?? 0) !== TAGIOO_BRIDGE_VERSION) {
        tagioo_fail('Bridge state is unreadable or from an unsupported version. No data was sent.');
    }
    $decoded['pending'] = is_array($decoded['pending'] ?? null) ? $decoded['pending'] : [];
    return $decoded;
}

function tagioo_write_state(string $path, array $state): void
{
    $json = json_encode($state, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
    $temporary = $path.'.tmp.'.bin2hex(random_bytes(4));
    if (file_put_contents($temporary, $json, LOCK_EX) === false || !rename($temporary, $path)) {
        @unlink($temporary);
        tagioo_fail('Could not save the bridge outbox. No checkpoint was advanced.');
    }
    @chmod($path, 0600);
}

function tagioo_value(object $row, ?string $column): mixed
{
    return $column ? ($row->{$column} ?? null) : null;
}

function tagioo_cursor(object $row, array $schema): array
{
    return ['position' => (string) tagioo_value($row, $schema['cursor']), 'id' => (string) tagioo_value($row, $schema['primary'])];
}

function tagioo_order_items(object $row, array $schema): array
{
    $itemsSchema = $schema['items'];
    if (!$itemsSchema) return [];
    $rows = \Illuminate\Support\Facades\DB::table($itemsSchema['table'])
        ->where($itemsSchema['order_id'], '=', tagioo_value($row, $schema['primary']))
        ->limit(100)->get();
    $items = [];
    foreach ($rows as $item) {
        $id = trim((string) tagioo_value($item, $itemsSchema['item_id']));
        $name = trim((string) tagioo_value($item, $itemsSchema['name']));
        if ($id === '' && $name === '') continue;
        $normalized = ['item_id' => $id, 'item_name' => $name];
        $price = (float) preg_replace('/[^0-9.\-]/', '', (string) tagioo_value($item, $itemsSchema['price']));
        $quantity = (int) tagioo_value($item, $itemsSchema['quantity']);
        if ($price > 0) $normalized['price'] = $price;
        $normalized['quantity'] = max(1, $quantity);
        $items[] = $normalized;
    }
    return $items;
}

function tagioo_order_payload(object $row, array $schema, array $config): ?array
{
    $id = trim((string) tagioo_value($row, $schema['id']));
    $total = (float) preg_replace('/[^0-9.\-]/', '', (string) tagioo_value($row, $schema['total']));
    $status = strtolower(trim((string) tagioo_value($row, $schema['status'])));
    if ($id === '' || !is_finite($total) || $total <= 0) return null;
    if ($schema['status'] && !in_array($status, $config['paid_statuses'], true)) return null;
    $payload = [
        'event_name' => 'purchase',
        'event_id' => $id,
        'order_id' => $id,
        'tenant_id' => (string) $config['tenant'],
        'total' => $total,
        'currency' => strtoupper(trim((string) (tagioo_value($row, $schema['currency']) ?: ($config['currency'] ?? 'BDT')))),
        'created_at' => (string) tagioo_value($row, $schema['created']),
        'status' => $status ?: 'paid',
        'source' => 'tagioo-cpanel-bridge',
        'page_location' => rtrim((string) $config['store_url'], '/'),
    ];
    if (!empty($config['container_id'])) $payload['container_id'] = (string) $config['container_id'];
    foreach (['email', 'phone', 'first_name', 'last_name', 'city', 'state', 'postcode', 'country'] as $field) {
        $value = trim((string) tagioo_value($row, $schema[$field]));
        if ($value !== '') $payload[$field] = $value;
    }
    $ip = trim((string) tagioo_value($row, $schema['ip']));
    $agent = trim((string) tagioo_value($row, $schema['user_agent']));
    if ($ip !== '') $payload['customer_ip'] = $ip;
    if ($agent !== '') $payload['customer_user_agent'] = $agent;
    $items = tagioo_order_items($row, $schema);
    if ($items) $payload['items'] = $items;
    return $payload;
}

function tagioo_latest_order(array $config, array $schema): ?object
{
    return \Illuminate\Support\Facades\DB::table($config['orders_table'])
        ->orderByDesc($schema['cursor'])->orderByDesc($schema['primary'])->first();
}

function tagioo_new_orders(array $config, array $schema, ?array $last): array
{
    $query = \Illuminate\Support\Facades\DB::table($config['orders_table']);
    if ($last) {
        $query->where(function ($cursor) use ($schema, $last) {
            $cursor->where($schema['cursor'], '>', $last['position'])
                ->orWhere(function ($sameTime) use ($schema, $last) {
                    $sameTime->where($schema['cursor'], '=', $last['position'])
                        ->where($schema['primary'], '>', $last['id']);
                });
        });
    }
    return $query->orderBy($schema['cursor'])->orderBy($schema['primary'])->limit($config['batch_size'])->get()->all();
}

function tagioo_signed_post(array $config, string $url, array $payload): array
{
    $body = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $timestamp = (string) time();
    $signature = hash_hmac('sha256', $timestamp.'.'.$body, (string) $config['secret']);
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => $config['timeout'],
        CURLOPT_TIMEOUT => $config['timeout'],
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-Tagioo-Timestamp: '.$timestamp,
            'X-Tagioo-Signature: '.$signature,
            'User-Agent: Tagioo-cPanel-Bridge/'.TAGIOO_BRIDGE_VERSION,
        ],
    ]);
    $response = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $error = curl_error($handle);
    curl_close($handle);
    $decoded = is_string($response) ? json_decode($response, true) : null;
    return ['ok' => $response !== false && $status >= 200 && $status < 300, 'status' => $status, 'error' => $error, 'json' => is_array($decoded) ? $decoded : []];
}

function tagioo_send(array $config, array $payload): array
{
    return tagioo_signed_post($config, (string) $config['endpoint'], $payload);
}

function tagioo_heartbeat(array $config, array $report, array $state): array
{
    $payload = [
        'event_name' => 'bridge_heartbeat',
        'tenant_id' => (string) $config['tenant'],
        'bridge_version' => (string) TAGIOO_BRIDGE_VERSION,
        'report' => $report,
        'runtime' => [
            'initialized' => (bool) ($state['initialized'] ?? false),
            'pending_count' => count((array) ($state['pending'] ?? [])),
        ],
    ];
    if (!empty($config['container_id'])) $payload['container_id'] = (string) $config['container_id'];
    return tagioo_signed_post($config, (string) $config['heartbeat_endpoint'], $payload);
}

function tagioo_doctor(array $config): void
{
    if (!extension_loaded('curl')) tagioo_fail('PHP cURL is not enabled. Ask the hosting company to enable it.');
    $root = tagioo_laravel_root($config);
    tagioo_boot_laravel($root);
    $report = tagioo_discovery_report($config);
    if (!$report['orders']['ready']) tagioo_fail('Required order fields were not detected. Install the Cron Job, then complete mapping in Tagioo.');
    $schema = tagioo_schema($config);
    tagioo_runtime_path();
    tagioo_out('Checks passed. Laravel: '.$root);
    tagioo_out('Orders table: '.$config['orders_table'].'; order ID: '.$schema['id'].'; total: '.$schema['total'].'; checkpoint: '.$schema['cursor'].'.');
    if ($schema['cursor'] === $schema['created']) tagioo_out('Warning: updated_at was not found; later COD/payment status changes may require support mapping.');
    tagioo_out($schema['items'] ? 'Product items detected in '.$schema['items']['table'].'.' : 'Product items were not auto-detected; purchase value and order ID are still available.');
    tagioo_out('No order data was sent by doctor.');
}

function tagioo_run(array $config): void
{
    if (($config['enabled'] ?? true) !== true || is_file(__DIR__.'/disabled.flag')) {
        tagioo_out('Bridge is disabled.');
        return;
    }
    if (!extension_loaded('curl')) tagioo_fail('PHP cURL is not enabled.');
    $lock = fopen(__DIR__.'/.bridge.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        tagioo_out('Another bridge run is still active; exiting safely.');
        return;
    }
    $root = tagioo_laravel_root($config);
    tagioo_boot_laravel($root);
    $statePath = tagioo_runtime_path();
    $state = tagioo_read_state($statePath);
    $config = tagioo_apply_mapping($config, (array) ($state['mapping'] ?? []));

    // Control plane first: report metadata only and obtain activation/mapping.
    // If Tagioo is temporarily unreachable, an already-active bridge keeps its
    // local state and queues orders; a never-activated bridge remains stopped.
    $report = tagioo_discovery_report($config);
    $heartbeat = tagioo_heartbeat($config, $report, $state);
    if ($heartbeat['ok']) {
        $remote = $heartbeat['json'];
        $state['remote_active'] = ($remote['active'] ?? false) === true;
        $state['mapping'] = is_array($remote['mapping'] ?? null) ? $remote['mapping'] : [];
        $config = tagioo_apply_mapping($config, $state['mapping']);
        $mappedReport = tagioo_discovery_report($config);
        if (json_encode($mappedReport) !== json_encode($report)) {
            $report = $mappedReport;
            $secondHeartbeat = tagioo_heartbeat($config, $report, $state);
            if ($secondHeartbeat['ok']) {
                $remote = $secondHeartbeat['json'];
                $state['remote_active'] = ($remote['active'] ?? false) === true;
                $state['mapping'] = is_array($remote['mapping'] ?? null) ? $remote['mapping'] : $state['mapping'];
            }
        }
        tagioo_write_state($statePath, $state);
    } else {
        tagioo_out('Tagioo connection check failed (HTTP '.$heartbeat['status'].'); local retry safety remains active.');
    }

    if (!$state['remote_active']) {
        tagioo_out($report['orders']['ready']
            ? 'Store detected. Return to Tagioo and click Activate tracking.'
            : 'Connection established, but required fields need mapping in Tagioo.');
        return;
    }
    if (!$report['orders']['ready']) {
        tagioo_out('Tracking is paused because the required order mapping is incomplete.');
        return;
    }
    $config = tagioo_apply_mapping($config, $state['mapping']);
    $schema = tagioo_schema($config);

    if (!$state['initialized']) {
        $latest = tagioo_latest_order($config, $schema);
        $state['initialized'] = true;
        $state['last'] = $latest ? tagioo_cursor($latest, $schema) : null;
        tagioo_write_state($statePath, $state);
        tagioo_out('Bridge initialized. Existing orders were skipped; only new paid orders will be tracked.');
        return;
    }

    $rows = tagioo_new_orders($config, $schema, $state['last']);
    foreach ($rows as $row) {
        $cursor = tagioo_cursor($row, $schema);
        $payload = tagioo_order_payload($row, $schema, $config);
        if ($payload) {
            $key = hash('sha256', (string) $config['tenant'].'|'.(string) $payload['order_id']);
            $state['pending'][$key] ??= ['payload' => $payload, 'attempts' => 0, 'next_attempt_at' => 0];
        }
        $state['last'] = $cursor;
    }
    if ($rows) tagioo_write_state($statePath, $state);

    $sent = 0;
    $now = time();
    foreach (array_keys($state['pending']) as $key) {
        $entry = $state['pending'][$key];
        if ((int) ($entry['next_attempt_at'] ?? 0) > $now) continue;
        $result = tagioo_send($config, $entry['payload']);
        if ($result['ok']) {
            tagioo_out('Purchase accepted: order '.$entry['payload']['order_id'].'.');
            unset($state['pending'][$key]);
            $sent++;
        } else {
            $entry['attempts'] = min(20, (int) ($entry['attempts'] ?? 0) + 1);
            $entry['next_attempt_at'] = time() + min(3600, 30 * (2 ** min(7, $entry['attempts'] - 1)));
            $entry['last_status'] = $result['status'];
            $entry['last_error'] = substr((string) $result['error'], 0, 160);
            $state['pending'][$key] = $entry;
            tagioo_out('Order '.$entry['payload']['order_id'].' kept for retry (HTTP '.$result['status'].').');
        }
        tagioo_write_state($statePath, $state);
    }
    if (!$rows && !$sent && !$state['pending']) tagioo_out('No new paid orders.');
}

$config = tagioo_config();
$command = strtolower((string) ($argv[1] ?? 'run'));
if ($command === 'doctor') tagioo_doctor($config);
elseif ($command === 'run') tagioo_run($config);
else tagioo_fail('Unknown command. Use: php bridge.php doctor OR php bridge.php run.');
