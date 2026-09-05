<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Entitlement;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\Product;
use App\Models\QuestionPool;
use App\Models\Test;
use App\Models\TestSeries;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The single answer to "may this student use this?".
 *
 * Access used to be a WHERE clause copy-pasted into every listing endpoint, each
 * with its own slightly different idea of the rule — which is how the test-start
 * hole happened: the listing filtered by enrollment and the action did not check
 * at all. One service, and the question is asked the same way everywhere.
 *
 * It reads BOTH rails on purpose. `entitlements` is the new one; `enrollments`
 * is the live production rail with real students on it, and the batch checkout,
 * activation codes and admin enrolment all still write there. A hit on either
 * grants access, so nothing had to be cut over in a big bang.
 */
class EntitlementService
{
    /**
     * Courses this user may open right now.
     *
     * @return array<int>
     */
    public function courseIds(User $user): array
    {
        $fromEntitlements = Entitlement::live()
            ->where('user_id', $user->id)
            ->where('grantable_type', Course::class)
            ->pluck('grantable_id');

        $fromEnrollments = Enrollment::active()
            ->where('user_id', $user->id)
            ->pluck('course_id');

        return $fromEntitlements->merge($fromEnrollments)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Test series this user may open right now.
     *
     * Two routes in: a direct entitlement (bought the series, or a bundle
     * containing it), or the legacy path — a series assigned to a batch the
     * student is enrolled in, which is how every series reaches a student today.
     *
     * @return array<int>
     */
    public function seriesIds(User $user): array
    {
        $direct = Entitlement::live()
            ->where('user_id', $user->id)
            ->where('grantable_type', TestSeries::class)
            ->pluck('grantable_id');

        $batchIds = Enrollment::active()->where('user_id', $user->id)->pluck('batch_id')->filter();

        $viaAssignment = $batchIds->isEmpty()
            ? collect()
            : DB::table('assignments')
                ->where('is_active', true)
                ->whereIn('batch_id', $batchIds)
                ->where('assignable_type', TestSeries::class)
                ->pluck('assignable_id');

        return $direct->merge($viaAssignment)->filter()->unique()->values()->all();
    }

    /**
     * Question pools this user may practise from.
     *
     * Pools are the newer, additive rail: before them, practice access was
     * derived entirely from tests (you could drill a question only if it
     * appeared in a paper you had bought). That rule still holds — this widens
     * it, it does not replace it — so nobody's existing access changes.
     *
     * @return array<int>
     */
    public function poolIds(User $user): array
    {
        return Entitlement::live()
            ->where('user_id', $user->id)
            ->where('grantable_type', QuestionPool::class)
            ->pluck('grantable_id')
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * The live pools themselves, ready to be turned into a match query.
     *
     * @return Collection<int, QuestionPool>
     */
    public function accessiblePools(User $user): Collection
    {
        $ids = $this->poolIds($user);

        if ($ids === []) {
            return collect();
        }

        return QuestionPool::query()->active()->whereIn('id', $ids)->get();
    }

    /**
     * Batches this user sits in. Still enrolment-only: a batch is a cohort, not
     * a purchase, and buying a course product places the buyer in one.
     *
     * @return array<int>
     */
    public function batchIds(User $user): array
    {
        return Enrollment::active()
            ->where('user_id', $user->id)
            ->pluck('batch_id')
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public function hasCourse(User $user, int $courseId): bool
    {
        return in_array($courseId, $this->courseIds($user), true);
    }

    public function hasSeries(User $user, int $seriesId): bool
    {
        return in_array($seriesId, $this->seriesIds($user), true);
    }

    /**
     * May this student sit this paper?
     *
     * Order matters. A private practice paper is checked first because it
     * belongs to exactly one person and no other rule can grant it. Publication
     * and the availability window come next, and they are absolute — being free,
     * or owning the course, never releases an unpublished draft.
     */
    public function mayStartTest(User $user, Test $test): bool
    {
        // A student-generated practice paper: its owner, and nobody else.
        if ($test->owner_id !== null) {
            return $test->owner_id === $user->id;
        }

        if (!$test->is_published) {
            return false;
        }

        if ($test->available_from !== null && $test->available_from->isFuture()) {
            return false;
        }

        if ($test->available_until !== null && $test->available_until->isPast()) {
            return false;
        }

        // The free sample that sells the series.
        if ($test->is_free) {
            return true;
        }

        // Unscoped: belongs to no course, batch or series — platform-wide.
        if ($test->course_id === null && $test->batch_id === null && $test->test_series_id === null) {
            return true;
        }

        if ($test->course_id !== null && $this->hasCourse($user, $test->course_id)) {
            return true;
        }

        if ($test->batch_id !== null && in_array($test->batch_id, $this->batchIds($user), true)) {
            return true;
        }

        if ($test->test_series_id !== null && $this->hasSeries($user, $test->test_series_id)) {
            return true;
        }

        return false;
    }

    /**
     * Ids of every test this student may sit — the pool the practice console
     * draws its questions from, and the basis of the "available tests" listing.
     *
     * Excludes practice papers (theirs and everyone's): a generated paper is a
     * container, not source material, and letting one seed the next would let
     * the pool drift away from the content the student actually bought.
     *
     * @return array<int>
     */
    public function accessibleTestIds(User $user): array
    {
        $courseIds = $this->courseIds($user);
        $batchIds = $this->batchIds($user);
        $seriesIds = $this->seriesIds($user);

        return Test::query()
            ->whereNull('owner_id')
            ->where('is_published', true)
            ->where(function ($q) use ($courseIds, $batchIds, $seriesIds) {
                $q->whereIn('course_id', $courseIds)
                  ->orWhereIn('batch_id', $batchIds)
                  ->orWhereIn('test_series_id', $seriesIds)
                  ->orWhere('is_free', true)
                  ->orWhere(function ($sq) {
                      $sq->whereNull('course_id')
                         ->whereNull('batch_id')
                         ->whereNull('test_series_id');
                  });
            })
            ->pluck('id')
            ->all();
    }

    /**
     * Grant everything a product contains, as one transaction.
     *
     * Idempotent per grantable: buying the same product twice, or buying a
     * bundle that overlaps something already owned, extends the existing row
     * rather than stacking duplicates — the same shape Enrollment already uses
     * for re-enrolment after expiry. The later expiry always wins, so an overlap
     * can never shorten access the student has already paid for.
     *
     * @return Collection<int, Entitlement>
     */
    public function grantProduct(
        User $user,
        Product $product,
        string $source = Entitlement::SOURCE_PAYMENT,
        ?Payment $payment = null,
        ?User $grantedBy = null,
    ): Collection {
        $expiresAt = $product->access_days === null
            ? null
            : now()->addDays($product->access_days);

        return DB::transaction(function () use ($user, $product, $source, $payment, $grantedBy, $expiresAt) {
            $granted = collect();

            foreach ($product->items()->with('grantable')->get() as $item) {
                $existing = Entitlement::where('user_id', $user->id)
                    ->where('grantable_type', $item->grantable_type)
                    ->where('grantable_id', $item->grantable_id)
                    ->first();

                // Never trade a longer grant for a shorter one. A perpetual
                // grant (null) outranks every dated one.
                $resolvedExpiry = $expiresAt;
                if ($existing) {
                    if ($existing->expires_at === null || $expiresAt === null) {
                        $resolvedExpiry = null;
                    } else {
                        $resolvedExpiry = $existing->expires_at->gt($expiresAt)
                            ? $existing->expires_at
                            : $expiresAt;
                    }
                }

                $entitlement = Entitlement::updateOrCreate(
                    [
                        'user_id' => $user->id,
                        'grantable_type' => $item->grantable_type,
                        'grantable_id' => $item->grantable_id,
                    ],
                    [
                        'product_id' => $product->id,
                        'payment_id' => $payment?->id,
                        'source' => $source,
                        'starts_at' => $existing?->starts_at ?? now(),
                        'expires_at' => $resolvedExpiry,
                        'is_active' => true,
                        'granted_by' => $grantedBy?->id,
                    ]
                );

                // A course product also puts the buyer in a cohort, so batch
                // capacity, cohort analytics and the LMS keep working off the
                // enrolment they have always read.
                if ($item->grantable_type === Course::class) {
                    $this->placeInBatch($user, (int) $item->grantable_id, $item->batch_id, $payment, $entitlement);
                }

                $granted->push($entitlement);
            }

            return $granted;
        });
    }

    /**
     * Mirror a course entitlement into the legacy enrolment rail.
     *
     * Chooses the item's pinned batch, else the course's earliest active batch.
     * A course with no active batch still grants the entitlement — the student
     * gets the content — it simply records no cohort membership.
     */
    private function placeInBatch(
        User $user,
        int $courseId,
        ?int $batchId,
        ?Payment $payment,
        Entitlement $entitlement,
    ): void {
        $batch = $batchId
            ? \App\Models\Batch::find($batchId)
            : \App\Models\Batch::where('course_id', $courseId)->where('is_active', true)->orderBy('id')->first();

        if (!$batch) {
            return;
        }

        $enrollment = Enrollment::updateOrCreate(
            [
                'user_id' => $user->id,
                'course_id' => $courseId,
                'batch_id' => $batch->id,
            ],
            [
                'payment_id' => $payment?->id,
                'is_active' => true,
                'enrolled_at' => now(),
                'expires_at' => $entitlement->expires_at ?? $batch->ends_at,
            ]
        );

        $entitlement->update(['enrollment_id' => $enrollment->id]);
    }

    /**
     * Withdraw everything a payment granted — used when a payment is refunded.
     */
    public function revokeForPayment(Payment $payment): int
    {
        return Entitlement::where('payment_id', $payment->id)->update(['is_active' => false]);
    }
}
