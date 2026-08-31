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
        $question = DB::transaction(function () use ($request) {
            $question = Question::create([
                'subject' => $request->subject,
                'topic' => $request->topic,
                'difficulty' => $request->difficulty,
                'exam_tags' => $request->exam_tags,
                'question_text' => $request->question_text,
                'explanation' => $request->explanation,
                'marks' => $request->marks,
                'negative_marks' => $request->negative_marks,
                'is_active' => true,
                'created_by' => $request->user()->id,
            ]);

            foreach ($request->options as $index => $optionData) {
                QuestionOption::create([
                    'question_id' => $question->id,
                    'label' => strtolower($optionData['label']),
                    'option_text' => $optionData['option_text'],
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

        $updatedQuestion = DB::transaction(function () use ($request, $question) {
            $question->update($request->only([
                'subject',
                'topic',
                'difficulty',
                'exam_tags',
                'question_text',
                'explanation',
                'marks',
                'negative_marks',
            ]));

            if ($request->has('options')) {
                // Delete existing options
                $question->options()->delete();

                // Recreate options
                foreach ($request->options as $index => $optionData) {
                    QuestionOption::create([
                        'question_id' => $question->id,
                        'label' => strtolower($optionData['label']),
                        'option_text' => $optionData['option_text'],
                        'is_correct' => $optionData['is_correct'],
                        'sort_order' => $index,
                    ]);
                }
            }

            return $question;
        });

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
