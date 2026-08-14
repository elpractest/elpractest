<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * The framework's email-verification notification, sent on the queue.
 *
 * Registration fires this via the Registered event. Sending it synchronously
 * means any mail-transport hiccup 500s the whole signup and leaves a
 * half-created user. Queuing it decouples account creation from mail delivery:
 * register returns 201 immediately and the worker delivers (with retries).
 *
 * The custom verification URL registered in AppServiceProvider
 * (VerifyEmail::createUrlUsing) still applies — it lives on the parent class's
 * inherited static callback.
 */
class QueuedVerifyEmail extends VerifyEmail implements ShouldQueue
{
    use Queueable;
}
