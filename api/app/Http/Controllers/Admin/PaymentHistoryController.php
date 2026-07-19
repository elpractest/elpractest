<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentHistoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $payments = Payment::with([
                'user:id,name,email',
                'batch:id,name,course_id',
                'batch.course:id,title',
                'coupon:id,code',
            ])
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return response()->json($payments);
    }
}
