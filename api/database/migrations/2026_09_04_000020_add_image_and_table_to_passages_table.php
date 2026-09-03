<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The two shapes a Data Interpretation set actually comes in, on Indian
 * competitive papers, beyond plain reading-comprehension text: a chart/graph
 * (image) and a data table (numbers in a grid).
 *
 * `table_data` is a flat {headers: string[], rows: string[][]} JSON blob,
 * rendered client-side as a real HTML <table> rather than baked into an
 * image — a rasterised DI table is worse on a phone (blurry at any zoom,
 * nothing to select or search) for something that is, underneath, just text
 * and numbers. `image_path` stays for the cases a table cannot represent —
 * a bar/pie/line chart, a map, a diagram several questions share.
 *
 * Both live on the PASSAGE, not the question, because that is the actual
 * shape of the pattern this supports: "Study the following [table/chart]
 * and answer questions 21-25" — one shared exhibit, several linked
 * questions, exactly the grouping `passages` was already built for.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('passages', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('body');
            $table->json('table_data')->nullable()->after('image_path');
        });
    }

    public function down(): void
    {
        Schema::table('passages', function (Blueprint $table) {
            $table->dropColumn(['image_path', 'table_data']);
        });
    }
};
