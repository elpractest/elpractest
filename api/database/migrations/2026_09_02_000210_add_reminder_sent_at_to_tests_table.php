<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marks a scheduled mock as "reminder already sent".
 *
 * The reminder command runs every few minutes, so without a durable marker
 * every run inside the reminder window would message the whole cohort again —
 * on WhatsApp, which costs money per send and gets the number blocked. Setting
 * it BEFORE dispatching also means two overlapping runs cannot both claim the
 * same test.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tests', function (Blueprint $table) {
            $table->timestamp('reminder_sent_at')->nullable()->after('available_until');
        });
    }

    public function down(): void
    {
        Schema::table('tests', function (Blueprint $table) {
            $table->dropColumn('reminder_sent_at');
        });
    }
};
