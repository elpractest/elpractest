<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Image-only answer options — "which figure completes the series", mirror
 * images, embedded-figure puzzles. A staple of the SSC CGL/CHSL non-verbal
 * reasoning section, where the four options ARE the four small diagrams and
 * there is no meaningful text to put in their place.
 *
 * `option_text` is deliberately left NOT NULL. A pure-image option is
 * stored with it as an empty string rather than the column being made
 * nullable: on this project's SQLite setup, Blueprint::change() rebuilds
 * the whole table by hand-selecting only the columns named in the SAME
 * migration and drops every other column's data in the process (verified
 * with `migrate --pretend` before this was written — id, question_id,
 * label, is_correct and sort_order all vanished). An empty string reads
 * identically to null everywhere this is consumed (rendering checks
 * "is there text AND/OR an image", not "is text null"), so nothing is
 * lost by keeping the column exactly as strict as it already was.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('question_options', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('option_text');
        });
    }

    public function down(): void
    {
        Schema::table('question_options', function (Blueprint $table) {
            $table->dropColumn('image_path');
        });
    }
};
