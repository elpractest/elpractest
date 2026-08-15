<?php

namespace App\Notifications;

/** FCM v1.1 — fired to enrolled students when a test series is published. */
class NewSeriesPublished extends FcmNotification
{
    public function __construct(
        private int $seriesId,
        private string $seriesTitle,
    ) {
    }

    protected function payload(): array
    {
        return [
            'type' => 'mock',
            'title' => 'New test series',
            'body' => "{$this->seriesTitle} is now available.",
            'hue' => 'blue',
            'icon' => 'target',
            'route' => "/student/test-series/{$this->seriesId}",
        ];
    }
}
