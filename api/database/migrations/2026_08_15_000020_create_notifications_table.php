<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Laravel's standard notifications table (the `database` channel).
 *
 * Backs the in-app Notifications screen + the bell unread badge. Every
 * v1.1 notification writes a row here via toDatabase(); the `data` json
 * holds { title, body, hue, icon, route } which the feed endpoint maps to
 * the shape app/src/pages/Notifications.jsx already renders.
 * See docs/FCM_V1.1_SCOPE.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable'); // notifiable_type + notifiable_id (indexed)
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
