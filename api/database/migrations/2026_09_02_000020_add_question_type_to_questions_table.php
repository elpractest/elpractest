<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Real SSC/Banking/RRB papers aren't single-choice-only: statement-based
 * multi-correct and numeric-entry (quant) are routine formats. Adds the fields
 * for both, plus a passage link for comprehension sets.
 *
 * question_type defaults to 'single_choice', so every existing question and
 * every existing scoring path behaves exactly as it does today. numeric_answer
 * / numeric_tolerance are only read when question_type = 'numeric'; question_options
 * rows still carry multi_select's correct/incorrect flags exactly like
 * single_choice does (is_correct was always per-row, never "exactly one"
 * enforced at the schema level) — no new column needed for that.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->string('question_type')->default('single_choice')->after('difficulty');
            $table->decimal('numeric_answer', 12, 4)->nullable()->after('question_type');
            $table->decimal('numeric_tolerance', 12, 4)->nullable()->after('numeric_answer');
            $table->foreignId('passage_id')->nullable()->after('numeric_tolerance')
                ->constrained('passages')->nullOnDelete();
        });

        Schema::table('questions', function (Blueprint $table) {
            $table->index('question_type');
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->dropIndex(['question_type']);
        });
        Schema::table('questions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('passage_id');
            $table->dropColumn(['question_type', 'numeric_answer', 'numeric_tolerance']);
        });
    }
};
