<?php

namespace Tagioo\Laravel;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Tagioo\Laravel\Jobs\SendEvent;
use Tagioo\Laravel\Models\TagiooEvent;
use Throwable;

class Tracker
{
    /**
     * Record a completed order without ever allowing tracking to break checkout.
     * Arrays, Eloquent models and DTO-like objects are accepted. Custom stores can
     * pass the second argument to override any automatically mapped fields.
     */
    public function purchase(mixed $order, array $overrides = []): bool
    {
        if (!config('tagioo.enabled')) {
            return false;
        }

        try {
            $payload = array_merge($this->normalizeOrder($order), $overrides);
            $orderId = ltrim(trim((string) ($payload['order_id'] ?? '')), '#');
            $amount = (float) ($payload['total'] ?? 0);

            if ($orderId === '' || $amount <= 0) {
                Log::warning('Tagioo skipped a purchase without a valid order ID and total.');
                return false;
            }

            $payload['order_id'] = $orderId;
            $payload['total'] = $amount;
            $payload['currency'] = strtoupper((string) ($payload['currency'] ?? 'BDT'));
            // Calling purchase() means the storefront accepted the order. COD
            // orders are often still "pending" financially, but GA4/Meta define
            // Purchase at successful order placement, not later cash collection.
            $payload['order_status'] = (string) ($payload['status'] ?? '');
            $payload['status'] = 'completed';
            $payload['source'] = 'tagioo-laravel-bridge';

            $record = function () use ($orderId, $payload): void {
                try {
                    $event = TagiooEvent::firstOrCreate(
                        ['event_name' => 'purchase', 'event_id' => $orderId],
                        ['payload' => $payload]
                    );

                    if (!$event->sent_at) {
                        SendEvent::dispatchAfterResponse($event->id);
                    }
                } catch (Throwable $error) {
                    Log::warning('Tagioo could not write to its event outbox.', ['error' => $error->getMessage()]);
                }
            };

            // If the store is currently saving the order inside a transaction,
            // wait for that commit. A rolled-back order must never become a sale.
            if (DB::transactionLevel() > 0) {
                DB::afterCommit($record);
            } else {
                $record();
            }

            return true;
        } catch (Throwable $error) {
            Log::warning('Tagioo could not record the purchase.', ['error' => $error->getMessage()]);
            return false;
        }
    }

    private function normalizeOrder(mixed $order): array
    {
        $get = fn (array $keys, mixed $default = null) => $this->first($order, $keys, $default);
        $customer = $get(['customer', 'user'], []);
        $billing = $get(['billing', 'billing_address'], []);
        $request = app()->bound('request') ? request() : null;

        return [
            'order_id' => $get(['id', 'order_id', 'order_number', 'number', 'transaction_id']),
            'total' => $get(['grand_total', 'total', 'total_amount', 'amount', 'payable_amount']),
            'currency' => $get(['currency', 'currency_code'], 'BDT'),
            'status' => $get(['status', 'payment_status'], 'completed'),
            'created_at' => $this->dateValue($get(['created_at', 'ordered_at', 'paid_at'])),
            'email' => $this->first($billing, ['email'], $this->first($customer, ['email'], $get(['email', 'customer_email']))),
            'phone' => $this->first($billing, ['phone'], $this->first($customer, ['phone', 'mobile'], $get(['phone', 'customer_phone']))),
            'first_name' => $this->first($billing, ['first_name'], $this->first($customer, ['first_name'], $get(['first_name']))),
            'last_name' => $this->first($billing, ['last_name'], $this->first($customer, ['last_name'], $get(['last_name']))),
            'city' => $this->first($billing, ['city'], $get(['city'])),
            'region' => $this->first($billing, ['state', 'region'], $get(['state', 'region'])),
            'postal_code' => $this->first($billing, ['postcode', 'postal_code', 'zip'], $get(['postcode', 'postal_code'])),
            'country' => $this->first($billing, ['country', 'country_code'], $get(['country'])),
            'customer_ip' => $get(['customer_ip', 'ip_address', 'ip'], $request?->ip()),
            'customer_user_agent' => $get(['customer_user_agent', 'user_agent'], $request?->userAgent()),
            'fbp' => $get(['fbp', '_fbp'], $request?->cookie('_fbp')),
            'fbc' => $get(['fbc', '_fbc'], $request?->cookie('_fbc')),
            'page_location' => $get(['success_url', 'order_url', 'url'], $request?->fullUrl()),
            'items' => $this->items($get(['items', 'order_items', 'lines'], [])),
        ];
    }

    private function first(mixed $source, array $keys, mixed $default = null): mixed
    {
        foreach ($keys as $key) {
            $value = data_get($source, $key);
            if ($value !== null && $value !== '') {
                return $value;
            }
        }
        return $default;
    }

    private function items(mixed $items): array
    {
        if ($items instanceof \Traversable) {
            $items = iterator_to_array($items);
        }
        if (!is_array($items)) {
            return [];
        }

        return array_values(array_map(function ($item) {
            return [
                'item_id' => (string) $this->first($item, ['product_id', 'item_id', 'id', 'sku'], ''),
                'item_name' => (string) $this->first($item, ['name', 'product_name', 'title'], ''),
                'price' => (float) $this->first($item, ['unit_price', 'price', 'amount'], 0),
                'quantity' => (float) $this->first($item, ['quantity', 'qty'], 1),
            ];
        }, $items));
    }

    private function dateValue(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }
        return $value ? (string) $value : now()->toAtomString();
    }
}
