<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sectional cut-offs and qualifying papers.
 *
 * `is_qualifying` models the UPSC CSAT / IBPS style paper that a candidate must
 * clear but whose marks do NOT count toward the merit score. Both default to the
 * current behaviour: no sectional bar, every section counts toward merit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('test_sections', function (Blueprint $table) {
            $table->decimal('cutoff_marks', 8, 2)->nullable();
            $table->decimal('cutoff_percentage', 5, 2)->nullable();
            $table->boolean('is_qualifying')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('test_sections', function (Blueprint $table) {
            $table->dropColumn(['cutoff_marks', 'cutoff_percentage', 'is_qualifying']);
        });
    }
};
