<?php

namespace Tagioo\Laravel;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\ServiceProvider;
use Tagioo\Laravel\Console\DoctorCommand;
use Tagioo\Laravel\Console\FlushCommand;

class TagiooServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/tagioo.php', 'tagioo');
        $this->app->singleton('tagioo', fn () => new Tracker());
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../database/migrations');

        if ($this->app->runningInConsole()) {
            $this->commands([DoctorCommand::class, FlushCommand::class]);
            $this->publishes([
                __DIR__.'/../config/tagioo.php' => config_path('tagioo.php'),
            ], 'tagioo-config');
        }

        $this->callAfterResolving(Schedule::class, function (Schedule $schedule) {
            $schedule->command('tagioo:flush')->everyMinute()->withoutOverlapping();
        });
    }
}
