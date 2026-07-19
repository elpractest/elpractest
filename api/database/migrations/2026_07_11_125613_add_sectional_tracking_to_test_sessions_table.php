<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('test_sessions', function (Blueprint $table) {
            $table->unsignedTinyInteger('current_section_index')->default(0)->after('is_auto_submitted');
            $table->timestamp('section_started_at')->nullable()->after('current_section_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('test_sessions', function (Blueprint $table) {
            $table->dropColumn(['current_section_index', 'section_started_at']);
        });
    }
};
