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

    protected function payload(): array
    {
        $score = rtrim(rtrim(number_format($this->score, 2, '.', ''), '0'), '.');
        $total = rtrim(rtrim(number_format($this->total, 2, '.', ''), '0'), '.');

        return [
            'type' => 'result',
            'title' => 'Result ready',
            'body' => "{$this->testTitle} — {$score}/{$total}. Your analytics are ready.",
            'hue' => 'green',
            'icon' => 'check-circle',
            'route' => "/tests/{$this->sessionId}/result",
        ];
    }
}
