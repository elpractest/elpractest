<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Verifies Google Play purchase tokens against the Play Developer API.
 *
 * Deliberately dependency-free: the service-account OAuth2 handshake is a
 * hand-rolled RS256 JWT signed with the built-in `openssl_sign`, exchanged for
 * an access token over Laravel's bundled HTTP client. No google/apiclient, no
 * JWT package to install — which is what lets this ship on a host where a
 * composer install cannot be run.
 *
 * It stays inert until a service account is configured: [isConfigured] gates the
 * controller, so with no credentials nothing here is ever reached.
 */
class GooglePlayVerifier
{
    private const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
    private const TOKEN_URI = 'https://oauth2.googleapis.com/token';
    private const API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

    public function isConfigured(): bool
    {
        return $this->serviceAccount() !== null && $this->packageName() !== '';
    }

    public function packageName(): string
    {
        return (string) config('googleplay.package_name', '');
    }

    /**
     * The decoded ProductPurchase resource, or throws. The caller reads
     * `purchaseState` (0 = purchased, 1 = canceled, 2 = pending) and `orderId`.
     */
    public function getProductPurchase(string $productId, string $token): array
    {
        $pkg = $this->packageName();
        $url = self::API_BASE . "/applications/{$pkg}/purchases/products/{$productId}/tokens/" . rawurlencode($token);

        $res = Http::withToken($this->accessToken())->acceptJson()->get($url);
        if ($res->failed()) {
            throw new RuntimeException('Play verification failed: HTTP ' . $res->status() . ' ' . $res->body());
        }

        return (array) $res->json();
    }

    /**
     * Acknowledge a purchase so Google does not auto-refund it. Safe to call on
     * an already-acknowledged token (Google answers 200).
     */
    public function acknowledgeProduct(string $productId, string $token): void
    {
        $pkg = $this->packageName();
        $url = self::API_BASE . "/applications/{$pkg}/purchases/products/{$productId}/tokens/" . rawurlencode($token) . ':acknowledge';

        $res = Http::withToken($this->accessToken())->acceptJson()->post($url, []);
        if ($res->failed()) {
            throw new RuntimeException('Play acknowledge failed: HTTP ' . $res->status() . ' ' . $res->body());
        }
    }

    private function accessToken(): string
    {
        $sa = $this->serviceAccount();
        if ($sa === null || empty($sa['client_email']) || empty($sa['private_key'])) {
            throw new RuntimeException('Google Play service account is not configured.');
        }

        $now = time();
        $header = $this->b64((string) json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $claims = $this->b64((string) json_encode([
            'iss' => $sa['client_email'],
            'scope' => self::SCOPE,
            'aud' => self::TOKEN_URI,
            'iat' => $now,
            'exp' => $now + 3600,
        ]));

        $signingInput = $header . '.' . $claims;
        $signature = '';
        if (!openssl_sign($signingInput, $signature, $sa['private_key'], OPENSSL_ALGO_SHA256)) {
            throw new RuntimeException('Could not sign the Google service-account JWT.');
        }
        $jwt = $signingInput . '.' . $this->b64($signature);

        $res = Http::asForm()->post(self::TOKEN_URI, [
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]);
        $access = $res->json('access_token');
        if ($res->failed() || !is_string($access) || $access === '') {
            throw new RuntimeException('Could not obtain a Google access token: ' . $res->body());
        }

        return $access;
    }

    private function serviceAccount(): ?array
    {
        $inline = config('googleplay.service_account_json');
        if (!empty($inline)) {
            $decoded = json_decode((string) $inline, true);
            return is_array($decoded) ? $decoded : null;
        }

        $path = config('googleplay.service_account_path');
        if (!empty($path) && is_readable((string) $path)) {
            $decoded = json_decode((string) file_get_contents((string) $path), true);
            return is_array($decoded) ? $decoded : null;
        }

        return null;
    }

    private function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
