<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable;
    use HasRoles {
        assignRole as traitAssignRole;
        syncRoles as traitSyncRoles;
        removeRole as traitRemoveRole;
    }

    /**
     * Send the email-verification notification on the queue, so a mail-transport
     * failure never 500s registration or leaves a half-created user.
     */
    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new \App\Notifications\QueuedVerifyEmail());
    }

    /**
     * Send the password-reset notification on the queue for the same reason.
     */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new \App\Notifications\QueuedResetPassword($token));
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'phone_verified_at',
        'google2fa_secret',
        'google2fa_enabled',
        'avatar',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'google2fa_secret',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'google2fa_enabled' => 'boolean',
            'password' => 'hashed',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function socialAccounts(): HasMany
    {
        return $this->hasMany(SocialAccount::class);
    }

    public function otpVerifications(): HasMany
    {
        return $this->hasMany(OtpVerification::class);
    }

    public function deviceTokens(): HasMany
    {
        return $this->hasMany(DeviceToken::class);
    }

    /**
     * FCM v1.1 — route the `fcm` notification channel to this user's device
     * tokens. Returns the raw token strings; an empty list means the fcm
     * channel is skipped in the notification's via(). See docs/FCM_V1.1_SCOPE.md.
     */
    public function routeNotificationForFcm(): array
    {
        return $this->deviceTokens()->pluck('token')->all();
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function activationRequests(): HasMany
    {
        return $this->hasMany(ActivationRequest::class);
    }

    public function testSessions(): HasMany
    {
        return $this->hasMany(\App\Models\TestSession::class);
    }

    public function lessonProgress(): HasMany
    {
        return $this->hasMany(LessonProgress::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(\App\Models\AuditLog::class);
    }

    // ── Helpers ────────────────────────────────────────────────────

    /**
     * Check if the user has an active enrollment for a specific course and batch.
     */
    public function hasActiveEnrollment(int $courseId, ?int $batchId = null): bool
    {
        $query = $this->enrollments()
            ->where('course_id', $courseId)
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('expires_at')
                  ->orWhere('expires_at', '>', now());
            });

        if ($batchId) {
            $query->where('batch_id', $batchId);
        }

        return $query->exists();
    }

    /**
     * Check if the user's phone is verified.
     */
    public function hasVerifiedPhone(): bool
    {
        return $this->phone_verified_at !== null;
    }

    /**
     * Check if 2FA is required for this user (admin/super-admin roles).
     */
    public function requires2FA(): bool
    {
        return $this->hasAnyRole(['super-admin', 'admin']);
    }

    protected static function booted(): void
    {
        static::updating(function (User $user) {
            if ($user->hasRole('super-admin')) {
                // Prevent changing the email of the super-admin
                if ($user->isDirty('email')) {
                    abort(403, 'The super-admin email address cannot be changed.');
                }
            }
        });
    }

    public function delete()
    {
        if ($this->hasRole('super-admin')) {
            abort(403, 'The super-admin account cannot be deleted.');
        }
        return parent::delete();
    }

    public function assignRole(...$roles)
    {
        $superAdminEmail = env('SUPER_ADMIN_EMAIL') ?: 'thevinstitution@gmail.com';
        $flatRoles = \Illuminate\Support\Arr::flatten($roles);
        foreach ($flatRoles as $role) {
            $roleName = $role instanceof \Spatie\Permission\Models\Role ? $role->name : $role;
            if ($roleName === 'super-admin' && $this->email !== $superAdminEmail) {
                throw new \Exception('Only the designated super-admin email can be assigned the super-admin role.');
            }
        }
        return $this->traitAssignRole(...$roles);
    }

    public function removeRole($role)
    {
        if ($this->hasRole('super-admin')) {
            throw new \Exception('The super-admin role cannot be removed from this account.');
        }
        return $this->traitRemoveRole($role);
    }

    public function syncRoles(...$roles)
    {
        $superAdminEmail = env('SUPER_ADMIN_EMAIL') ?: 'thevinstitution@gmail.com';
        $flatRoles = \Illuminate\Support\Arr::flatten($roles);
        
        // If they are currently a super-admin, they must keep the super-admin role
        if ($this->hasRole('super-admin')) {
            $hasSuperAdmin = false;
            foreach ($flatRoles as $role) {
                $roleName = $role instanceof \Spatie\Permission\Models\Role ? $role->name : $role;
                if ($roleName === 'super-admin') {
                    $hasSuperAdmin = true;
                }
            }
            if (!$hasSuperAdmin) {
                throw new \Exception('The super-admin role cannot be removed from this account.');
            }
        }

        foreach ($flatRoles as $role) {
            $roleName = $role instanceof \Spatie\Permission\Models\Role ? $role->name : $role;
            if ($roleName === 'super-admin' && $this->email !== $superAdminEmail) {
                throw new \Exception('Only the designated super-admin email can be assigned the super-admin role.');
            }
        }
        return $this->traitSyncRoles(...$roles);
    }
}
