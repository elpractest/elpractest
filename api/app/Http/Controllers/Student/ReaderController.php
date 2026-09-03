<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\MaterialAnnotation;
use App\Models\ReadingProgress;
use App\Models\StudyMaterial;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * What the reader writes back: where the student is, and what they marked.
 *
 * Kept apart from StudyMaterialController on purpose. That one answers "what
 * may I read" and is read-only; this one is the write side, called on a timer
 * from an open reader. Splitting them keeps the throttle, the validation and
 * the failure behaviour of a background sync away from the endpoints a page
 * load depends on.
 *
 * Everything here fails quietly by design on the client: a sync that does not
 * land must never interrupt reading. That is why the responses are small and
 * why nothing here throws for a stale value.
 */
class ReaderController extends Controller
{
    /**
     * Save reading position for one material.
     *
     * `current_page` moves forward or backward freely — a student who flips
     * back to re-read a diagram means it, and clamping to a high-water mark
     * would strand them at the end of the book on the next open. What IS
     * clamped is `percent_complete`, which is a derived summary and only ever
     * grows: it feeds "how far through am I", and that number going down
     * because someone flipped back reads as lost work.
     */
    public function sync(Request $request, StudyMaterial $material, EntitlementService $entitlements): JsonResponse
    {
        if (! $this->mayRead($material, $entitlements)) {
            return response()->json(['message' => 'You do not have access to this study material.'], 403);
        }

        $validated = $request->validate([
            'current_page' => ['required', 'integer', 'min:1', 'max:20000'],
            'percent_complete' => ['nullable', 'integer', 'min:0', 'max:100'],
            'seconds_read' => ['nullable', 'integer', 'min:0', 'max:86400'],
            'bookmarks' => ['nullable', 'array', 'max:500'],
            'bookmarks.*' => ['integer', 'min:1', 'max:20000'],
        ]);

        $progress = ReadingProgress::firstOrNew([
            'user_id' => auth()->id(),
            'study_material_id' => $material->id,
        ]);

        $progress->current_page = $validated['current_page'];

        if (array_key_exists('percent_complete', $validated) && $validated['percent_complete'] !== null) {
            $progress->percent_complete = max($progress->percent_complete ?? 0, $validated['percent_complete']);
        }

        // seconds_read accumulates across sittings, so the client sends THIS
        // session's elapsed time and the server adds it. Sending a running
        // total instead would let two tabs open on the same book overwrite
        // each other with whichever closed last.
        if (! empty($validated['seconds_read'])) {
            $progress->seconds_read = ($progress->seconds_read ?? 0) + $validated['seconds_read'];
        }

        if (array_key_exists('bookmarks', $validated)) {
            $progress->bookmarks = collect($validated['bookmarks'] ?? [])
                ->unique()->sort()->values()->all();
        }

        $progress->last_read_at = now();
        $progress->save();

        return response()->json([
            'progress' => [
                'current_page' => $progress->current_page,
                'percent_complete' => $progress->percent_complete,
                'seconds_read' => $progress->seconds_read,
                'bookmarks' => $progress->bookmarks ?? [],
                'last_read_at' => $progress->last_read_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * This student's marks on one material.
     */
    public function annotations(StudyMaterial $material, EntitlementService $entitlements): JsonResponse
    {
        if (! $this->mayRead($material, $entitlements)) {
            return response()->json(['message' => 'You do not have access to this study material.'], 403);
        }

        return response()->json([
            'annotations' => MaterialAnnotation::where('user_id', auth()->id())
                ->where('study_material_id', $material->id)
                ->orderBy('page')
                ->orderBy('id')
                ->get(),
        ]);
    }

    /**
     * Create a highlight or a note.
     */
    public function storeAnnotation(Request $request, StudyMaterial $material, EntitlementService $entitlements): JsonResponse
    {
        if (! $this->mayRead($material, $entitlements)) {
            return response()->json(['message' => 'You do not have access to this study material.'], 403);
        }

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:'.implode(',', MaterialAnnotation::TYPES)],
            'color' => ['nullable', 'string', 'in:'.implode(',', MaterialAnnotation::COLORS)],
            'page' => ['required', 'integer', 'min:1', 'max:20000'],
            'selected_text' => ['nullable', 'string', 'max:5000'],
            'note' => ['nullable', 'string', 'max:5000'],
            // Normalised 0..1 page coordinates — see the migration for why they
            // are not pixels. Capped so one pathological selection cannot store
            // a megabyte of geometry.
            'rects' => ['nullable', 'array', 'max:400'],
            'rects.*.x' => ['required', 'numeric', 'min:-1', 'max:2'],
            'rects.*.y' => ['required', 'numeric', 'min:-1', 'max:2'],
            'rects.*.w' => ['required', 'numeric', 'min:0', 'max:2'],
            'rects.*.h' => ['required', 'numeric', 'min:0', 'max:2'],
        ]);

        $annotation = MaterialAnnotation::create([
            'user_id' => auth()->id(),
            'study_material_id' => $material->id,
            'type' => $validated['type'],
            'color' => $validated['color'] ?? 'yellow',
            'page' => $validated['page'],
            'selected_text' => $validated['selected_text'] ?? null,
            'note' => $validated['note'] ?? null,
            'rects' => $validated['rects'] ?? null,
        ]);

        return response()->json(['annotation' => $annotation], 201);
    }

    /**
     * Edit a note's body or recolour a highlight. Geometry and page are not
     * editable: a mark that moved would no longer be over the text it was made
     * on, and there is no gesture in the reader that asks for that.
     */
    public function updateAnnotation(Request $request, MaterialAnnotation $annotation): JsonResponse
    {
        if ($annotation->user_id !== auth()->id()) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $validated = $request->validate([
            'color' => ['nullable', 'string', 'in:'.implode(',', MaterialAnnotation::COLORS)],
            'note' => ['nullable', 'string', 'max:5000'],
        ]);

        $annotation->fill(array_filter($validated, fn ($v) => $v !== null));

        // A note cleared to empty is a legitimate edit, and array_filter above
        // drops nulls rather than empty strings, so this reads the raw input.
        if ($request->exists('note')) {
            $annotation->note = $request->input('note');
        }

        $annotation->save();

        return response()->json(['annotation' => $annotation]);
    }

    public function destroyAnnotation(MaterialAnnotation $annotation): JsonResponse
    {
        // 404 rather than 403 for someone else's annotation: the id space is
        // sequential, and "403" on one id and "404" on another tells an
        // enumerator which ids exist.
        if ($annotation->user_id !== auth()->id()) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $annotation->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    private function mayRead(StudyMaterial $material, EntitlementService $entitlements): bool
    {
        if (! $material->is_published) {
            return false;
        }

        if ($material->is_free_preview) {
            return true;
        }

        return $entitlements->hasCourse(auth()->user(), $material->course_id);
    }
}
