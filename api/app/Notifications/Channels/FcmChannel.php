<?php

namespace App\Notifications\Channels;

use App\Services\Fcm\FcmService;
use Illuminate\Notifications\Notification;

/**
 * FCM v1.1 — the custom notification channel. Referenced by class name from a
 * notification's via() (Laravel's ChannelManager resolves it from the container,
 * injecting FcmService). No-ops when the notifiable has no tokens or the
 * notification defines no toFcm(). See docs/FCM_V1.1_SCOPE.md.
 */
class FcmChannel
{
    public function __construct(private FcmService $fcm)
    {
    }

    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toFcm') || ! method_exists($notifiable, 'routeNotificationForFcm')) {
            return;
        }

        $tokens = $notifiable->routeNotificationForFcm();
        if (empty($tokens)) {
            return;
        }

        $payload = $notification->toFcm($notifiable);

        $this->fcm->send(
            $tokens,
            $payload['title'] ?? '',
            $payload['body'] ?? '',
            $payload['data'] ?? []
        );
    }
}
