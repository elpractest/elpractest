<?php

namespace App\Notifications;

/** FCM v1.1 — fired on code redemption or manual admin enrollment. */
class EnrolledInCourse extends FcmNotification
{
    public function __construct(
        private string $courseTitle,
        private ?string $batchName,
        private int $courseId,
    ) {
    }

    protected function payload(): array
    {
        $suffix = $this->batchName ? " — {$this->batchName}" : '';

        return [
            'type' => 'enrollment',
            'title' => "You're enrolled",
            'body' => "You now have access to {$this->courseTitle}{$suffix}.",
            'hue' => 'gold',
            'icon' => 'graduation-cap',
            'route' => "/courses/{$this->courseId}/outline",
        ];
    }
}
