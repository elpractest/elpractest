<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    /**
     * List all settings, optionally filtered by group.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Setting::query();

        if ($request->has('group')) {
            $query->group($request->group);
        }

        $settings = $query->get()->mapWithKeys(function (Setting $setting) {
            return [$setting->key => $setting->typed_value];
        });

        return response()->json(['settings' => $settings]);
    }

    /**
     * Bulk-update settings.
     *
     * Expects: { "settings": { "key1": "value1", "key2": "value2" } }
     *
     * Each change is audit-logged with old and new values.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'settings' => ['required', 'array'],
            'settings.*' => ['nullable'],
        ]);

        $updated = [];

        foreach ($request->settings as $key => $value) {
            $setting = Setting::where('key', $key)->first();

            if (! $setting) {
                continue;
            }

            $oldValue = $setting->value;
            $newValue = is_array($value) ? json_encode($value) : (string) $value;

            // Only log and update if the value actually changed
            if ($oldValue !== $newValue) {
                AuditService::log(
                    'settings.updated',
                    $setting,
                    ['key' => $key, 'value' => $oldValue],
                    ['key' => $key, 'value' => $newValue],
                );

                $setting->update(['value' => $newValue]);
                $updated[$key] = $value;
            }
        }

        return response()->json([
            'message' => count($updated) > 0
                ? count($updated) . ' setting(s) updated successfully.'
                : 'No settings were changed.',
            'updated' => $updated,
        ]);
    }

    /**
     * Get public settings (branding + toggles).
     */
    public function publicIndex(): JsonResponse
    {
        $publicKeys = [
            'site_name', 'site_logo', 'site_favicon', 'primary_color', 'accent_color',
            'footer_text', 'contact_email', 'contact_phone',
            'payment_gateway_enabled', 'social_login_enabled', 'lms_video_enabled'
        ];

        $settings = \App\Models\Setting::whereIn('key', $publicKeys)->get()->mapWithKeys(function ($setting) {
            return [$setting->key => $setting->typed_value];
        });

        // The Google OAuth client id is not secret (it ships in every web page's
        // sign-in button); the mobile app needs it as google_sign_in's
        // serverClientId so its ID-token audience matches what the backend checks.
        // Prefer the mobile-specific client (Firebase project's web client).
        $googleClientId = config('services.google.mobile_client_id') ?: config('services.google.client_id');
        $settings = $settings->put('google_client_id', $googleClientId);

        // The exam list the admin dropdowns populate from. Served here rather
        // than duplicated in each frontend, so the UI can never offer a category
        // the API will reject -- which is exactly how the Course and Test Series
        // forms had already drifted apart. See config/exams.php.
        $settings = $settings->put('exam_categories', config('exams.categories'));

        // The question bank's finer taxonomy, served for the same reason the
        // categories are: the admin's exam/paper/medium dropdowns must offer
        // exactly what the API will accept. Registry entries carry their own
        // papers, so choosing an exam can narrow the paper list client-side
        // without a second round trip.
        $settings = $settings->put('exam_registry', config('exams.registry'));
        $settings = $settings->put('question_sources', config('exams.sources'));
        $settings = $settings->put('question_mediums', config('exams.mediums'));

        return response()->json(['settings' => $settings]);
    }
}
