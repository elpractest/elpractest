<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Question QA workflow + cached item statistics.
 *
 * `status` defaults to 'approved' so every EXISTING row stays live and every
 * existing test keeps working - the review gate applies to new authoring only.
 * A string column, not a DB enum, so MariaDB and SQLite agree (CLAUDE.md 17.3).
 *
 * The two index columns are a CACHE of what ComputeItemStatistics derives from
 * raw test_answers; they are never the source of truth and can be rebuilt.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->string('status')->default('approved');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_note')->nullable();

            // Item analysis (classical test theory), cached from raw answers.
            $table->decimal('difficulty_index', 6, 4)->nullable();     // p-value: share answering correctly
            $table->decimal('discrimination_index', 6, 4)->nullable(); // point-biserial, -1..1
            $table->unsignedInteger('stats_sample_size')->default(0);
            $table->timestamp('stats_computed_at')->nullable();
        });

        Schema::table('questions', function (Blueprint $table) {
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->dropIndex(['status']);
        });
        Schema::table('questions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropColumn([
                'status', 'reviewed_at', 'review_note',
                'difficulty_index', 'discrimination_index', 'stats_sample_size', 'stats_computed_at',
            ]);
        });
    }
};
