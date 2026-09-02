<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A candidate's response to a multi_select question (a set of option ids) or a
 * numeric question (a typed number) doesn't fit `selected_option_id`. Both
 * columns are nullable and untouched by every existing single_choice answer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('test_answers', function (Blueprint $table) {
            $table->json('selected_option_ids')->nullable()->after('selected_option_id');
            $table->decimal('numeric_response', 12, 4)->nullable()->after('selected_option_ids');
        });
    }

    public function down(): void
    {
        Schema::table('test_answers', function (Blueprint $table) {
            $table->dropColumn(['selected_option_ids', 'numeric_response']);
        });
    }
};
