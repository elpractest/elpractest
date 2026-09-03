<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Passage;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Shared comprehension / data-interpretation passages (English RC sets,
 * DI tables and charts). Authoring stays a manual admin flow — low volume,
 * unlike the CSV path for plain questions: a course has a handful of these,
 * not hundreds.
 *
 * A passage optionally carries an IMAGE (a bar/pie/line chart, a map — the
 * exhibit several linked questions share) and/or a TABLE (rendered as a real
 * HTML table client-side, not baked into a picture — crisp at any zoom,
 * selectable, and it is, underneath, just numbers). Both are optional and
 * independent: an RC passage is text only, a DI set is usually a table OR a
 * chart, never both required.
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
        $validated = $this->validated($request);

        $imagePath = $request->hasFile('image')
            ? $request->file('image')->store('passage_images', 'public')
            : null;

        $passage = Passage::create([
            'title' => $validated['title'] ?? null,
            'body' => $validated['body'],
            'image_path' => $imagePath,
            'table_data' => $this->normalizedTable($validated['table'] ?? null),
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
        $validated = $this->validated($request, forUpdate: true);
        $oldValue = $passage->toArray();

        $newImagePath = $request->hasFile('image')
            ? $request->file('image')->store('passage_images', 'public')
            : null;

        // An explicit "remove the image" signal from the form, distinct from
        // "the field was not part of this submission" — a nullable file
        // input simply omits the key entirely when nothing is chosen, which
        // is why removal needs its own flag rather than being inferred.
        $removeImage = $request->boolean('remove_image');

        $passage->fill([
            'title' => $validated['title'] ?? $passage->title,
            'body' => $validated['body'] ?? $passage->body,
        ]);

        if ($request->has('table')) {
            $passage->table_data = $this->normalizedTable($validated['table'] ?? null);
        }

        if ($newImagePath) {
            $passage->image_path = $newImagePath;
        } elseif ($removeImage) {
            $passage->image_path = null;
        }

        $passage->save();

        if (($newImagePath || $removeImage) && $oldValue['image_path']) {
            Storage::disk('public')->delete($oldValue['image_path']);
        }

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

        if ($passage->image_path) {
            Storage::disk('public')->delete($passage->image_path);
        }

        $passage->delete();

        AuditService::log('passage.deleted', $passage, $oldValue, null);

        return response()->json(['message' => 'Passage deleted.']);
    }

    private function validated(Request $request, bool $forUpdate = false): array
    {
        $bodyRule = $forUpdate ? ['sometimes', 'required', 'string'] : ['required', 'string'];

        return $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'body' => $bodyRule,
            'image' => ['nullable', 'image', 'max:4096', 'mimes:jpeg,png,jpg,webp'],
            'remove_image' => ['nullable', 'boolean'],
            // A flat grid — headers plus rows of the same width. No cell
            // typing, no merged cells, no formatting: a DI table is numbers
            // and short labels, and a plain grid is what every real one
            // actually is.
            'table' => ['nullable', 'array'],
            'table.headers' => ['required_with:table', 'array', 'min:1'],
            'table.headers.*' => ['nullable', 'string', 'max:100'],
            'table.rows' => ['required_with:table', 'array', 'min:1'],
            'table.rows.*' => ['array'],
            'table.rows.*.*' => ['nullable', 'string', 'max:200'],
        ]);
    }

    /**
     * Empty headers/rows (every cell blanked out by the admin) collapse to
     * null rather than being stored as a table of nothing — the student-
     * facing panel decides whether to render a table purely on "is this
     * null", so a technically-present-but-empty grid would draw an empty
     * box above the linked questions.
     */
    private function normalizedTable(?array $table): ?array
    {
        if (!$table) {
            return null;
        }

        $headers = array_values(array_filter($table['headers'] ?? [], fn ($h) => trim((string) $h) !== ''));
        $rows = array_values(array_filter($table['rows'] ?? [], function ($row) {
            return is_array($row) && array_filter($row, fn ($c) => trim((string) $c) !== '') !== [];
        }));

        if ($headers === [] || $rows === []) {
            return null;
        }

        return ['headers' => $headers, 'rows' => $rows];
    }
}
