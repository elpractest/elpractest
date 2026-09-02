<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Let a payment be for a product rather than only for a batch.
 *
 * `course_id` and `batch_id` were both NOT NULL, which is precisely why nothing
 * except a batch could ever be sold. They become nullable so a series or bundle
 * purchase has somewhere to land; every existing row keeps its values and the
 * batch rail behaves exactly as before, so invoices, refunds, the Razorpay
 * webhook and the Google Play rail all keep working untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('user_id')
                ->constrained()->nullOnDelete();
        });

        // Separate closure: on SQLite a ->change() rebuilds the table, and doing
        // that in the same blueprint as the new foreign key confuses the order.
        Schema::table('payments', function (Blueprint $table) {
            $table->unsignedBigInteger('course_id')->nullable()->change();
            $table->unsignedBigInteger('batch_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropColumn('product_id');
        });
    }
};
