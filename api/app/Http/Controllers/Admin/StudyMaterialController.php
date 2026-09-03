<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreStudyMaterialRequest;
use App\Models\Course;
use App\Models\StudyMaterial;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

/**
 * Admin CRUD for the study-material shelf.
 *
 * Uploads land on the PRIVATE disk (config/studymaterials.php), never on
 * `public` — see the migration for why. Replacing or deleting a material
 * removes the old file so the disk does not accumulate orphans that no row
 * points at any more.
 */
class StudyMaterialController extends Controller
{
    public function index(Course $course): JsonResponse
    {
        return response()->json([
            'materials' => StudyMaterial::where('course_id', $course->id)
                ->with('module:id,title')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get(),
        ]);
    }

    public function store(StoreStudyMaterialRequest $request, Course $course): JsonResponse
    {
        $data = $request->validated();

        $file = $request->file('file');
        $path = $file->store(config('studymaterials.directory'), config('studymaterials.disk'));

        $material = StudyMaterial::create([
            'course_id' => $course->id,
            'module_id' => $data['module_id'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'subject' => $data['subject'] ?? null,
            'file_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'page_count' => $data['page_count'] ?? null,
            'sort_order' => $data['sort_order'] ?? 0,
            'is_free_preview' => $data['is_free_preview'] ?? false,
            'is_published' => $data['is_published'] ?? true,
        ]);

        AuditService::log('study_material.created', $material, null, $material->toArray());

        return response()->json([
            'message' => 'Study material uploaded successfully.',
            'material' => $material,
        ], 201);
    }

    public function update(StoreStudyMaterialRequest $request, StudyMaterial $material): JsonResponse
    {
        $data = $request->validated();
        $oldValue = $material->toArray();

        $material->fill([
            'module_id' => $data['module_id'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'subject' => $data['subject'] ?? null,
            'sort_order' => $data['sort_order'] ?? $material->sort_order,
            'is_free_preview' => $data['is_free_preview'] ?? false,
            'is_published' => $data['is_published'] ?? true,
        ]);

        if ($request->hasFile('file')) {
            $disk = Storage::disk(config('studymaterials.disk'));
            $previous = $material->file_path;

            $file = $request->file('file');
            $material->file_path = $file->store(config('studymaterials.directory'), config('studymaterials.disk'));
            $material->original_filename = $file->getClientOriginalName();
            $material->file_size = $file->getSize();
            // A replaced file is almost certainly a different length, so the
            // stored count is stale until the caller sends a new one or the
            // reader reports one back.
            $material->page_count = $data['page_count'] ?? null;

            // Delete only after the new path is in hand: a failed upload must
            // not leave the row pointing at a file that is already gone.
            if ($previous) {
                $disk->delete($previous);
            }
        } elseif (array_key_exists('page_count', $data) && $data['page_count'] !== null) {
            $material->page_count = $data['page_count'];
        }

        $material->save();

        AuditService::log('study_material.updated', $material, $oldValue, $material->toArray());

        return response()->json([
            'message' => 'Study material updated successfully.',
            'material' => $material,
        ]);
    }

    public function destroy(StudyMaterial $material): JsonResponse
    {
        $oldValue = $material->toArray();

        if ($material->file_path) {
            Storage::disk(config('studymaterials.disk'))->delete($material->file_path);
        }

        // Progress rows and annotations go with it via the cascade on their
        // foreign keys — a student's highlights on a deleted booklet have
        // nothing left to point at.
        $material->delete();

        AuditService::log('study_material.deleted', null, $oldValue, null);

        return response()->json(['message' => 'Study material deleted.']);
    }
}
