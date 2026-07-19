<?php

namespace App\Providers;

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
