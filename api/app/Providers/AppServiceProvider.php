<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\ServiceProvider;

use Spatie\Permission\Events\RoleAttached;
use Illuminate\Support\Facades\Event;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Fix #2: Password-reset link → SPA page (no named route exists in this API-only app)
        ResetPassword::createUrlUsing(function (object $user, string $token) {
            return config('app.frontend_url') . "/reset-password?token={$token}&email=" . urlencode($user->email);
        });

        // Fix #3: Email-verification link → SPA page (avoids stranding user on raw JSON API response)
        VerifyEmail::createUrlUsing(function (object $notifiable) {
            $id = $notifiable->getKey();
            $hash = sha1($notifiable->getEmailForVerification());
            return config('app.frontend_url') . "/verify-email?id={$id}&hash={$hash}";
        });

        Event::listen(RoleAttached::class, function (RoleAttached $event) {
            $user = $event->model;
            if ($user instanceof \App\Models\User) {
                $superAdminEmail = env('SUPER_ADMIN_EMAIL', 'thevinstitution@gmail.com');
                $rolesOrIds = \Illuminate\Support\Arr::wrap($event->rolesOrIds);
                foreach ($rolesOrIds as $role) {
                    $roleName = null;
                    if ($role instanceof \Spatie\Permission\Models\Role) {
                        $roleName = $role->name;
                    } elseif (is_numeric($role)) {
                        $roleModel = \Spatie\Permission\Models\Role::find($role);
                        $roleName = $roleModel?->name;
                    } elseif (is_string($role)) {
                        $roleName = $role;
                    }
                    
                    if ($roleName === 'super-admin' && $user->email !== $superAdminEmail) {
                        $user->roles()->detach($role);
                        throw new \Exception('Only the designated super-admin email can be assigned the super-admin role.');
                    }
                }
            }
        });
    }
}
