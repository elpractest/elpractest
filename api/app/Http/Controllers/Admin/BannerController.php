<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Super-admin CRUD for Home promo banners + a public read endpoint the
 * student app (and marketing site / mobile apps) consumes.
 *
 * Image handling mirrors the existing course-banner / branding uploads:
 * files are stored on the `public` disk and exposed through the model's
 * `image_url` accessor.
 */
class BannerController extends Controller
{
    private function rules(bool $creating): array
    {
        return [
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'kicker' => ['nullable', 'string', 'max:60'],
            'cta_label' => ['nullable', 'string', 'max:60'],
            'cta_url' => ['nullable', 'string', 'max:2048'],
            'exam_category' => ['nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ];
    }

    /** Super-admin: full list (active + inactive), in display order. */
    public function index(): JsonResponse
    {
        return response()->json(Banner::ordered()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules(true));
        $banner = Banner::create($data);

        AuditService::log('banner.created', $banner, [], $banner->toArray());

        return response()->json($banner, 201);
    }

    public function update(Request $request, Banner $banner): JsonResponse
    {
        $old = $banner->toArray();
        $banner->update($request->validate($this->rules(false)));

        AuditService::log('banner.updated', $banner, $old, $banner->toArray());

        return response()->json($banner);
    }

    public function destroy(Banner $banner): JsonResponse
    {
        $old = $banner->toArray();

        if ($banner->image_path) {
            Storage::disk('public')->delete($banner->image_path);
        }
        $banner->delete();

        AuditService::log('banner.deleted', $banner, $old, []);

        return response()->json(['message' => 'Banner deleted.']);
    }

    /** Upload / replace a banner image. */
    public function uploadImage(Request $request, Banner $banner): JsonResponse
    {
        // 16:9 is the ratio every banner surface renders at — the student
        // carousel, the Android carousel and the admin preview. Enforcing it
        // here rejects a bad crop at upload instead of letting it be discovered
        // on the student home screen.
        //
        // Laravel's ratio check is near-exact (its tolerance is ~1/avg-dimension,
        // so 1600x901 already fails), which is why the message names a concrete
        // size rather than asking for "roughly 16:9".
        $request->validate([
            'image' => [
                'required', 'image', 'mimes:jpeg,png,jpg,webp,gif', 'max:2048',
                'dimensions:ratio=16/9,min_width=1280',
            ],
        ], [
            'image.dimensions' => 'The banner must be exactly 16:9 and at least 1280px wide — 1920x1080 is the recommended size.',
        ]);

        $old = $banner->toArray();

        if ($banner->image_path) {
            Storage::disk('public')->delete($banner->image_path);
        }
        $path = $request->file('image')->store('banners', 'public');
        $banner->update(['image_path' => $path]);

        AuditService::log('banner.image_uploaded', $banner, $old, $banner->toArray());

        return response()->json([
            'message' => 'Banner image uploaded.',
            'image_url' => $banner->image_url,
        ]);
    }

    /** Persist a new display order: { ids: [3,1,2] }. */
    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:banners,id'],
        ]);

        foreach ($data['ids'] as $index => $id) {
            Banner::where('id', $id)->update(['sort_order' => $index]);
        }

        return response()->json(['message' => 'Order updated.']);
    }

    /**
     * Public: active banners only, in order, trimmed to what a client needs.
     * Mirrors SettingsController::publicIndex / PublicCourseController.
     */
    public function publicIndex(): JsonResponse
    {
        $banners = Banner::active()->ordered()->get()->map(fn (Banner $b) => [
            'id' => $b->id,
            'title' => $b->title,
            'subtitle' => $b->subtitle,
            'kicker' => $b->kicker,
            'cta_label' => $b->cta_label,
            'cta_url' => $b->cta_url,
            'image_url' => $b->image_url,
            'exam_category' => $b->exam_category,
        ]);

        return response()->json($banners);
    }
}
