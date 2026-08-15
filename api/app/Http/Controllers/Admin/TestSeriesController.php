<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreTestSeriesRequest;
use App\Http\Requests\Admin\UpdateTestSeriesRequest;
use App\Models\Test;
use App\Models\TestSeries;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TestSeriesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = TestSeries::with(['course:id,title', 'creator:id,name'])
            ->withCount('tests');

        if ($request->has('exam_category')) {
            $query->where('exam_category', $request->exam_category);
        }

        if ($request->has('published')) {
            $query->where('is_published', filter_var($request->published, FILTER_VALIDATE_BOOLEAN));
        }

        $seriesList = $query->orderBy('sort_order')->latest()->get();

        return response()->json($seriesList);
    }

    public function store(StoreTestSeriesRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['slug'] = Str::slug($data['title']) . '-' . Str::random(5);
        $data['created_by'] = $request->user()->id;

        $series = TestSeries::create($data);

        AuditService::log('test_series.created', $series, null, $series->toArray());

        return response()->json([
            'message' => 'Test series created successfully.',
            'series' => $series->load(['course:id,title', 'creator:id,name']),
        ], 201);
    }

    public function show(TestSeries $series): JsonResponse
    {
        $series->load([
            'course:id,title',
            'creator:id,name',
            'tests' => function ($q) {
                $q->orderBy('series_sort_order');
            },
        ]);

        return response()->json($series);
    }

    public function update(UpdateTestSeriesRequest $request, TestSeries $series): JsonResponse
    {
        $oldData = $series->toArray();
        $data = $request->validated();

        if (isset($data['title']) && $data['title'] !== $series->title) {
            $data['slug'] = Str::slug($data['title']) . '-' . Str::random(5);
        }

        $series->update($data);

        AuditService::log('test_series.updated', $series, $oldData, $series->toArray());

        return response()->json([
            'message' => 'Test series updated successfully.',
            'series' => $series->load(['course:id,title', 'creator:id,name']),
        ]);
    }

    public function destroy(TestSeries $series): JsonResponse
    {
        $oldData = $series->toArray();
        
        // Reset attached tests to series_id null
        Test::where('test_series_id', $series->id)->update([
            'test_series_id' => null,
            'series_sort_order' => 0,
        ]);

        $series->delete();

        AuditService::log('test_series.deleted', $series, $oldData, null);

        return response()->json(['message' => 'Test series deleted successfully.']);
    }

    public function publish(TestSeries $series): JsonResponse
    {
        if ($series->tests()->count() === 0) {
            return response()->json([
                'message' => 'Cannot publish a test series with zero tests attached.',
            ], 422);
        }

        $oldData = $series->toArray();
        $series->update(['is_published' => true]);

        AuditService::log('test_series.published', $series, $oldData, $series->toArray());

        // Fan a "new test series" notification out to enrolled students of the
        // series' course. No course → no audience, so skip silently.
        if ($series->course_id) {
            \App\Jobs\FanOutContentNotification::dispatch(
                'series',
                $series->id,
                $series->title,
                $series->course_id,
                null,
                $series->id,
            );
        }

        return response()->json([
            'message' => 'Test series published successfully.',
            'series' => $series,
        ]);
    }

    public function unpublish(TestSeries $series): JsonResponse
    {
        $oldData = $series->toArray();
        $series->update(['is_published' => false]);

        AuditService::log('test_series.unpublished', $series, $oldData, $series->toArray());

        return response()->json([
            'message' => 'Test series unpublished successfully.',
            'series' => $series,
        ]);
    }

    public function syncTests(Request $request, TestSeries $series): JsonResponse
    {
        $request->validate([
            'tests' => ['required', 'array'],
            'tests.*.test_id' => ['required', 'exists:tests,id'],
            'tests.*.series_sort_order' => ['nullable', 'integer'],
            'tests.*.category' => ['nullable', 'string'],
            'tests.*.is_free' => ['nullable', 'boolean'],
        ]);

        $attachedIds = [];

        foreach ($request->tests as $index => $item) {
            $test = Test::findOrFail($item['test_id']);
            $test->update([
                'test_series_id' => $series->id,
                'series_sort_order' => $item['series_sort_order'] ?? ($index + 1),
                'category' => $item['category'] ?? $test->category ?? 'full_mock',
                'is_free' => $item['is_free'] ?? $test->is_free ?? false,
            ]);
            $attachedIds[] = $test->id;
        }

        // Optional detachment of tests not in the payload if detach missing is true
        if ($request->boolean('detach_missing', false)) {
            Test::where('test_series_id', $series->id)
                ->whereNotIn('id', $attachedIds)
                ->update([
                    'test_series_id' => null,
                    'series_sort_order' => 0,
                ]);
        }

        AuditService::log('test_series.tests_synced', $series, null, ['attached_count' => count($attachedIds)]);

        return response()->json([
            'message' => 'Tests attached and ordered successfully.',
            'series' => $series->load(['tests' => function ($q) {
                $q->orderBy('series_sort_order');
            }]),
        ]);
    }
}
