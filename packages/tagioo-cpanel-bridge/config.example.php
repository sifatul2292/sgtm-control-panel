<?php

return [
    'enabled' => true,
    'endpoint' => 'https://panel.example.com/api/orders/laravel',
    'heartbeat_endpoint' => 'https://panel.example.com/api/laravel/bridge/heartbeat',
    'tenant' => 'customer-id',
    'secret' => 'replace-with-a-random-secret',
    'store_url' => 'https://store.example.com',

    // Leave blank when the Laravel app is in public_html, laravel, or application.
    // Otherwise enter the full cPanel path to the folder containing artisan.
    'laravel_root' => '',
    'orders_table' => 'orders',
    'items_table' => '',
    'currency' => 'BDT',
    'paid_statuses' => ['processing', 'completed', 'paid', 'success', 'confirmed', 'delivered'],
    'assume_new_orders_paid' => false,
    'batch_size' => 25,
    'timeout' => 5,

    // Tagioo safely detects common column names. Use Advanced mapping in the
    // Tagioo dashboard when a store uses a different database schema.
    'columns' => [
        // 'id' => 'id',
        // 'primary' => 'id',
        // 'total' => 'grand_total',
        // 'created' => 'created_at',
        // 'updated' => 'updated_at',
        // 'status' => 'status',
    ],
    'item_columns' => [],
];
