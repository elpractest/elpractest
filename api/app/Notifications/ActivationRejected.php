<?php

namespace App\Notifications;

/** FCM v1.1 — fired when an admin rejects an activation request. */
class ActivationRejected extends FcmNotification
{
    public function __construct(
        private string $courseTitle,
        private ?string $batchName,
        private ?string $reason,
    ) {
    }

    protected function payload(): array
    {
        $suffix = $this->batchName ? " — {$this->batchName}" : '';
        $reason = $this->reason ?: 'your request was not approved.';

        return [
            'type' => 'activation',
            'title' => 'Activation update',
            'body' => "{$this->courseTitle}{$suffix}: {$reason}",
            'hue' => 'red',
            'icon' => 'x-circle',
            'route' => '/dashboard',
        ];
    }
}
