<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `products` — the sellable thing.
 *
 * Until now the only purchasable row was a `batch`, which is why a test series
 * could not be sold at all: it has no batch, and `enrollments`/`payments` both
 * require one. A product decouples "what is on sale" from "which cohort a
 * student sits in", so a course, a series, or a bundle of both can each carry a
 * price without inventing a shell course to hang it on.
 *
 * A batch remains what it always was — the teaching cohort, with its dates and
 * its capacity. `price_paise` on batches is untouched and the old rail still
 * works; this is a second rail beside it, not a replacement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('type'); // course | test_series | bundle — string, not a DB enum
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('short_description')->nullable();
            $table->string('exam_category');
            $table->integer('price_paise');

            // What the student pays before any coupon. Shown struck through
            // next to price_paise when set, so a bundle can display its saving
            // without the discount being computed from the parts (a bundle is
            // priced as a product, not as a sum).
            $table->integer('list_price_paise')->nullable();

            // Null = access does not expire. Otherwise entitlements granted by
            // this product expire this many days after purchase, which is how a
            // "1 year, all SSC series" subscription is expressed.
            $table->integer('access_days')->nullable();

            // The Android in-app-purchase SKU, mirroring batches.play_product_id.
            $table->string('play_product_id')->nullable();

            $table->string('thumbnail_path')->nullable();
            $table->boolean('is_published')->default(false);
            $table->integer('sort_order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['is_published', 'sort_order']);
            $table->index('exam_category');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
