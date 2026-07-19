<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class DefaultSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            // ── Branding ─────────────────────────────────────────
            ['key' => 'site_name', 'value' => 'Practest', 'group' => 'branding'],
            ['key' => 'site_logo', 'value' => '', 'group' => 'branding'],
            ['key' => 'site_favicon', 'value' => '', 'group' => 'branding'],
            ['key' => 'primary_color', 'value' => '#2563EB', 'group' => 'branding'],
            ['key' => 'accent_color', 'value' => '#7C3AED', 'group' => 'branding'],
            ['key' => 'footer_text', 'value' => '© ' . date('Y') . ' Practest. All rights reserved.', 'group' => 'branding'],

            // ── Contact & Social ─────────────────────────────────
            ['key' => 'contact_email', 'value' => '', 'group' => 'contact'],
            ['key' => 'contact_phone', 'value' => '', 'group' => 'contact'],
            ['key' => 'contact_address', 'value' => '', 'group' => 'contact'],
            ['key' => 'social_facebook', 'value' => '', 'group' => 'social'],
            ['key' => 'social_twitter', 'value' => '', 'group' => 'social'],
            ['key' => 'social_instagram', 'value' => '', 'group' => 'social'],
            ['key' => 'social_youtube', 'value' => '', 'group' => 'social'],
            ['key' => 'social_telegram', 'value' => '', 'group' => 'social'],

            // ── SEO ──────────────────────────────────────────────
            ['key' => 'seo_title', 'value' => 'Practest — Online Test Series for SSC, Banking & Government Exams', 'group' => 'seo'],
            ['key' => 'seo_description', 'value' => 'Practice mock tests for SSC CGL, SBI PO, IBPS, RRB, UPSC and State PCS exams with detailed analytics.', 'group' => 'seo'],

            // ── Analytics & Ads ──────────────────────────────────
            ['key' => 'gtm_container_id', 'value' => '', 'group' => 'analytics'],
            ['key' => 'ga4_measurement_id', 'value' => '', 'group' => 'analytics'],
            ['key' => 'meta_pixel_id', 'value' => '', 'group' => 'analytics'],

            // ── Feature Flags ────────────────────────────────────
            ['key' => 'payment_gateway_enabled', 'value' => 'false', 'group' => 'features'],
            ['key' => 'social_login_enabled', 'value' => 'false', 'group' => 'features'],
            ['key' => 'lms_video_enabled', 'value' => 'true', 'group' => 'features'],
        ];

        foreach ($settings as $setting) {
            Setting::firstOrCreate(
                ['key' => $setting['key']],
                ['value' => $setting['value'], 'group' => $setting['group']],
            );
        }
    }
}
