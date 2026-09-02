<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `product_items` — what a product actually hands over.
 *
 * Deliberately uniform: a course product has one item, a series product has one
 * item, a bundle has several. Nothing in the grant path needs to branch on
 * `products.type` — it walks the items either way — so "bundle" costs no extra
 * code beyond the admin screen that lets you add more than one row here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();

            // App\Models\Course | App\Models\TestSeries
            $table->string('grantable_type');
            $table->unsignedBigInteger('grantable_id');

            // Only meaningful for a Course item: which cohort the buyer lands
            // in. Null means "the course's default active batch at purchase
            // time", resolved when the entitlement is granted.
            $table->foreignId('batch_id')->nullable()->constrained()->nullOnDelete();

            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['grantable_type', 'grantable_id']);
            $table->unique(['product_id', 'grantable_type', 'grantable_id'], 'product_items_unique_grantable');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_items');
    }
};
