<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One immutable invoice per captured payment.
 *
 * Seller details (name, address, GSTIN, state) are SNAPSHOTTED here rather
 * than read from settings at render time: an invoice is a legal record of what
 * was issued on a date, and an institute later changing its address or
 * registering for GST must not silently rewrite every receipt it ever gave a
 * student.
 *
 * Numbering is sequential per Indian financial year (Apr-Mar) and carries a
 * unique index, so a duplicate number is impossible even if two payments are
 * captured in the same instant.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->string('invoice_number');
            $table->string('financial_year', 9);   // e.g. "2026-27"
            $table->unsignedInteger('sequence');
            $table->timestamp('issued_at');

            // Seller snapshot at issue time.
            $table->string('seller_name');
            $table->text('seller_address')->nullable();
            $table->string('seller_gstin')->nullable();
            $table->string('seller_state')->nullable();
            $table->string('sac_code')->nullable();

            // Buyer snapshot (a later profile edit must not alter the record).
            $table->string('buyer_name');
            $table->string('buyer_email')->nullable();

            $table->string('description');

            // All money in paise, consistent with payments.amount.
            // The charged total is GST-INCLUSIVE (Indian retail convention:
            // the listed price is what the student actually pays), so the
            // taxable value is back-calculated from it.
            $table->unsignedInteger('total_paise');
            $table->unsignedInteger('taxable_paise');
            $table->decimal('gst_rate', 5, 2)->default(0);
            $table->unsignedInteger('cgst_paise')->default(0);
            $table->unsignedInteger('sgst_paise')->default(0);
            $table->unsignedInteger('igst_paise')->default(0);

            // Only a GST-registered seller may issue a "Tax Invoice"; everyone
            // else issues a plain payment receipt.
            $table->boolean('is_tax_invoice')->default(false);

            $table->timestamps();

            $table->unique(['financial_year', 'sequence']);
            $table->unique('invoice_number');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
