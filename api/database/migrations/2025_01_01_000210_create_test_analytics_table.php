<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * NOTE: percentile and rank are NOT stored here — they are computed at read-time
     * via MySQL 8 window functions (RANK() OVER, PERCENT_RANK() OVER) against the
     * test_analytics scores for the entire test cohort. This ensures they are always
     * correct by construction, even as new students submit.
     */
    public function up(): void
    {
        Schema::create('test_analytics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('test_session_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('total_score', 8, 2);
            $table->decimal('max_score', 8, 2);
            $table->integer('correct_count');
            $table->integer('incorrect_count');
            $table->integer('unanswered_count');
            $table->decimal('accuracy_percentage', 5, 2);
            $table->integer('total_time_seconds');
            $table->json('subject_breakdown'); // {subject: {correct, incorrect, unanswered, score, max, time}}
            $table->json('topic_breakdown');   // {topic: {correct, incorrect, unanswered, score, max, time}}
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('test_analytics');
    }
};
