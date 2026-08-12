<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Vajini's retrieval corpus. One row per embedded chunk of course content
 * (a course's description/syllabus, a question + its explanation). The
 * embedding is stored as JSON so this works identically on SQLite (dev/test)
 * and MySQL (prod) — cosine similarity is computed in PHP over this set, which
 * is small enough (hundreds–low-thousands of rows) that a vector database is
 * not warranted.
 *
 * `content_hash` makes re-indexing idempotent: `vajini:index` skips a chunk
 * whose source text is byte-identical to what is already embedded, so a nightly
 * re-index only pays the OpenAI embedding cost for content that actually changed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vajini_chunks', function (Blueprint $table) {
            $table->id();
            $table->string('source_type');           // 'course' | 'question'
            $table->unsignedBigInteger('source_id');
            $table->string('title');                 // shown as the citation label
            $table->text('content');                 // the text that was embedded
            $table->string('content_hash', 64);      // sha256 of content
            $table->json('embedding');               // float[] vector
            $table->timestamps();

            $table->index(['source_type', 'source_id']);
            $table->index('content_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vajini_chunks');
    }
};
