<?php

namespace Tagioo\Laravel\Facades;

use Illuminate\Support\Facades\Facade;

class Tagioo extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return 'tagioo';
    }
}
