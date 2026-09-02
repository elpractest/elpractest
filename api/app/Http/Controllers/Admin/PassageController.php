<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Passage;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Shared comprehension passages (English RC sets, etc). Authoring stays a
 * manual admin flow — low volume, unlike the CSV path for plain questions.
 */
class PassageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Passage::withCount('questions')->latest();

        if ($request->filled('search')) {
            $query->where('body', 'like', '%' . $request->search . '%')
                ->orWhere('title', 'like', '%' . $request->search . '%');
        }

        return response()->json($query->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'body' => ['required', 'string'],
        ]);

        $passage = Passage::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        AuditService::log('passage.created', $passage, null, $passage->toArray());

        return response()->json([
            'message' => 'Passage created successfully.',
            'passage' => $passage,
        ], 201);
    }

    public function show(Passage $passage): JsonResponse
    {
        return response()->json($passage->load('questions:id,question_text,passage_id'));
    }

    public function update(Request $request, Passage $passage): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'body' => ['sometimes', 'required', 'string'],
        ]);

        $oldValue = $passage->toArray();
        $passage->update($validated);

        AuditService::log('passage.updated', $passage, $oldValue, $passage->toArray());

        return response()->json([
            'message' => 'Passage updated successfully.',
            'passage' => $passage,
        ]);
    }

    /**
     * Refuses to delete a passage still linked to questions — those would be
     * left dangling mid-comprehension-set, not a state to make one click away.
     */
    public function destroy(Passage $passage): JsonResponse
    {
        if ($passage->questions()->exists()) {
            return response()->json([
                'message' => 'This passage still has questions linked to it. Unlink or delete them first.',
            ], 422);
        }

        $oldValue = $passage->toArray();
        $passage->delete();

        AuditService::log('passage.deleted', $passage, $oldValue, null);

        return response()->json(['message' => 'Passage deleted.']);
    }
}
