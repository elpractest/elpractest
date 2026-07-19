<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GenerateActivationCodeRequest;
use App\Models\ActivationCode;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivationCodeController extends Controller
{
    /**
     * List all activation codes.
     */
    public function index(Request $request): JsonResponse
    {
        $codes = ActivationCode::with(['course', 'batch', 'generatedBy'])
            ->latest()
            ->paginate(15);

        return response()->json($codes);
    }

    /**
     * Generate bulk or single activation codes.
     */
    public function store(GenerateActivationCodeRequest $request): JsonResponse
    {
        $data = $request->validated();
        $count = $data['count'] ?? 1;

        $generatedCodes = [];

        for ($i = 0; $i < $count; $i++) {
            $code = ActivationCode::create([
                'code' => ActivationCode::generateUniqueCode(),
                'course_id' => $data['course_id'],
                'batch_id' => $data['batch_id'],
                'max_uses' => $data['max_uses'] ?? 1,
                'times_used' => 0,
                'expires_at' => $data['expires_at'] ?? null,
                'generated_by' => $request->user()->id,
            ]);

            $generatedCodes[] = $code;
        }

        AuditService::log('activation_codes.generated', null, null, [
            'course_id' => $data['course_id'],
            'batch_id' => $data['batch_id'],
            'count' => $count,
            'codes' => collect($generatedCodes)->pluck('code')->toArray(),
        ]);

        return response()->json([
            'message' => "Generated {$count} activation codes successfully.",
            'codes' => $generatedCodes,
        ], 201);
    }
}
