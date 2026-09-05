<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Classify the question bank by exam, and give every question a stable,
 * human-readable identifier.
 *
 * Before this, the only exam dimension on a question was `exam_tags` — a
 * free-text JSON array, so "UGC NET", "UGC-NET" and "ugc net" were three
 * different tags and nothing validated any of them. There was no paper, year,
 * shift, medium or source, which made "every Paper-1 PYQ from 2024 in English"
 * a question the database could not answer.
 *
 * These are columns rather than one packed code string on purpose: columns are
 * what indexes and range queries need. `question_code` is a PROJECTION of them
 * for humans to read and cite, and — being unique — it is also what finally
 * makes a repeat import fail loudly instead of silently doubling the bank.
 *
 * Every column is nullable or defaulted, so existing rows stay valid and
 * unclassified. A unique index permits many NULLs, so un-coded rows do not
 * collide with each other.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            // Finer than courses.exam_category: SSC CGL and SSC CHSL are both
            // "SSC" to a course, but they are not the same paper to a question.
            // Validated against config('exams.registry').
            $table->string('exam_code', 32)->nullable()->after('topic');
            $table->string('paper', 16)->nullable()->after('exam_code');
            $table->string('source', 16)->default('mock')->after('paper'); // pyq|mock|practice
            $table->unsignedSmallInteger('year')->nullable()->after('source');
            // The axis a packed code loses: 2024 Paper 1 morning and evening
            // both have a Question 1 in English.
            $table->string('shift', 16)->nullable()->after('year');
            $table->string('medium', 8)->default('en')->after('shift');
            // Position within its paper. Real for a PYQ, assigned per group
            // otherwise (see QuestionCodeService::nextSerial).
            $table->unsignedInteger('serial')->nullable()->after('medium');

            // e.g. UGCNET-P1-PY-2024-S2-EN-001
            $table->string('question_code', 128)->nullable()->after('serial');
        });

        Schema::table('questions', function (Blueprint $table) {
            $table->unique('question_code');
            // The shape every bank filter and every pool match query uses.
            $table->index(['exam_code', 'paper', 'year', 'shift'], 'questions_taxonomy_index');
            $table->index(['source', 'medium'], 'questions_source_medium_index');
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->dropUnique(['question_code']);
            $table->dropIndex('questions_taxonomy_index');
            $table->dropIndex('questions_source_medium_index');
        });

        Schema::table('questions', function (Blueprint $table) {
            $table->dropColumn([
                'exam_code', 'paper', 'source', 'year',
                'shift', 'medium', 'serial', 'question_code',
            ]);
        });
    }
};
