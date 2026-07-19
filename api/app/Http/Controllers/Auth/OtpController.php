<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\OtpVerification;
use App\Services\Msg91Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OtpController extends Controller
{
    public function __construct(
        private readonly Msg91Service $msg91
    ) {}

    /**
     * Send OTP to the user's phone number.
     */
    public function send(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => ['required', 'string', 'max:20'],
        ]);

        $user = $request->user();
        $phone = $request->phone;

        // Generate 6-digit OTP
        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Store OTP (expires in 10 minutes)
        OtpVerification::create([
            'user_id' => $user->id,
            'phone' => $phone,
            'code' => $otp,
            'purpose' => 'phone_verify',
            'expires_at' => now()->addMinutes(10),
        ]);

        // Send via MSG91
        $this->msg91->sendOtp($phone, $otp);

        return response()->json([
            'message' => 'OTP sent successfully to your phone number.',
        ]);
    }

    /**
     * Verify the OTP and mark phone as verified.
     */
    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => ['required', 'string', 'max:20'],
            'otp' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();

        $verification = OtpVerification::where('user_id', $user->id)
            ->where('phone', $request->phone)
            ->where('code', $request->otp)
            ->where('purpose', 'phone_verify')
            ->whereNull('verified_at')
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if (! $verification) {
            return response()->json([
                'message' => 'Invalid or expired OTP.',
            ], 422);
        }

        // Mark OTP as verified
        $verification->update(['verified_at' => now()]);

        // Update user's phone and verification timestamp
        $user->update([
            'phone' => $request->phone,
            'phone_verified_at' => now(),
        ]);

        return response()->json([
            'message' => 'Phone number verified successfully.',
        ]);
    }
}
