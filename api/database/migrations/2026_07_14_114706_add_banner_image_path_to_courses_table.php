<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            // No ->after(): 'thumbnail_path' doesn't exist on this table, and
            // MySQL/MariaDB enforce after() (SQLite ignores it). Column order
            // is cosmetic, so append it at the end for cross-DB compatibility.
            $table->string('banner_image_path')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('banner_image_path');
        });
    }
};
