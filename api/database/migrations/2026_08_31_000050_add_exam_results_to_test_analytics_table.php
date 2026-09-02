<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Result fields an Indian govt-exam scorecard needs beyond a raw total:
 *
 *   merit_score       total EXCLUDING qualifying-only sections
 *   section_breakdown per-section score / max / cut-off / cleared
 *   is_qualified      cleared every sectional bar AND the overall bar
 *   normalized_score  cross-shift normalised marks (null when not normalised)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('test_analytics', function (Blueprint $table) {
            $table->decimal('merit_score', 8, 2)->nullable();
            $table->decimal('normalized_score', 8, 2)->nullable();
            $table->boolean('is_qualified')->nullable();
            $table->json('section_breakdown')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('test_analytics', function (Blueprint $table) {
            $table->dropColumn(['merit_score', 'normalized_score', 'is_qualified', 'section_breakdown']);
        });
    }
};
