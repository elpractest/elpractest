<?php

namespace App\Notifications;

/** FCM v1.1 — fired to enrolled students when a test is published. */
class NewMockPublished extends FcmNotification
{
    public function __construct(
        private int $testId,
        private string $testTitle,
        private ?int $seriesId,
    ) {
    }

    protected function payload(): array
    {
        return [
            'type' => 'mock',
            'title' => 'New mock added',
            'body' => "{$this->testTitle} is live. Attempt it for your rank.",
            'hue' => 'blue',
            'icon' => 'target',
            'route' => $this->seriesId ? "/student/test-series/{$this->seriesId}" : '/student/test-series',
        ];
    }
}
