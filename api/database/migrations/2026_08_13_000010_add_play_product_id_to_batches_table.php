<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Maps a purchasable batch to its Google Play managed-product id.
 *
 * Play Billing can only sell products that exist in the Play Console, addressed
 * by a product id — you cannot charge an arbitrary `price_paise` the way
 * Razorpay does. This column is the join between a batch and the Console
 * product the student actually buys. It is nullable: a batch with no product id
 * simply is not offered through the in-app store (it stays activation-code only),
 * which is also the state the whole store sits in until the Console products
 * are created.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->string('play_product_id')->nullable()->after('price_paise');
        });
    }

    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->dropColumn('play_product_id');
        });
    }
};
