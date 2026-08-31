<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Exam-pattern controls on a test: cut-offs, per-candidate shuffling, and the
 * shift grouping that cross-shift normalisation needs.
 *
 * All nullable or false-by-default, so every existing test behaves exactly as it
 * does today: no cut-off, no shuffle, no normalisation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tests', function (Blueprint $table) {
            // Overall qualifying bar. Absolute marks wins if both are set.
            $table->decimal('cutoff_marks', 8, 2)->nullable();
            $table->decimal('cutoff_percentage', 5, 2)->nullable();

            // Per-candidate paper randomisation (real CBTs vary order per seat).
            $table->boolean('shuffle_questions')->default(false);
            $table->boolean('shuffle_options')->default(false);

            // Normalisation across shifts: tests sharing a shift_group are one
            // exam run in multiple sittings; shift_label identifies the sitting.
            $table->string('shift_group')->nullable();
            $table->string('shift_label')->nullable();
            $table->string('normalization_method')->default('none'); // none|equipercentile|zscore
        });

        Schema::table('tests', function (Blueprint $table) {
            $table->index('shift_group');
        });
    }

    public function down(): void
    {
        Schema::table('tests', function (Blueprint $table) {
            $table->dropIndex(['shift_group']);
        });
        Schema::table('tests', function (Blueprint $table) {
            $table->dropColumn([
                'cutoff_marks', 'cutoff_percentage',
                'shuffle_questions', 'shuffle_options',
                'shift_group', 'shift_label', 'normalization_method',
            ]);
        });
    }
};
