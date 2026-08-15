<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * FCM v1.1 — a registered push token for one device.
 *
 * Registered/refreshed by the Flutter app via POST /student/device-tokens,
 * removed on logout, and pruned when FCM reports the token UNREGISTERED.
 * See docs/FCM_V1.1_SCOPE.md.
 */
class DeviceToken extends Model
{
    protected $fillable = [
        'user_id',
        'token',
        'platform',
        'last_used_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
