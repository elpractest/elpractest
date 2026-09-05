<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A named, saved filter over the question taxonomy — and a thing a student can
 * be entitled to.
 *
 * Practice access was previously derived entirely from tests: you could drill a
 * question only if it appeared in a paper you had bought. That is a sound rule
 * and it still applies, but it makes the bank itself unsellable — an institute
 * with 12,000 classified previous-year questions had no way to offer them as
 * anything other than a stack of mocks.
 *
 * A pool is deliberately a FILTER, not a list of question ids: "UGC NET Paper 1,
 * previous-year, English" keeps meaning the right thing as more of that paper is
 * imported, with nothing to re-sync. Blank facets mean "any", so a pool scoped
 * to an exam alone covers every year of it.
 *
 * `entitlements` and `product_items` were already polymorphic, so this becomes a
 * sellable grantable with no changes to checkout, payment or entitlement
 * granting — only to what those tables are allowed to point at.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('question_pools', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();

            // Matched against questions.* — every one optional, blank = any.
            $table->string('exam_code', 32)->nullable();
            $table->string('paper', 16)->nullable();
            $table->string('source', 16)->nullable();
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('shift', 16)->nullable();
            $table->string('medium', 8)->nullable();

            // The coarse label the Store already groups by.
            $table->string('exam_category');

            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['exam_code', 'paper']);
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('question_pools');
    }
};
