<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A question's own diagram — a figure, a mirror-image puzzle, a standalone
 * chart a single question refers to ("In the figure below, find X"). This is
 * NOT the shared image a data-interpretation SET uses across several
 * questions — that lives on `passages.image_path`, reusing the exact
 * mechanism already built for English RC sets rather than inventing a
 * second "shared content" concept next to it.
 *
 * Stored on the `public` disk, same convention as course thumbnails and
 * banners: a diagram alone, detached from the live entitlement-gated test
 * session it appears inside, carries no more than a screenshot of the
 * question already would.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('question_text');
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->dropColumn('image_path');
        });
    }
};
