<?php

return [
    'enabled' => env('TAGIOO_ENABLED', true),
    'endpoint' => env('TAGIOO_ENDPOINT'),
    'tenant' => env('TAGIOO_TENANT'),
    'secret' => env('TAGIOO_SECRET'),
    'timeout' => (int) env('TAGIOO_TIMEOUT', 5),
];
