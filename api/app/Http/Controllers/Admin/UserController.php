<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    /**
     * Display a listing of students, with optional query filters.
     * Used for the admin enrollment student-picker dropdown.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::role('student');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                  ->orWhere('email', 'like', '%' . $search . '%');
            });
        }

        $students = $query->select('id', 'name', 'email')->limit(50)->get();

        return response()->json($students);
    }
}
