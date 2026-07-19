<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * MSG91 OTP service.
 *
 * In local/testing environments (when MSG91_AUTH_KEY is empty),
 * OTPs are logged instead of sent — no HTTP calls made.
 */
class Msg91Service
{
    private ?string $authKey;
    private ?string $templateId;
    private string $senderId;

    public function __construct()
    {
        $this->authKey = config('services.msg91.auth_key');
        $this->templateId = config('services.msg91.template_id');
        $this->senderId = config('services.msg91.sender_id', 'PRACTEST');
    }

    /**
     * Send OTP via MSG91.
     * Falls back to logging in dev/test environments.
     */
    public function sendOtp(string $phone, string $otp): bool
    {
        // Dev/test fallback: log instead of sending
        if (empty($this->authKey)) {
            Log::info("MSG91 OTP [DEV MODE]: Phone={$phone}, OTP={$otp}");
            return true;
        }

        try {
            $response = Http::withHeaders([
                'authkey' => $this->authKey,
                'Content-Type' => 'application/json',
            ])->post('https://control.msg91.com/api/v5/otp', [
                'template_id' => $this->templateId,
                'mobile' => $phone,
                'otp' => $otp,
                'sender' => $this->senderId,
            ]);

            if ($response->successful()) {
                return true;
            }

            Log::error('MSG91 OTP send failed', [
                'phone' => $phone,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        } catch (\Exception $e) {
            Log::error('MSG91 OTP exception', [
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
