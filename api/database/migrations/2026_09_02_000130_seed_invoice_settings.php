<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Invoice/GST settings, created here rather than only in DefaultSettingsSeeder
 * because SettingsController::update() skips keys that do not already exist —
 * and seeding is a manual one-off in production while migrations autorun on
 * every deploy. Without this the admin could never save these fields.
 *
 * Defaults are deliberately blank: with no GSTIN the platform issues a plain
 * payment receipt, which is correct for an institute that is not GST-registered.
 */
return new class extends Migration
{
    private const SETTINGS = [
        ['key' => 'invoice_seller_name', 'value' => '', 'group' => 'invoicing'],
        ['key' => 'invoice_seller_address', 'value' => '', 'group' => 'invoicing'],
        ['key' => 'invoice_gstin', 'value' => '', 'group' => 'invoicing'],
        ['key' => 'invoice_seller_state', 'value' => '', 'group' => 'invoicing'],
        // 998431 = "on-line education services" under the GST SAC schedule.
        ['key' => 'invoice_sac_code', 'value' => '998431', 'group' => 'invoicing'],
        ['key' => 'invoice_gst_rate', 'value' => '18', 'group' => 'invoicing'],
        ['key' => 'invoice_number_prefix', 'value' => 'INV', 'group' => 'invoicing'],
    ];

    public function up(): void
    {
        foreach (self::SETTINGS as $setting) {
            $exists = DB::table('settings')->where('key', $setting['key'])->exists();

            if (! $exists) {
                DB::table('settings')->insert($setting + [
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('settings')->whereIn('key', array_column(self::SETTINGS, 'key'))->delete();
    }
};
