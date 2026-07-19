<?php

namespace App\Services;

use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ConversionTrackingService
{
    /**
     * Send server-side purchase event to Meta Conversions API (CAPI).
     */
    public function sendMetaPurchaseEvent(Payment $payment): void
    {
        $pixelId = config('services.meta.pixel_id');
        $accessToken = config('services.meta.capi_access_token');

        if (!$pixelId || !$accessToken) {
            Log::warning('Meta Conversions API is not configured. Skipping event.');
            return;
        }

        $user = $payment->user;
        if (!$user) {
            Log::warning('Payment has no associated user. Skipping Meta event.');
            return;
        }

        $userData = [
            'em' => [hash('sha256', strtolower(trim($user->email)))],
        ];

        if (!empty($user->phone)) {
            $userData['ph'] = [hash('sha256', trim($user->phone))];
        }

        $eventData = [
            'event_name' => 'Purchase',
            'event_time' => $payment->updated_at ? $payment->updated_at->timestamp : now()->timestamp,
            'event_id' => $payment->event_id,
            'user_data' => $userData,
            'custom_data' => [
                'value' => $payment->amount / 100, // Amount in rupees
                'currency' => 'INR',
            ],
            'action_source' => 'website',
            'event_source_url' => config('services.google.redirect') ? str_replace('/api/auth/google/callback', '', config('services.google.redirect')) : 'https://www.practest.live',
        ];

        try {
            $url = "https://graph.facebook.com/v19.0/{$pixelId}/events";
            $response = Http::post($url, [
                'data' => [$eventData],
                'access_token' => $accessToken,
            ]);

            if ($response->failed()) {
                Log::error('Meta Conversions API failed response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('Meta Conversions API exception', ['message' => $e->getMessage()]);
        }
    }

    /**
     * Send server-side purchase event to GA4 Measurement Protocol.
     */
    public function sendGa4PurchaseEvent(Payment $payment): void
    {
        $measurementId = config('services.ga4.measurement_id');
        $apiSecret = config('services.ga4.api_secret');

        if (!$measurementId || !$apiSecret) {
            Log::warning('GA4 Measurement Protocol is not configured. Skipping event.');
            return;
        }

        $user = $payment->user;
        if (!$user) {
            Log::warning('Payment has no associated user. Skipping GA4 event.');
            return;
        }

        // Generate client_id based on hashed user_id to ensure it remains stable
        $clientId = hash('sha256', (string) $user->id);

        $payload = [
            'client_id' => $clientId,
            'events' => [
                [
                    'name' => 'purchase',
                    'params' => [
                        'transaction_id' => $payment->razorpay_payment_id ?: 'pmt_' . $payment->id,
                        'value' => $payment->amount / 100, // in rupees
                        'currency' => 'INR',
                        'event_id' => $payment->event_id,
                        'items' => [
                            [
                                'item_id' => 'batch_' . $payment->batch_id,
                                'item_name' => $payment->batch?->name ?: 'Mock Test Batch',
                                'price' => $payment->amount / 100,
                                'quantity' => 1,
                            ]
                        ]
                    ]
                ]
            ]
        ];

        try {
            $url = "https://www.google-analytics.com/mp/collect?measurement_id={$measurementId}&api_secret={$apiSecret}";
            $response = Http::post($url, $payload);

            if ($response->failed()) {
                Log::error('GA4 Measurement Protocol failed response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('GA4 Measurement Protocol exception', ['message' => $e->getMessage()]);
        }
    }
}
