<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tagioo_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_name', 80);
            $table->string('event_id', 191);
            $table->json('payload');
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('sent_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
            $table->unique(['event_name', 'event_id']);
            $table->index(['sent_at', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tagioo_events');
    }
};
