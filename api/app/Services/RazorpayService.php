<?php

namespace App\Services;

use Razorpay\Api\Api;

/**
 * Thin wrapper around the Razorpay SDK. Controllers depend on this via
 * constructor injection instead of instantiating Razorpay\Api\Api
 * directly, so it can be swapped for a mock in feature tests without
 * ever hitting Razorpay's servers.
 */
class RazorpayService
{
    protected Api $api;

    public function __construct()
    {
        $this->api = new Api(
            config('razorpay.key_id'),
            config('razorpay.key_secret'),
        );
    }

    /**
     * Create a Razorpay order. $attributes['amount'] must already be the
     * final, server-computed amount in paise — never pass through a
     * client-supplied amount.
     */
    public function createOrder(array $attributes): array
    {
        $order = $this->api->order->create($attributes);

        return $order->toArray();
    }

    /**
     * Refund a captured payment, in full or in part.
     *
     * Razorpay is the source of truth: this only asks for the refund. The
     * local payment/enrolment state is settled by the caller and confirmed
     * again by the `refund.processed` webhook, so a refund initiated in the
     * Razorpay dashboard lands in exactly the same place as one initiated here.
     *
     * @param  int|null  $amountPaise  null refunds the full captured amount.
     */
    public function refund(string $razorpayPaymentId, ?int $amountPaise = null): array
    {
        $attributes = $amountPaise !== null ? ['amount' => $amountPaise] : [];

        return $this->api->payment
            ->fetch($razorpayPaymentId)
            ->refund($attributes)
            ->toArray();
    }

    /**
     * Verifies the signature returned by Razorpay Checkout's client-side
     * handler callback.
     *
     * @throws \Razorpay\Api\Errors\SignatureVerificationError when invalid
     */
    public function verifyPaymentSignature(array $attributes): void
    {
        $this->api->utility->verifyPaymentSignature($attributes);
    }

    /**
     * Verifies the X-Razorpay-Signature header on an incoming webhook
     * request against the raw request body. Returns a plain bool (rather
     * than throwing) so webhook handlers can respond cleanly.
     */
    public function verifyWebhookSignature(string $rawPayload, string $signature): bool
    {
        if (empty($signature)) {
            return false;
        }

        try {
            $this->api->utility->verifyWebhookSignature(
                $rawPayload,
                $signature,
                config('razorpay.webhook_secret'),
            );

            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }
}
