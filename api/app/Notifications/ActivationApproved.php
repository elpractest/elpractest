<?php

namespace App\Notifications;

/** FCM v1.1 — fired when an admin approves an activation request. */
class ActivationApproved extends FcmNotification
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
            'type' => 'activation',
            'title' => 'Access approved',
            'body' => "{$this->courseTitle}{$suffix} is now active. Start learning.",
            'hue' => 'gold',
            'icon' => 'key',
            'route' => "/courses/{$this->courseId}/outline",
        ];
    }

    /**
     * Worth a WhatsApp: the candidate has been waiting on a human to check
     * their payment proof, and until this lands they cannot use what they paid
     * for. See FcmNotification::via() for why this is opt-in per notification.
     */
    public function toWhatsApp(object $notifiable): array
    {
        return [
            'template' => config('services.msg91.whatsapp.templates.activation_approved'),
            'variables' => [$this->courseTitle],
        ];
    }
}
