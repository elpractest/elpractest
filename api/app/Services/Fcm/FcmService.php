<?php

namespace App\Services\Fcm;

use App\Models\DeviceToken;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * FCM v1.1 — dependency-free Firebase Cloud Messaging (HTTP v1) sender.
 *
 * No composer package required: the OAuth2 access token is minted from the
 * service-account JSON with PHP's built-in openssl (RS256 JWT) and cached, and
 * messages go out over Laravel's Http client. When FIREBASE_CREDENTIALS is
 * unset (or the file is missing) every method no-ops — the same "inert until
 * configured" contract as GooglePlayController — so the code deploys safely
 * before the secret lands. A send never throws: a push failure must never break
 * the request or job that triggered it. See docs/FCM_V1.1_SCOPE.md.
 */
class FcmService
{
    private const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
    private const TOKEN_CACHE_KEY = 'fcm_access_token';

    /** Is FCM configured on this environment? */
    public function enabled(): bool
    {
        $path = config('services.fcm.credentials');

        return is_string($path) && $path !== '' && is_file($path);
    }

    /**
     * Send one notification to every supplied token. Invalid/expired tokens are
     * pruned from device_tokens. Silently returns when disabled or token-less.
     */
    public function send(array $tokens, string $title, string $body, array $data = []): void
    {
        $tokens = array_values(array_filter(array_unique($tokens)));

        if (! $this->enabled() || $tokens === []) {
            return;
        }

        $sa = $this->serviceAccount();
        $accessToken = $this->accessToken($sa);

        if ($sa === null || $accessToken === null) {
            return;
        }

        $projectId = config('services.fcm.project_id') ?: ($sa['project_id'] ?? null);
        if (! $projectId) {
            return;
        }

        $endpoint = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

        // FCM HTTP v1 has no multicast — one request per token. Bounded by the
        // caller (single recipient, or a fan-out job that already chunks).
        foreach ($tokens as $token) {
            try {
                $response = Http::withToken($accessToken)
                    ->acceptJson()
                    ->post($endpoint, [
                        'message' => [
                            'token' => $token,
                            'notification' => ['title' => $title, 'body' => $body],
                            // FCM data values must be strings.
                            'data' => array_map('strval', $data),
                        ],
                    ]);

                if ($response->failed()) {
                    $this->handleFailure($token, $response->status(), $response->json());
                }
            } catch (\Throwable $e) {
                Log::warning('FCM send failed', ['error' => $e->getMessage()]);
            }
        }
    }

    /** Prune a token FCM reports as gone; log anything else. */
    private function handleFailure(string $token, int $status, ?array $payload): void
    {
        $reason = $payload['error']['status'] ?? '';

        // 404 UNREGISTERED / 400 INVALID_ARGUMENT on the token → the device is
        // gone; delete it so the list stays clean and we stop retrying it.
        if ($status === 404 || $reason === 'UNREGISTERED' || $reason === 'INVALID_ARGUMENT') {
            DeviceToken::where('token', $token)->delete();
            return;
        }

        Log::warning('FCM rejected a message', ['status' => $status, 'reason' => $reason]);
    }

    /** Read + decode the service-account JSON, or null on any problem. */
    private function serviceAccount(): ?array
    {
        $path = config('services.fcm.credentials');
        $json = @file_get_contents($path);
        if ($json === false) {
            return null;
        }

        $sa = json_decode($json, true);

        return (is_array($sa) && isset($sa['client_email'], $sa['private_key'])) ? $sa : null;
    }

    /** Mint (and cache) an OAuth2 access token for the service account. */
    private function accessToken(?array $sa): ?string
    {
        if ($sa === null) {
            return null;
        }

        return Cache::remember(self::TOKEN_CACHE_KEY, 3300, function () use ($sa) {
            $tokenUri = $sa['token_uri'] ?? 'https://oauth2.googleapis.com/token';
            $now = time();

            $claims = [
                'iss' => $sa['client_email'],
                'scope' => self::SCOPE,
                'aud' => $tokenUri,
                'iat' => $now,
                'exp' => $now + 3600,
            ];

            $header = $this->b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
            $payload = $this->b64url(json_encode($claims));
            $signingInput = "{$header}.{$payload}";

            $signature = '';
            if (! openssl_sign($signingInput, $signature, $sa['private_key'], OPENSSL_ALGO_SHA256)) {
                return null;
            }

            $assertion = "{$signingInput}.{$this->b64url($signature)}";

            $response = Http::asForm()->post($tokenUri, [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $assertion,
            ]);

            return $response->successful() ? $response->json('access_token') : null;
        });
    }

    private function b64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
