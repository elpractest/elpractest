<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The candidate paper order, materialised once at session start.
 *
 * Shuffling has to be PERSISTED rather than recomputed per request: the palette,
 * a resume after a crash, and the results review all have to show the same order
 * the candidate actually sat, and a re-shuffle mid-test would scramble it.
 *
 * question_order: { "<section_id>": [questionId, ...] }
 * option_order:   { "<question_id>": [optionId, ...] }
 * Null on either = author order, which is what every existing session has.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('test_sessions', function (Blueprint $table) {
            $table->json('question_order')->nullable();
            $table->json('option_order')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('test_sessions', function (Blueprint $table) {
            $table->dropColumn(['question_order', 'option_order']);
        });
    }
};
