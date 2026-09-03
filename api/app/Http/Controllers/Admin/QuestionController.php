<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreQuestionRequest;
use App\Http\Requests\Admin\UpdateQuestionRequest;
use App\Jobs\ImportQuestionsJob;
use App\Services\ItemAnalysisService;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class QuestionController extends Controller
{
    /**
     * Display a paginated list of active questions.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Question::with('options')->active();

        if ($request->filled('subject')) {
            $query->bySubject($request->subject);
        }

        if ($request->filled('topic')) {
            $query->byTopic($request->topic);
        }

        if ($request->filled('difficulty')) {
            $query->byDifficulty($request->difficulty);
        }

        if ($request->filled('exam_tag')) {
            $query->whereJsonContains('exam_tags', $request->exam_tag);
        }

        if ($request->filled('status')) {
            $query->byStatus($request->status);
        }

        // Reviewers need to find the broken items, not scroll for them. A
        // negative discrimination index is the single highest-value filter in
        // the whole admin: those are the questions whose key is probably wrong.
        if ($request->boolean('flagged')) {
            $query->where('stats_sample_size', '>=', Question::MIN_STATS_SAMPLE)
                  ->where(function ($q) {
                      $q->where('discrimination_index', '<', 0.15)
                        ->orWhere('difficulty_index', '>', 0.95)
                        ->orWhere('difficulty_index', '<', 0.15);
                  });
        }

        if ($request->filled('search')) {
            $query->where('question_text', 'like', '%' . $request->search . '%');
        }

        $questions = $query->latest()->paginate(20);

        return response()->json($questions);
    }

    /**
     * Store a new question with options.
     */
    public function store(StoreQuestionRequest $request): JsonResponse
    {
        $imagePath = $request->hasFile('image')
            ? $request->file('image')->store('question_images', 'public')
            : null;

        $question = DB::transaction(function () use ($request, $imagePath) {
            $question = Question::create([
                'subject' => $request->subject,
                'topic' => $request->topic,
                'difficulty' => $request->difficulty,
                'exam_tags' => $request->exam_tags,
                'question_text' => $request->question_text,
                'image_path' => $imagePath,
                'explanation' => $request->explanation,
                'marks' => $request->marks,
                'negative_marks' => $request->negative_marks,
                'is_active' => true,
                'created_by' => $request->user()->id,
                'question_type' => $request->input('question_type', Question::TYPE_SINGLE_CHOICE),
                'numeric_answer' => $request->input('numeric_answer'),
                'numeric_tolerance' => $request->input('numeric_tolerance', 0),
                'passage_id' => $request->input('passage_id'),
            ]);

            // Numeric questions carry no options at all.
            foreach ($request->input('options', []) as $index => $optionData) {
                $optionImage = $request->hasFile("options.{$index}.image")
                    ? $request->file("options.{$index}.image")->store('option_images', 'public')
                    : null;

                QuestionOption::create([
                    'question_id' => $question->id,
                    'label' => strtolower($optionData['label']),
                    'option_text' => $optionData['option_text'] ?? '',
                    'image_path' => $optionImage,
                    'is_correct' => $optionData['is_correct'],
                    'sort_order' => $index,
                ]);
            }

            return $question;
        });

        $question->load('options');

        AuditService::log('question.created', $question, null, $question->toArray());

        return response()->json([
            'message' => 'Question created successfully.',
            'question' => $question,
        ], 201);
    }

    /**
     * Display the specified question.
     */
    public function show(Question $question): JsonResponse
    {
        return response()->json($question->load(['options', 'createdBy']));
    }

    /**
     * Update the specified question and its options.
     */
    public function update(UpdateQuestionRequest $request, Question $question): JsonResponse
    {
        $oldValue = $question->load('options')->toArray();

        // Old per-option image files, keyed by the OLD row's sort position —
        // the closest thing to identity these rows have, since options carry
        // no id in the payload and are about to be deleted wholesale below.
        // Used only to know which files are now orphaned once the new set
        // is written; a genuinely reordered option keeping its picture is
        // handled by the frontend resending that image's own path, not by
        // this positional guess.
        $previousOptionImages = $question->options()->pluck('image_path', 'sort_order');

        $newImagePath = $request->hasFile('image')
            ? $request->file('image')->store('question_images', 'public')
            : null;
        // Distinct from "no new file" — a nullable file input simply omits
        // its key when nothing is chosen, so removing the picture entirely
        // (as opposed to leaving it alone) needs its own explicit signal.
        $removeImage = $request->boolean('remove_image');

        $updatedQuestion = DB::transaction(function () use ($request, $question, $newImagePath, $removeImage) {
            $question->update($request->only([
                'subject',
                'topic',
                'difficulty',
                'exam_tags',
                'question_text',
                'explanation',
                'marks',
                'negative_marks',
                'question_type',
                'numeric_answer',
                'numeric_tolerance',
                'passage_id',
            ]));

            if ($newImagePath) {
                $question->update(['image_path' => $newImagePath]);
            } elseif ($removeImage) {
                $question->update(['image_path' => null]);
            }

            if ($request->has('options')) {
                // Delete existing options
                $question->options()->delete();

                // Recreate options. An option's image is either a fresh
                // upload, or the SAME path the form sent back for an
                // untouched image (see StoreQuestionRequest — options are
                // replaced wholesale, so "leave it alone" has to be spelled
                // out explicitly rather than implied by omission).
                foreach ($request->options as $index => $optionData) {
                    $optionImage = $request->hasFile("options.{$index}.image")
                        ? $request->file("options.{$index}.image")->store('option_images', 'public')
                        : ($optionData['image_path'] ?? null);

                    QuestionOption::create([
                        'question_id' => $question->id,
                        'label' => strtolower($optionData['label']),
                        'option_text' => $optionData['option_text'] ?? '',
                        'image_path' => $optionImage,
                        'is_correct' => $optionData['is_correct'],
                        'sort_order' => $index,
                    ]);
                }
            }

            return $question;
        });

        // Cleanup, after the transaction has committed: the old question
        // image, if it was just replaced OR explicitly removed.
        $oldImagePath = $oldValue['image_path'] ?? null;
        if (($newImagePath || $removeImage) && $oldImagePath) {
            Storage::disk('public')->delete($oldImagePath);
        }

        // And any option image that existed before this save and is not
        // referenced by any option after it — genuinely removed, not just
        // reordered (a path still in use survives this diff untouched).
        if ($request->has('options')) {
            $stillUsed = $updatedQuestion->options()->pluck('image_path')->filter()->all();
            $orphaned = $previousOptionImages->filter()->reject(fn ($path) => in_array($path, $stillUsed, true));
            foreach ($orphaned as $path) {
                Storage::disk('public')->delete($path);
            }
        }

        $updatedQuestion->load('options');

        AuditService::log('question.updated', $updatedQuestion, $oldValue, $updatedQuestion->toArray());

        return response()->json([
            'message' => 'Question updated successfully.',
            'question' => $updatedQuestion,
        ]);
    }

    /**
     * Soft-deactivate the question.
     */
    public function destroy(Question $question): JsonResponse
    {
        $oldValue = $question->toArray();
        $question->update(['is_active' => false]);

        AuditService::log('question.deactivated', $question, $oldValue, $question->toArray());

        return response()->json([
            'message' => 'Question deactivated successfully.',
        ]);
    }

    /**
     * Handle bulk CSV import of questions.
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'], // Max 10MB
            // Opt-out for a trusted, already-proofed batch. Absent = review queue.
            'auto_approve' => ['nullable', 'boolean'],
        ]);

        $status = $request->boolean('auto_approve')
            ? Question::STATUS_APPROVED
            : Question::STATUS_PENDING;

        $file = $request->file('file');

        // Check if file is empty or only contains headers
        $lines = file($file->getRealPath(), FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (count($lines) <= 1) {
            $jobUuid = (string) Str::uuid();
            Cache::put("import_status_{$jobUuid}", [
                'status' => 'complete',
                'imported' => 0,
                'errors' => [],
            ], 3600);

            return response()->json([
                'message' => 'Question import completed (empty file).',
                'job_id' => $jobUuid,
            ]);
        }
        
        // Save file temporarily
        $tempPath = $file->store('temp_imports');
        $jobUuid = (string) Str::uuid();

        // Put initial status in Cache
        Cache::put("import_status_{$jobUuid}", [
            'status' => 'pending',
            'imported' => 0,
            'errors' => [],
        ], 3600);

        // Dispatch queued job
        ImportQuestionsJob::dispatch($tempPath, $jobUuid, $request->user()->id, $status);

        return response()->json([
            'message' => 'Question import has been queued.',
            'job_id' => $jobUuid,
            'import_status' => $status,
        ]);
    }

    /**
     * Check the status of a queued import job.
     */
    public function importStatus(string $jobId): JsonResponse
    {
        $status = Cache::get("import_status_{$jobId}");

        if (!$status) {
            return response()->json([
                'message' => 'Import job not found or expired.',
            ], 404);
        }

        return response()->json($status);
    }

    /**
     * The exact CSV an admin needs to hand-edit and re-upload — same headers
     * `rules()` validates against, with worked examples of every question_type
     * and the image/passage columns (including an option-image-only reasoning
     * row). Served from disk rather than generated on the fly so what an admin
     * downloads is the same file this app's own tests import against.
     */
    public function downloadTemplate(): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $path = storage_path('app/templates/question_import_sample.csv');

        abort_unless(is_file($path), 404, 'Sample template is missing from this deployment.');

        return response()->download($path, 'question_import_sample.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }

    /**
     * Move a question through the review workflow.
     *
     * Approving is the only transition that lets a question reach a candidate,
     * and it is recorded with a reviewer and a timestamp so a bad key can be
     * traced back to who signed it off.
     */
    public function review(Request $request, Question $question): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', Question::STATUSES)],
            'review_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $oldValue = $question->toArray();

        $question->update([
            'status' => $validated['status'],
            'review_note' => $validated['review_note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        AuditService::log('question.reviewed', $question, $oldValue, $question->toArray());

        return response()->json([
            'message' => "Question marked {$validated['status']}.",
            'question' => $question->fresh('options'),
        ]);
    }

    /**
     * Item analysis for one question, computed live from raw attempt data:
     * difficulty index, point-biserial discrimination and distractor breakdown.
     */
    public function itemAnalysis(Question $question, ItemAnalysisService $service): JsonResponse
    {
        $analysis = $service->analyse($question->id);

        if ($analysis === null) {
            return response()->json([
                'message' => 'This question has no recorded attempts yet.',
                'analysis' => null,
            ]);
        }

        return response()->json(['analysis' => $analysis]);
    }
}
