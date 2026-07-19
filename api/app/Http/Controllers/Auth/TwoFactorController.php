<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorController extends Controller
{
    private Google2FA $google2fa;

    public function __construct()
    {
        $this->google2fa = new Google2FA();
    }

    /**
     * Generate a 2FA secret and QR code for setup.
     *
     * Uses bacon/bacon-qr-code (already in composer.json) for QR rendering.
     */
    public function setup(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->google2fa_enabled) {
            return response()->json([
                'message' => 'Two-factor authentication is already enabled.',
            ], 422);
        }

        $secret = $this->google2fa->generateSecretKey();

        // Store temporarily (not enabled yet — user must verify a code first)
        $user->update(['google2fa_secret' => $secret]);

        $otpauthUrl = $this->google2fa->getQRCodeUrl(
            config('app.name', 'Practest'),
            $user->email,
            $secret,
        );

        // Generate QR code as SVG using bacon/bacon-qr-code
        $renderer = new ImageRenderer(
            new RendererStyle(200),
            new SvgImageBackEnd()
        );
        $writer = new Writer($renderer);
        $qrCodeSvg = $writer->writeString($otpauthUrl);

        return response()->json([
            'secret' => $secret,
            'qr_code_svg' => $qrCodeSvg,
            'otpauth_url' => $otpauthUrl,
        ]);
    }

    /**
     * Verify a TOTP code and enable 2FA.
     *
     * This is the final step of setup — user must prove they can generate
     * valid codes before 2FA is permanently enabled.
     */
    public function enable(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();

        if ($user->google2fa_enabled) {
            return response()->json([
                'message' => 'Two-factor authentication is already enabled.',
            ], 422);
        }

        if (empty($user->google2fa_secret)) {
            return response()->json([
                'message' => 'Please initiate 2FA setup first.',
            ], 422);
        }

        $valid = $this->google2fa->verifyKey($user->google2fa_secret, $request->code);

        if (! $valid) {
            return response()->json([
                'message' => 'Invalid verification code. Please try again.',
            ], 422);
        }

        $user->update(['google2fa_enabled' => true]);

        // Mark 2FA as verified for this session
        $request->session()->put('2fa_verified', true);

        return response()->json([
            'message' => 'Two-factor authentication enabled successfully.',
        ]);
    }

    /**
     * Verify 2FA code during login (post-password, pre-dashboard access).
     */
    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();

        if (! $user->google2fa_enabled) {
            return response()->json([
                'message' => '2FA is not enabled on this account.',
            ], 422);
        }

        $valid = $this->google2fa->verifyKey($user->google2fa_secret, $request->code);

        if (! $valid) {
            return response()->json([
                'message' => 'Invalid verification code.',
            ], 422);
        }

        $request->session()->put('2fa_verified', true);

        return response()->json([
            'message' => 'Two-factor authentication verified.',
        ]);
    }
}
