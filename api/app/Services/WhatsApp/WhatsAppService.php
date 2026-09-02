<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * WhatsApp Business messages via MSG91 — the same vendor that already sends the
 * login OTP, so this is a new endpoint on an existing account rather than a new
 * integration to procure.
 *
 * Why WhatsApp at all, when FCM push already exists: in India a push banner is
 * routinely ignored or disabled outright, while WhatsApp is checked constantly
 * and trusted. For the moments that actually matter to a candidate — your
 * access is live, your result is out, your mock starts in an hour — it is the
 * channel that actually gets read.
 *
 * TEMPLATES, NOT FREE TEXT. WhatsApp Business only permits pre-approved
 * templates for business-initiated messages, each with ordered parameters. So a
 * notification supplies a template NAME and its variables, never a sentence.
 * Names are configured rather than hard-coded, because the approved name lives
 * in the institute's own Meta account.
 *
 * Inert until configured: with no auth key or integrated number this logs and
 * returns false, exactly like FcmService and Msg91Service. The code deploys
 * safely long before anyone has finished Meta's template approval.
 */
class WhatsAppService
{
    private ?string $authKey;
    private ?string $integratedNumber;
    private string $languageCode;

    public function __construct()
    {
        $this->authKey = config('services.msg91.auth_key');
        $this->integratedNumber = config('services.msg91.whatsapp.integrated_number');
        $this->languageCode = config('services.msg91.whatsapp.language', 'en');
    }

    public function isConfigured(): bool
    {
        return ! empty($this->authKey) && ! empty($this->integratedNumber);
    }

    /**
     * Send one approved template to one number.
     *
     * @param  string  $phone       Recipient in international format, digits only (e.g. 919812345678).
     * @param  string  $template    The approved template's name in the Meta account.
     * @param  string[]  $variables Body variables, in the order the template declares them.
     */
    public function sendTemplate(string $phone, string $template, array $variables = []): bool
    {
        if (! $this->isConfigured()) {
            Log::info('WhatsApp [NOT CONFIGURED]: would have sent', [
                'phone' => $this->mask($phone),
                'template' => $template,
            ]);

            return false;
        }

        if ($template === '') {
            Log::warning('WhatsApp: no template name configured for this notification; skipping.');

            return false;
        }

        $phone = $this->normalise($phone);
        if ($phone === null) {
            return false;
        }

        // Body variables are positional in WhatsApp templates: body_1, body_2…
        $components = [];
        foreach (array_values($variables) as $i => $value) {
            $components['body_' . ($i + 1)] = ['type' => 'text', 'value' => (string) $value];
        }

        try {
            $response = Http::withHeaders([
                'authkey' => $this->authKey,
                'Content-Type' => 'application/json',
            ])->timeout(10)->post(
                'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
                [
                    'integrated_number' => $this->integratedNumber,
                    'content_type' => 'template',
                    'payload' => [
                        'messaging_product' => 'whatsapp',
                        'type' => 'template',
                        'template' => [
                            'name' => $template,
                            'language' => ['code' => $this->languageCode, 'policy' => 'deterministic'],
                            'to_and_components' => [[
                                'to' => [$phone],
                                'components' => $components,
                            ]],
                        ],
                    ],
                ]
            );

            if ($response->successful()) {
                return true;
            }

            Log::error('WhatsApp send failed', [
                'phone' => $this->mask($phone),
                'template' => $template,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false;
        } catch (\Throwable $e) {
            // Never rethrow: a messaging failure must not fail the job that
            // triggered it (scoring a paper, approving access).
            Log::error('WhatsApp exception', [
                'phone' => $this->mask($phone),
                'template' => $template,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Digits only, with India's country code added when a bare 10-digit mobile
     * is stored — which is how numbers are entered here. Anything that is not
     * a plausible mobile number is dropped rather than sent to a stranger.
     */
    private function normalise(string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (strlen($digits) === 10) {
            $digits = config('services.msg91.whatsapp.country_code', '91') . $digits;
        }

        if (strlen($digits) < 11 || strlen($digits) > 15) {
            Log::warning('WhatsApp: refusing to send to an implausible number.', [
                'phone' => $this->mask($digits),
            ]);

            return null;
        }

        return $digits;
    }

    /** Logs must not leak full phone numbers. */
    private function mask(string $phone): string
    {
        return strlen($phone) <= 4 ? '****' : substr($phone, 0, 2) . str_repeat('*', strlen($phone) - 4) . substr($phone, -2);
    }
}
