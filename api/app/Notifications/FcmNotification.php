<?php

namespace App\Notifications;

use App\Notifications\Channels\FcmChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * FCM v1.1 — base for every push/in-app notification.
 *
 * Subclasses define one thing: payload() → [type, title, body, hue, icon, route].
 * The base fans that out to two channels — `database` (the in-app feed, always)
 * and the custom fcm channel (only when the user has a device token). Queued, so
 * it never blocks the request that triggered it. See docs/FCM_V1.1_SCOPE.md.
 */
abstract class FcmNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /** @return array{type:string,title:string,body:string,hue:string,icon:string,route:?string} */
    abstract protected function payload(): array;

    public function via(object $notifiable): array
    {
        $channels = ['database'];

        if (method_exists($notifiable, 'routeNotificationForFcm') && ! empty($notifiable->routeNotificationForFcm())) {
            $channels[] = FcmChannel::class;
        }

        return $channels;
    }

    /** Row for the notifications table → the in-app feed shape. */
    public function toDatabase(object $notifiable): array
    {
        return $this->payload();
    }

    /** Push payload for the fcm channel. */
    public function toFcm(object $notifiable): array
    {
        $p = $this->payload();

        return [
            'title' => $p['title'],
            'body' => $p['body'],
            'data' => [
                'route' => $p['route'] ?? '',
                'type' => $p['type'] ?? '',
            ],
        ];
    }
}
