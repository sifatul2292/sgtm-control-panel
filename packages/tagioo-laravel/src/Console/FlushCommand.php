<?php

namespace Tagioo\Laravel\Console;

use Illuminate\Console\Command;
use Tagioo\Laravel\Jobs\SendEvent;
use Tagioo\Laravel\Models\TagiooEvent;

class FlushCommand extends Command
{
    protected $signature = 'tagioo:flush {--limit=100}';
    protected $description = 'Retry pending Tagioo tracking events';

    public function handle(): int
    {
        $events = TagiooEvent::query()
            ->whereNull('sent_at')
            ->oldest()
            ->limit(max(1, min(500, (int) $this->option('limit'))))
            ->get();

        foreach ($events as $event) {
            SendEvent::dispatch($event->id);
        }

        $this->info('Queued '.$events->count().' Tagioo event(s).');
        return self::SUCCESS;
    }
}
