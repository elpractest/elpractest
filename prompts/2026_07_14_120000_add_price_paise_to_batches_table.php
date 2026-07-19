<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            // NULL = not available for online purchase (activation code /
            // manual admin enrollment only).
            $table->integer('price_paise')->nullable()
                ->comment('Price in paise. NULL = not purchasable online.');
        });
    }

    public function down(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            $table->dropColumn('price_paise');
        });
    }
};
