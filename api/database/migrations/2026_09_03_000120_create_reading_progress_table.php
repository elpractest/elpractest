<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where a student is inside a study material, so the reader reopens exactly
 * where it closed — on any device, not just the one the PDF was opened on.
 *
 * One row per (student, material): the reader PATCHes it every 30s, on tab
 * hide and on unmount, and the values are last-write-wins. `current_page`
 * only ever moves forward under an explicit jump, never as a side effect of
 * a sync arriving out of order — that is enforced in the controller, not
 * here, because the ordering fact lives in the request.
 *
 * Bookmarks are a small array of page numbers, so they ride along on the same
 * row rather than earning a table: there is no per-bookmark metadata to hold
 * and no query that asks for a bookmark without its material.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reading_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('study_material_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('current_page')->default(1);
            $table->unsignedTinyInteger('percent_complete')->default(0);
            $table->unsignedInteger('seconds_read')->default(0);
            $table->json('bookmarks')->nullable();          // [3, 17, 42]
            $table->timestamp('last_read_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'study_material_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reading_progress');
    }
};
