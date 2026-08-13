<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Google Play purchase provenance on a payment.
 *
 * A Play purchase is identified by its purchase token (the thing the backend
 * validates against the Play Developer API) and its order id. The token is
 * unique so a single purchase can only ever grant one enrolment — the verify
 * endpoint is idempotent on it, which is what makes a retried verify safe.
 * These sit beside the razorpay_* columns rather than replacing them: the two
 * rails coexist in the schema even though a Play build only uses this one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('google_play_purchase_token', 512)->nullable()->unique()->after('razorpay_signature');
            $table->string('google_play_order_id')->nullable()->after('google_play_purchase_token');
            $table->string('google_play_product_id')->nullable()->after('google_play_order_id');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['google_play_purchase_token', 'google_play_order_id', 'google_play_product_id']);
        });
    }
};
