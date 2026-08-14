<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * The framework's password-reset notification, sent on the queue.
 *
 * Same rationale as QueuedVerifyEmail: a mail-transport failure must not fail
 * the forgot-password request. The custom reset URL registered in
 * AppServiceProvider (ResetPassword::createUrlUsing) still applies via the
 * parent's inherited static callback.
 */
class QueuedResetPassword extends ResetPassword implements ShouldQueue
{
    use Queueable;
}
