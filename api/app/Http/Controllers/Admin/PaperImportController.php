<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Question;
use App\Services\AuditService;
use App\Services\PaperImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Door B — upload a whole paper.
 *
 * Two parts: a CSV of the questions in exam order, and a `meta` JSON block
 * carrying the pattern (timing, sections, cutoffs, negative marking, shifts,
 * instructions) plus any passages the questions read.
 *
 * Always called twice in practice — once with `dry_run` to see what would
 * happen, then again to commit — because this is the one importer that writes
 * to the question bank and the test builder in the same breath.
 */
class PaperImportController extends Controller
{
    public function __construct(
        private readonly PaperImportService $papers,
    ) {}

    public function import(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
            'meta' => ['required'],
            'dry_run' => ['nullable', 'boolean'],
        ]);

        $meta = $this->decodeMeta($request->input('meta'));

        if ($meta === null) {
            return response()->json([
                'message' => 'The meta field is not valid JSON.',
                'errors' => ['meta' => ['Could not parse the meta block as JSON.']],
            ], 422);
        }

        $validator = validator($meta, $this->metaRules(), $this->metaMessages());

        if ($validator->fails()) {
            return response()->json([
                'message' => 'The paper meta is incomplete.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $rows = $this->readCsv($request->file('file')->getRealPath());

        if ($rows === null) {
            return response()->json([
                'message' => 'The CSV has no header row.',
                'errors' => ['file' => ['The CSV has no header row.']],
            ], 422);
        }

        $report = $this->papers->dryRun($meta, $rows);

        if ($request->boolean('dry_run')) {
            return response()->json([
                'message' => $report['ok']
                    ? 'Paper validated. Nothing has been created yet.'
                    : 'The paper has problems that must be fixed first.',
                'dry_run' => true,
            ] + $report);
        }

        if (!$report['ok']) {
            return response()->json([
                'message' => 'The paper has problems that must be fixed first.',
                'dry_run' => false,
            ] + $report, 422);
        }

        $result = $this->papers->commit($meta, $rows, $request->user());

        AuditService::log('test.imported', $result['test'], null, [
            'imported_questions' => $result['imported'],
            'source_file' => $request->file('file')->getClientOriginalName(),
        ]);

        return response()->json([
            'message' => "Imported {$result['imported']} question(s) into a new draft paper.",
            'dry_run' => false,
            'test' => $result['test']->load('sections'),
            'imported' => $result['imported'],
        ] + $report, 201);
    }

    /**
     * `meta` arrives as a JSON string beside a multipart file upload (a
     * multipart body cannot carry nested JSON natively), or as an already
     * decoded array when a client sends it as a second file.
     */
    private function decodeMeta(mixed $raw): ?array
    {
        if (is_array($raw)) {
            return $raw;
        }

        $decoded = json_decode((string) $raw, true);

        return is_array($decoded) ? $decoded : null;
    }

    private function metaRules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],

            // SCOPE IS MANDATORY. EntitlementService::accessibleTestIds()
            // treats a test with no course, batch or series as visible to
            // everyone — so an unscoped import would silently publish a paid
            // previous-year paper to the entire internet.
            'test_series_id' => ['nullable', 'required_without:course_id', 'exists:test_series,id'],
            'course_id' => ['nullable', 'required_without:test_series_id', 'exists:courses,id'],
            'batch_id' => ['nullable', 'exists:batches,id'],

            'type' => ['nullable', Rule::in(['practice', 'mock'])],
            'category' => ['nullable', Rule::in(['full_mock', 'sectional', 'pyp', 'topic', 'current_affairs'])],
            'duration_minutes' => ['nullable', 'integer', 'min:1', 'max:600'],
            'max_attempts' => ['nullable', 'integer', 'min:1'],
            'instructions' => ['nullable', 'string'],
            'is_free' => ['nullable', 'boolean'],
            'auto_approve' => ['nullable', 'boolean'],
            'available_from' => ['nullable', 'date'],
            'available_until' => ['nullable', 'date', 'after:available_from'],

            // Exam pattern.
            'cutoff_marks' => ['nullable', 'numeric', 'min:0'],
            'cutoff_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'shuffle_questions' => ['nullable', 'boolean'],
            'shuffle_options' => ['nullable', 'boolean'],
            'shift_group' => ['nullable', 'string', 'max:255'],
            'shift_label' => ['nullable', 'string', 'max:255'],
            'normalization_method' => ['nullable', Rule::in(['none', 'equipercentile', 'zscore'])],

            // Taxonomy for every question in the file.
            'exam_code' => ['nullable', Rule::in(array_keys(config('exams.registry')))],
            'paper' => ['nullable', 'string', 'max:16'],
            'source' => ['nullable', Rule::in(array_keys(config('exams.sources')))],
            'year' => ['nullable', 'integer', 'min:1950', 'max:' . ((int) date('Y') + 1)],
            'shift' => ['nullable', 'string', 'max:16'],
            'medium' => ['nullable', Rule::in(array_keys(config('exams.mediums')))],

            // Default marks for the whole paper; a section or a row may override.
            'marks' => ['nullable', 'numeric', 'min:0'],
            'negative_marks' => ['nullable', 'numeric', 'min:0'],

            'sections' => ['required', 'array', 'min:1'],
            'sections.*.title' => ['required', 'string', 'max:255'],
            'sections.*.duration_minutes' => ['nullable', 'integer', 'min:1'],
            'sections.*.cutoff_marks' => ['nullable', 'numeric', 'min:0'],
            'sections.*.cutoff_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'sections.*.is_qualifying' => ['nullable', 'boolean'],
            'sections.*.marks' => ['nullable', 'numeric', 'min:0'],
            'sections.*.negative_marks' => ['nullable', 'numeric', 'min:0'],

            // Passages declared inline, so a DI or RC set arrives with its
            // paper instead of being hand-created first and referenced by id.
            'passages' => ['nullable', 'array'],
            'passages.*.ref' => ['required', 'string', 'max:64'],
            'passages.*.title' => ['nullable', 'string', 'max:255'],
            'passages.*.body' => ['nullable', 'string'],
            'passages.*.image_url' => ['nullable', 'url', 'max:2048'],
            'passages.*.table_data' => ['nullable', 'array'],
        ];
    }

    private function metaMessages(): array
    {
        return [
            'test_series_id.required_without' => 'A paper must belong to a test series or a course — '
                . 'an unscoped test is visible to every user on the platform.',
            'course_id.required_without' => 'A paper must belong to a test series or a course — '
                . 'an unscoped test is visible to every user on the platform.',
        ];
    }

    /**
     * Read the whole file up front.
     *
     * Row-at-a-time streaming would be leaner, but a dry run has to report on
     * the file as a whole (duplicate serials, sections with no rows) before
     * anything is written, and 10MB of CSV is the documented ceiling.
     *
     * @return array<int, array<string, string>>|null
     */
    private function readCsv(string $path): ?array
    {
        $handle = fopen($path, 'r');

        if ($handle === false) {
            return null;
        }

        $header = fgetcsv($handle);

        if ($header === false) {
            fclose($handle);

            return null;
        }

        // Excel writes a UTF-8 BOM that would otherwise become part of the
        // first column's name, quietly breaking `section` lookups.
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $header[0]);
        $header = array_map(fn ($h) => strtolower(trim((string) $h)), $header);

        $rows = [];

        while (($line = fgetcsv($handle)) !== false) {
            // Skip blank trailing lines rather than reporting them as errors.
            if ($line === [null] || (count($line) === 1 && trim((string) $line[0]) === '')) {
                continue;
            }

            $line = array_pad(array_slice($line, 0, count($header)), count($header), '');
            $rows[] = array_combine($header, array_map(fn ($v) => (string) $v, $line));
        }

        fclose($handle);

        return $rows;
    }

    /**
     * The CSV an admin edits, and the meta block beside it. Served from disk so
     * what they download is the same pair this app's own tests import against.
     */
    public function downloadTemplate(Request $request): mixed
    {
        $which = $request->query('part') === 'meta' ? 'meta.json' : 'sample.csv';

        $path = $which === 'meta.json'
            ? resource_path('templates/paper_import_meta.json')
            : resource_path('templates/paper_import_sample.csv');

        abort_unless(file_exists($path), 404);

        return response()->download($path, "paper_import_{$which}");
    }
}
