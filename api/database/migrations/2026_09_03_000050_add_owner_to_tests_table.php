<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `tests.owner_id` — a paper the student built for themselves.
 *
 * The custom practice console generates a real Test row rather than inventing a
 * parallel entity, so sections, sessions, the palette, shuffling, scoring and
 * the result screen all work with no changes at all. `owner_id` is the one bit
 * that distinguishes it: non-null means "private to this student".
 *
 * It also keeps these papers OUT of the aggregate analytics. A self-built,
 * self-paced paper has no comparable field, so it never enters a leaderboard,
 * and its attempts are excluded from item statistics — mixing low-stakes
 * practice into difficulty_index and discrimination_index would quietly corrupt
 * the one signal that tells you an answer key is wrong.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tests', function (Blueprint $table) {
            $table->foreignId('owner_id')->nullable()->after('created_by')
                ->constrained('users')->cascadeOnDelete();
            $table->index('owner_id');
        });
    }

    public function down(): void
    {
        Schema::table('tests', function (Blueprint $table) {
            $table->dropIndex(['owner_id']);
            $table->dropForeign(['owner_id']);
            $table->dropColumn('owner_id');
        });
    }
};
