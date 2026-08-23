<?php

namespace Tagioo\Laravel\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tagioo\Laravel\Models\TagiooEvent;
use Throwable;

class SendEvent implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 8;

    public function __construct(public int $eventId)
    {
    }

    public function backoff(): array
    {
        return [10, 60, 300, 900, 3600, 10800, 21600];
    }

    public function handle(): void
    {
        $event = TagiooEvent::find($this->eventId);

        if (!$event || $event->sent_at || !config('tagioo.enabled')) {
            return;
        }

        $endpoint = rtrim((string) config('tagioo.endpoint'), '/');
        $tenant = (string) config('tagioo.tenant');
        $secret = (string) config('tagioo.secret');

        if (!$endpoint || !$tenant || !$secret) {
            $event->update(['last_error' => 'Tagioo connection is incomplete.']);
            return;
        }

        $payload = array_merge($event->payload, [
            'tenant_id' => $tenant,
            'event_name' => $event->event_name,
            'event_id' => $event->event_id,
        ]);
        $body = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $timestamp = (string) time();
        $signature = hash_hmac('sha256', $timestamp.'.'.$body, $secret);

        try {
            $response = Http::timeout(max(1, (int) config('tagioo.timeout', 5)))
                ->acceptJson()
                ->withHeaders([
                    'X-Tagioo-Timestamp' => $timestamp,
                    'X-Tagioo-Signature' => $signature,
                ])
                ->withBody($body, 'application/json')
                ->post($endpoint);

            if (!$response->successful()) {
                throw new RuntimeException('Tagioo returned HTTP '.$response->status().'.');
            }

            $event->update([
                'sent_at' => now(),
                'attempts' => $event->attempts + 1,
                'last_error' => null,
            ]);
        } catch (Throwable $error) {
            $event->update([
                'attempts' => $event->attempts + 1,
                'last_error' => substr($error->getMessage(), 0, 2000),
            ]);
            throw $error;
        }
    }
}
