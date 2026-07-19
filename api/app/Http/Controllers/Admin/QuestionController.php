<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreQuestionRequest;
use App\Http\Requests\Admin\UpdateQuestionRequest;
use App\Jobs\ImportQuestionsJob;
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
        ]);

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
        ImportQuestionsJob::dispatch($tempPath, $jobUuid, $request->user()->id);

        return response()->json([
            'message' => 'Question import has been queued.',
            'job_id' => $jobUuid,
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
}
