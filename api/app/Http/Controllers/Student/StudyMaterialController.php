<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\MaterialAnnotation;
use App\Models\ReadingProgress;
use App\Models\StudyMaterial;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * The student's side of the study-material shelf: what may I read, what is this
 * one, and give me the bytes.
 *
 * Access is asked exactly once, in `mayRead()`, and every action goes through
 * it. That is the lesson EntitlementService records about the test-start hole:
 * a listing that filters and an action that does not check are the same bug in
 * different clothes, so the file stream re-asks rather than assuming the
 * student could only have got the id from a list that was already filtered.
 */
class StudyMaterialController extends Controller
{
    /**
     * Everything the student can open.
     *
     * Carries each material's own reading progress so the shelf shows a
     * "resume on page 24" line without a round trip per card.
     */
    public function index(EntitlementService $entitlements): JsonResponse
    {
        $user = auth()->user();
        $courseIds = $entitlements->courseIds($user);

        $materials = StudyMaterial::published()
            ->whereIn('course_id', $courseIds)
            ->with(['course:id,title,exam_category', 'module:id,title'])
            ->orderBy('course_id')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $progress = ReadingProgress::where('user_id', $user->id)
            ->whereIn('study_material_id', $materials->pluck('id'))
            ->get()
            ->keyBy('study_material_id');

        $materials->each(function (StudyMaterial $m) use ($progress) {
            $m->setAttribute('reading_progress', $this->progressPayload($progress->get($m->id)));
        });

        return response()->json([
            'materials' => $materials->values(),
            'subjects' => $materials->pluck('subject')->filter()->unique()->sort()->values(),
            'total' => $materials->count(),
        ]);
    }

    /**
     * The materials attached to one course, in outline order.
     *
     * Separate from index() so the course outline can ask for just its own
     * rather than filtering a whole library client-side.
     */
    public function forCourse(Course $course, EntitlementService $entitlements): JsonResponse
    {
        if (! $entitlements->hasCourse(auth()->user(), $course->id)) {
            return response()->json([
                'message' => 'You are not enrolled in this course or your access has expired.',
            ], 403);
        }

        $materials = StudyMaterial::published()
            ->where('course_id', $course->id)
            ->with('module:id,title')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $progress = ReadingProgress::where('user_id', auth()->id())
            ->whereIn('study_material_id', $materials->pluck('id'))
            ->get()
            ->keyBy('study_material_id');

        $materials->each(function (StudyMaterial $m) use ($progress) {
            $m->setAttribute('reading_progress', $this->progressPayload($progress->get($m->id)));
        });

        return response()->json(['materials' => $materials->values()]);
    }

    /**
     * Everything the reader needs to draw a first frame, in one call: the
     * material, where the student left off, and their marks on it.
     *
     * One round trip rather than three, because the reader cannot render
     * without all three and three sequential requests over a phone connection
     * is what a blank reader looks like.
     */
    public function show(StudyMaterial $material, EntitlementService $entitlements): JsonResponse
    {
        if (! $this->mayRead($material, $entitlements)) {
            return response()->json([
                'message' => 'You do not have access to this study material.',
            ], 403);
        }

        $material->load(['course:id,title,exam_category', 'module:id,title']);

        $progress = ReadingProgress::where('user_id', auth()->id())
            ->where('study_material_id', $material->id)
            ->first();

        $annotations = MaterialAnnotation::where('user_id', auth()->id())
            ->where('study_material_id', $material->id)
            ->orderBy('page')
            ->orderBy('id')
            ->get();

        return response()->json([
            'material' => $material,
            'progress' => $this->progressPayload($progress),
            'annotations' => $annotations,
        ]);
    }

    /**
     * Stream the PDF itself.
     *
     * `inline`, not `attachment`: this feeds the in-app reader, and an
     * attachment disposition makes some browsers offer a download instead of
     * handing the bytes to the fetch that asked for them. On a cloud disk we
     * hand back a short-lived signed URL rather than pulling tens of megabytes
     * through the PHP worker.
     */
    public function file(StudyMaterial $material, EntitlementService $entitlements): Response
    {
        if (! $this->mayRead($material, $entitlements)) {
            return response()->json([
                'message' => 'You do not have access to this study material.',
            ], 403);
        }

        $diskName = config('studymaterials.disk');
        $disk = Storage::disk($diskName);

        if (! $disk->exists($material->file_path)) {
            return response()->json(['message' => 'This file is no longer available.'], 404);
        }

        // Cloud drivers: redirect to a signed URL. Local: BinaryFileResponse,
        // which honours Range, so a reader can fetch part of a large PDF
        // without pulling the whole file.
        if (! in_array($diskName, ['local', 'public'], true)) {
            try {
                return redirect()->away($disk->temporaryUrl(
                    $material->file_path,
                    now()->addMinutes((int) config('studymaterials.signed_url_minutes'))
                ));
            } catch (\Throwable $e) {
                // Driver cannot sign, or is misconfigured — fall through.
                report($e);
            }
        }

        return response()->file($disk->path($material->file_path), [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.addslashes($material->title).'.pdf"',
            'X-Content-Type-Options' => 'nosniff',
            // Private: the body is a paid asset scoped to one student, and a
            // shared cache holding it would serve it to the next one.
            'Cache-Control' => 'private, max-age=0, must-revalidate',
        ]);
    }

    /**
     * May this student open this material?
     *
     * A free-preview material is open to any signed-in student — that is what
     * makes it a sample. Everything else needs a live entitlement to the course
     * it hangs off.
     */
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

    /**
     * A progress row in the reader's shape, with a missing row rendered as a
     * fresh start rather than as null — so the client never branches on it.
     */
    private function progressPayload(?ReadingProgress $progress): array
    {
        return [
            'current_page' => $progress->current_page ?? 1,
            'percent_complete' => $progress->percent_complete ?? 0,
            'seconds_read' => $progress->seconds_read ?? 0,
            'bookmarks' => $progress->bookmarks ?? [],
            'last_read_at' => $progress?->last_read_at?->toIso8601String(),
        ];
    }
}
