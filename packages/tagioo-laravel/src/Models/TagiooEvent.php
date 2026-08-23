<?php

namespace Tagioo\Laravel\Models;

use Illuminate\Database\Eloquent\Model;

class TagiooEvent extends Model
{
    protected $table = 'tagioo_events';

    protected $guarded = [];

    protected $casts = [
        'payload' => 'array',
        'sent_at' => 'datetime',
    ];
}
