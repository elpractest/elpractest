<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Http\Requests\Student\StoreDeviceTokenRequest;
use App\Models\DeviceToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * FCM v1.1 — device push-token registration.
 *
 * The Flutter app registers/refreshes its FCM token on login and on
 * onTokenRefresh, and deletes it on logout. A token is UNIQUE and reassigns
 * to the newest owner (shared/handed-down device) so pushes never leak to a
 * previous account. See docs/FCM_V1.1_SCOPE.md.
 */
class DeviceTokenController extends Controller
{
    /** Register or refresh the caller's device token. */
    public function store(StoreDeviceTokenRequest $request): JsonResponse
    {
        $data = $request->validated();

        // updateOrCreate on the unique token reassigns ownership if the token
        // was previously registered under a different user.
        DeviceToken::updateOrCreate(
            ['token' => $data['token']],
            [
                'user_id' => $request->user()->id,
                'platform' => $data['platform'] ?? 'android',
                'last_used_at' => now(),
            ]
        );

        return response()->json(['message' => 'Device registered.']);
    }

    /** Remove a device token (called on logout / unregister). */
    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:512'],
        ]);

        DeviceToken::where('user_id', $request->user()->id)
            ->where('token', $validated['token'])
            ->delete();

        return response()->json(['message' => 'Device removed.']);
    }
}
