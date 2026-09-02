<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Entitlement;
use App\Models\Product;
use App\Models\Test;
use App\Models\TestSeries;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The storefront, and the shelf of what the student already owns.
 *
 * One controller for both because they answer the same question from opposite
 * sides — "what can I buy" is "everything published, minus what I hold".
 */
class StoreController extends Controller
{
    public function __construct(
        private readonly EntitlementService $entitlements,
    ) {}

    /**
     * Everything on sale, each marked with whether this student already owns it.
     *
     * Owned products are returned rather than filtered out: hiding them makes a
     * bundle look like it vanished when a student buys one course inside it. The
     * app dims them instead, so the catalogue stays stable.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $courseIds = $this->entitlements->courseIds($user);
        $seriesIds = $this->entitlements->seriesIds($user);

        $products = Product::published()
            ->with(['items.grantable'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $payload = $products->map(function (Product $product) use ($courseIds, $seriesIds) {
            $items = $product->items->map(function ($item) use ($courseIds, $seriesIds) {
                $grantable = $item->grantable;
                $isCourse = $item->grantable_type === Course::class;

                return [
                    'kind' => $isCourse ? 'course' : 'test_series',
                    'id' => (int) $item->grantable_id,
                    'title' => $grantable?->title ?? 'Removed item',
                    'owned' => $isCourse
                        ? in_array((int) $item->grantable_id, $courseIds, true)
                        : in_array((int) $item->grantable_id, $seriesIds, true),
                ];
            });

            return [
                'id' => $product->id,
                'type' => $product->type,
                'title' => $product->title,
                'slug' => $product->slug,
                'short_description' => $product->short_description,
                'description' => $product->description,
                'exam_category' => $product->exam_category,
                'price_paise' => $product->price_paise,
                'list_price_paise' => $product->list_price_paise,
                'savings_percent' => $product->savings_percent,
                'access_days' => $product->access_days,
                'thumbnail_url' => $product->thumbnail_url,
                'items' => $items->values(),
                'item_count' => $items->count(),
                // Fully owned = every item held. A partially-owned bundle stays
                // buyable, because the rest of it is still worth something.
                'owned' => $items->isNotEmpty() && $items->every(fn ($i) => $i['owned']),
            ];
        });

        return response()->json(['products' => $payload->values()]);
    }

    /**
     * The student's library: everything they hold, whatever granted it.
     */
    public function library(Request $request): JsonResponse
    {
        $user = $request->user();

        $courses = Course::whereIn('id', $this->entitlements->courseIds($user))
            ->orderBy('sort_order')
            ->get()
            ->map(fn (Course $course) => [
                'kind' => 'course',
                'id' => $course->id,
                'title' => $course->title,
                'slug' => $course->slug,
                'exam_category' => $course->exam_category,
                'thumbnail_url' => $course->thumbnail_url,
                'expires_at' => $this->expiryFor($user->id, Course::class, $course->id),
            ]);

        $seriesIds = $this->entitlements->seriesIds($user);

        // One grouped count instead of a query per series.
        $testCounts = Test::catalogue()
            ->whereIn('test_series_id', $seriesIds)
            ->where('is_published', true)
            ->selectRaw('test_series_id, count(*) as total')
            ->groupBy('test_series_id')
            ->pluck('total', 'test_series_id');

        $series = TestSeries::whereIn('id', $seriesIds)
            ->orderBy('sort_order')
            ->get()
            ->map(fn (TestSeries $s) => [
                'kind' => 'test_series',
                'id' => $s->id,
                'title' => $s->title,
                'slug' => $s->slug,
                'exam_category' => $s->exam_category,
                'test_count' => (int) ($testCounts[$s->id] ?? 0),
                'expires_at' => $this->expiryFor($user->id, TestSeries::class, $s->id),
            ]);

        return response()->json([
            'courses' => $courses->values(),
            'test_series' => $series->values(),
            'total' => $courses->count() + $series->count(),
        ]);
    }

    /**
     * When this access runs out, or null for perpetual.
     *
     * Reads both rails, because access does. An activation-code redemption
     * writes an enrolment with no expiry, but a paid batch enrolment inherits
     * the batch's end date and an admin can set one by hand -- so reading only
     * entitlements would tell those students "Lifetime access" about something
     * that stops working next month.
     *
     * When both exist, the LATER wins: the student keeps access until every
     * grant they hold has lapsed, which is the same rule grantProduct() applies.
     */
    private function expiryFor(int $userId, string $type, int $id): ?string
    {
        $entitlement = Entitlement::live()
            ->where('user_id', $userId)
            ->where('grantable_type', $type)
            ->where('grantable_id', $id)
            ->first();

        $enrollmentExpiry = null;
        if ($type === Course::class) {
            $enrollments = \App\Models\Enrollment::active()
                ->where('user_id', $userId)
                ->where('course_id', $id)
                ->get();

            // A null expiry among them means perpetual access -- it outranks
            // every dated one, so stop there.
            if ($enrollments->isNotEmpty()) {
                if ($enrollments->contains(fn ($e) => $e->expires_at === null)) {
                    return null;
                }
                $enrollmentExpiry = $enrollments->max('expires_at');
            }
        }

        $entitlementExpiry = $entitlement?->expires_at;

        // A perpetual entitlement beats any dated enrolment.
        if ($entitlement && $entitlementExpiry === null) {
            return null;
        }

        $latest = collect([$entitlementExpiry, $enrollmentExpiry])->filter()->max();

        return $latest ? \Illuminate\Support\Carbon::parse($latest)->toIso8601String() : null;
    }
}
