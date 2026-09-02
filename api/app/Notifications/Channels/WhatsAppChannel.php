<?php

namespace App\Notifications\Channels;

use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Notifications\Notification;

/**
 * The custom WhatsApp channel, resolved from the container by class name from a
 * notification's via() — same shape as FcmChannel.
 *
 * No-ops when the notifiable has no verified number or the notification defines
 * no toWhatsApp(). That second check is the opt-in: a notification without it
 * never reaches WhatsApp, which is deliberate (see FcmNotification::via()).
 */
class WhatsAppChannel
{
    public function __construct(private WhatsAppService $whatsapp)
    {
    }

    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toWhatsApp') || ! method_exists($notifiable, 'routeNotificationForWhatsApp')) {
            return;
        }

        $phone = $notifiable->routeNotificationForWhatsApp();
        if (empty($phone)) {
            return;
        }

        $message = $notification->toWhatsApp($notifiable);
        if (empty($message['template'])) {
            return;
        }

        $this->whatsapp->sendTemplate(
            $phone,
            $message['template'],
            $message['variables'] ?? []
        );
    }
}
