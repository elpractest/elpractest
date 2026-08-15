<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FCM v1.1 — device push tokens.
 *
 * One row per (device token). A token is UNIQUE and reassigns to the newest
 * owner on register, so a shared/handed-down device never double-delivers.
 * Pruned when FCM reports the token UNREGISTERED. See docs/FCM_V1.1_SCOPE.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('device_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token')->unique();
            $table->string('platform', 16)->default('android'); // android | ios | web
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_tokens');
    }
};
