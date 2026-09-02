<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * A live grant: this user may use this course or this series until this date.
 */
class Entitlement extends Model
{
    public const SOURCE_PAYMENT = 'payment';
    public const SOURCE_ACTIVATION_CODE = 'activation_code';
    public const SOURCE_MANUAL = 'manual';
    public const SOURCE_BACKFILL = 'backfill';

    protected $fillable = [
        'user_id',
        'grantable_type',
        'grantable_id',
        'product_id',
        'payment_id',
        'enrollment_id',
        'source',
        'starts_at',
        'expires_at',
        'is_active',
        'granted_by',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function grantable(): MorphTo
    {
        return $this->morphTo();
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    /**
     * Live right now: flagged active, started, and not yet expired.
     *
     * Mirrors Enrollment::scopeActive() exactly — the two have to agree, because
     * EntitlementService treats a hit from either as the same answer.
     */
    public function scopeLive($query)
    {
        return $query->where('is_active', true)
            ->where('starts_at', '<=', now())
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            });
    }
}
