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
        Schema::table('tests', function (Blueprint $table) {
            $table->foreignId('test_series_id')->nullable()->constrained('test_series')->nullOnDelete();
            $table->integer('series_sort_order')->default(0);
            $table->string('category')->default('full_mock'); // full_mock, sectional, pyp, topic, current_affairs
            $table->boolean('is_free')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tests', function (Blueprint $table) {
            $table->dropForeign(['test_series_id']);
            $table->dropColumn(['test_series_id', 'series_sort_order', 'category', 'is_free']);
        });
    }
};
