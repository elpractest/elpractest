<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A coupon had only a GLOBAL `max_uses`, so one code shared in a Telegram
 * group could be redeemed by every member until the pool ran dry. This caps
 * redemptions per student as well. Null = unlimited per user, which is the
 * existing behaviour, so every current coupon is unaffected.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('coupons', function (Blueprint $table) {
            $table->unsignedInteger('max_uses_per_user')->nullable()->after('max_uses');
        });
    }

    public function down(): void
    {
        Schema::table('coupons', function (Blueprint $table) {
            $table->dropColumn('max_uses_per_user');
        });
    }
};
