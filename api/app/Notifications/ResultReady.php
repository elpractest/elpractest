<?php

namespace App\Notifications;

/** FCM v1.1 — fired when ComputeTestAnalytics finishes scoring a submission. */
class ResultReady extends FcmNotification
{
    public function __construct(
        private int $sessionId,
        private string $testTitle,
        private float $score,
        private float $total,
    ) {
    }

    /** Trailing zeros make a score read like a machine wrote it. */
    private function trim(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
    }

    protected function payload(): array
    {
        $score = $this->trim($this->score);
        $total = $this->trim($this->total);

        return [
            'type' => 'result',
            'title' => 'Result ready',
            'body' => "{$this->testTitle} — {$score}/{$total}. Your analytics are ready.",
            'hue' => 'green',
            'icon' => 'check-circle',
            'route' => "/tests/{$this->sessionId}/result",
        ];
    }

    /**
     * Worth a WhatsApp: the score is the thing a candidate actually waits for
     * after sitting a mock, and it is what pulls them back in to review the
     * analytics. See FcmNotification::via() for why this is opt-in.
     */
    public function toWhatsApp(object $notifiable): array
    {
        return [
            'template' => config('services.msg91.whatsapp.templates.result_ready'),
            'variables' => [$this->testTitle, $this->trim($this->score), $this->trim($this->total)],
        ];
    }
}
