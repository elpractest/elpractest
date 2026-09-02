<?php

namespace App\Notifications;

use App\Notifications\Channels\FcmChannel;
use App\Notifications\Channels\WhatsAppChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Base for every push/in-app notification.
 *
 * Subclasses define one thing: payload() → [type, title, body, hue, icon, route].
 * The base fans that out to `database` (the in-app feed, always) and the custom
 * fcm channel (only when the user has a device token). Queued, so it never
 * blocks the request that triggered it. See docs/FCM_V1.1_SCOPE.md.
 *
 * WHATSAPP IS OPT-IN, per notification — a subclass gets it only by defining
 * toWhatsApp(). It is deliberately NOT automatic for all of them:
 *
 *   - every WhatsApp Business template needs Meta's approval before it can be
 *     sent at all, so "all notifications" is not even reachable;
 *   - each message costs real money per send, unlike a push;
 *   - a student who gets WhatsApped about every event blocks the number, and
 *     then the messages that DO matter never arrive either.
 *
 * So it is reserved for the few moments worth interrupting someone for.
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

        if (
            method_exists($this, 'toWhatsApp')
            && method_exists($notifiable, 'routeNotificationForWhatsApp')
            && ! empty($notifiable->routeNotificationForWhatsApp())
        ) {
            $channels[] = WhatsAppChannel::class;
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
