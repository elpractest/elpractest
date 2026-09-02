<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Give every existing active enrollment an equivalent entitlement row.
 *
 * Without this, the day this ships every current student would still be served
 * by the legacy branch of EntitlementService and nothing would exercise the new
 * table until someone bought something. Backfilling means the new path is live
 * for real users immediately, and the legacy branch becomes the fallback it is
 * meant to be rather than the only path that ever runs.
 *
 * Idempotent: it inserts only what is missing, so re-running is a no-op.
 * Reversible: down() removes only rows this migration could have created
 * (source = 'backfill'), never a genuine purchase.
 */
return new class extends Migration
{
    public function up(): void
    {
        $enrollments = DB::table('enrollments')
            ->where('is_active', true)
            ->get(['id', 'user_id', 'course_id', 'enrolled_at', 'expires_at']);

        $now = now();

        foreach ($enrollments as $enrollment) {
            $exists = DB::table('entitlements')
                ->where('user_id', $enrollment->user_id)
                ->where('grantable_type', \App\Models\Course::class)
                ->where('grantable_id', $enrollment->course_id)
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('entitlements')->insert([
                'user_id' => $enrollment->user_id,
                'grantable_type' => \App\Models\Course::class,
                'grantable_id' => $enrollment->course_id,
                'product_id' => null,
                'payment_id' => null,
                'enrollment_id' => $enrollment->id,
                'source' => 'backfill',
                'starts_at' => $enrollment->enrolled_at ?? $now,
                'expires_at' => $enrollment->expires_at,
                'is_active' => true,
                'granted_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('entitlements')->where('source', 'backfill')->delete();
    }
};
