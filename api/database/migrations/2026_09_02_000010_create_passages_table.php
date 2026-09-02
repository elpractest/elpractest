<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A shared passage/comprehension text that several questions can link to
 * (English comprehension, RC sets — a standard SSC/Banking section format).
 * Grouping only: each linked question still scores through its own type
 * (single_choice or multi_select) exactly as it would standalone.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('passages', function (Blueprint $table) {
            $table->id();
            $table->string('title')->nullable();
            $table->text('body');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('passages');
    }
};
