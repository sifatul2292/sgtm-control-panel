<?php

namespace Tagioo\Laravel\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class DoctorCommand extends Command
{
    protected $signature = 'tagioo:doctor';
    protected $description = 'Check the Tagioo Laravel Bridge configuration';

    public function handle(): int
    {
        $checks = [
            'Bridge enabled' => (bool) config('tagioo.enabled'),
            'Endpoint configured' => (bool) config('tagioo.endpoint'),
            'Tenant configured' => (bool) config('tagioo.tenant'),
            'Secret configured' => (bool) config('tagioo.secret'),
            'Outbox table migrated' => Schema::hasTable('tagioo_events'),
        ];

        foreach ($checks as $label => $ok) {
            $this->line(($ok ? '<info>PASS</info>' : '<error>FAIL</error>').'  '.$label);
        }

        return in_array(false, $checks, true) ? self::FAILURE : self::SUCCESS;
    }
}
