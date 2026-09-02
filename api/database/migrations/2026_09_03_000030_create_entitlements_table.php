<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `entitlements` — what a user currently holds.
 *
 * Rows are RESOLVED, not deferred: buying a bundle writes one row per item, so
 * every read site is a flat lookup instead of a bundle expansion. The trade is
 * deliberate — editing a bundle later does not retroactively give past buyers
 * the newly added items, which is also the honest reading of "they bought what
 * was in the box".
 *
 * `enrollments` is untouched and still authoritative for cohort membership and
 * batch capacity. EntitlementService reads BOTH, so the legacy batch rail keeps
 * working unchanged while new purchases flow through here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entitlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // App\Models\Course | App\Models\TestSeries
            $table->string('grantable_type');
            $table->unsignedBigInteger('grantable_id');

            // Provenance. product_id is null for a manual/admin grant or a
            // backfilled legacy enrollment.
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('enrollment_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source'); // payment | activation_code | manual | backfill

            $table->timestamp('starts_at');
            $table->timestamp('expires_at')->nullable(); // null = perpetual
            $table->boolean('is_active')->default(true);
            $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // One live row per user per thing. Re-purchase extends the existing
            // row (updateOrCreate) rather than stacking duplicates, exactly as
            // enrollments already does for re-enrollment after expiry.
            $table->unique(['user_id', 'grantable_type', 'grantable_id'], 'entitlements_unique_grant');
            $table->index(['grantable_type', 'grantable_id']);
            $table->index(['user_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entitlements');
    }
};
