<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Home promo banners, managed by the super-admin panel and shown on the
     * student app's Home carousel (and reusable by the marketing site / mobile
     * apps via the public read endpoint).
     */
    public function up(): void
    {
        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->string('kicker')->nullable();        // small eyebrow label e.g. "FREE SCHOLARSHIP"
            $table->string('cta_label')->nullable();     // button text e.g. "Attempt free"
            $table->string('cta_url')->nullable();       // internal path (/student/test-series) or external URL
            $table->string('image_path')->nullable();    // stored on the public disk
            $table->string('exam_category')->nullable(); // optional label / future targeting
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamp('starts_at')->nullable();  // optional scheduling window
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('banners');
    }
};
