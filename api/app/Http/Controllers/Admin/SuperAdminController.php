<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Setting;
use App\Models\AuditLog;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SuperAdminController extends Controller
{
    /**
     * Get the current Admin account(s) details.
     */
    public function getAdmins(): JsonResponse
    {
        $admins = User::role('admin')->get(['id', 'name', 'email', 'phone', 'created_at']);
        return response()->json($admins);
    }

    /**
     * Create the single Admin account for the deployment.
     */
    public function createAdmin(Request $request): JsonResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        // Enforce hard-cap of exactly one Admin account per deployment
        if (User::role('admin')->exists()) {
            return response()->json([
                'message' => 'An Admin account already exists for this deployment.',
            ], 400);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => $request->password, // automatically hashed via User model cast
            'phone' => $request->phone,
        ]);
        
        $user->email_verified_at = now();
        $user->save();

        $user->assignRole('admin');

        AuditService::log(
            'admin.created',
            $user,
            null,
            $user->only(['id', 'name', 'email', 'phone'])
        );

        return response()->json([
            'message' => 'Admin account created successfully.',
            'admin' => $user->only(['id', 'name', 'email', 'phone', 'created_at']),
        ], 201);
    }

    /**
     * Reset the Admin password.
     */
    public function resetAdminPassword(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string', 'min:8'],
        ]);

        // Verify that target is indeed an admin (cannot reset student/super-admin)
        if (! $user->hasRole('admin')) {
            return response()->json([
                'message' => 'This password reset action is only allowed for Admin accounts.',
            ], 400);
        }

        $oldValues = ['id' => $user->id, 'email' => $user->email, 'password' => 'hidden'];

        $user->update([
            'password' => $request->password, // automatically hashed via model cast
        ]);

        AuditService::log(
            'admin.password_reset',
            $user,
            $oldValues,
            ['id' => $user->id, 'email' => $user->email]
        );

        return response()->json([
            'message' => 'Admin password has been reset successfully.',
        ]);
    }

    /**
     * Handle branding image upload (logo and favicon).
     */
    public function uploadBrandingImage(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'image', 'mimes:jpeg,png,jpg,gif,svg,ico', 'max:2048'],
            'type' => ['required', 'string', 'in:logo,favicon'],
        ]);

        $type = $request->type;
        $key = $type === 'logo' ? 'site_logo' : 'site_favicon';
        $setting = Setting::where('key', $key)->first();

        if (! $setting) {
            return response()->json([
                'message' => 'The branding setting was not found.',
            ], 404);
        }

        $oldValue = $setting->value;

        // Store file publicly
        $path = $request->file('file')->store('branding', 'public');
        $newUrl = Storage::url($path);

        $setting->update([
            'value' => $newUrl,
        ]);

        AuditService::log(
            'settings.branding_uploaded',
            $setting,
            ['key' => $key, 'value' => $oldValue],
            ['key' => $key, 'value' => $newUrl]
        );

        return response()->json([
            'message' => ucfirst($type) . ' uploaded successfully.',
            'url' => $newUrl,
        ]);
    }

    /**
     * Get platform-wide audit logs.
     */
    public function getAuditLogs(): JsonResponse
    {
        $logs = AuditLog::with('user')
            ->orderBy('id', 'desc')
            ->paginate(50);

        return response()->json($logs);
    }
}
