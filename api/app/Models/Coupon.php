<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    protected $fillable = [
        'code',
        'discount_type',
        'discount_value',
        'max_uses',
        'max_uses_per_user',
        'times_used',
        'valid_from',
        'valid_until',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'valid_from' => 'datetime',
            'valid_until' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Check if this coupon is currently valid.
     */
    public function isValid(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if ($this->max_uses !== null && $this->times_used >= $this->max_uses) {
            return false;
        }

        if ($this->valid_from && $this->valid_from->isFuture()) {
            return false;
        }

        if ($this->valid_until && $this->valid_until->isPast()) {
            return false;
        }

        return true;
    }

    /**
     * How many times this user has already redeemed this coupon.
     *
     * Counted from `payments` rather than a redemptions table: a successful
     * redemption always leaves a paid payment row, so that IS the ledger, and
     * a second table would only add a way for the two to disagree. Refunded
     * payments deliberately do not count — a refunded student gets the code back.
     */
    public function usesByUser(int $userId): int
    {
        return Payment::where('coupon_id', $this->id)
            ->where('user_id', $userId)
            ->where('status', 'paid')
            ->count();
    }

    /**
     * Valid for this specific user: the global checks, plus their own cap.
     */
    public function isValidForUser(int $userId): bool
    {
        if (! $this->isValid()) {
            return false;
        }

        if ($this->max_uses_per_user !== null && $this->usesByUser($userId) >= $this->max_uses_per_user) {
            return false;
        }

        return true;
    }

    /**
     * Calculate discount for a given amount (in paise).
     */
    public function calculateDiscount(int $amount): int
    {
        if ($this->discount_type === 'percentage') {
            return (int) round($amount * $this->discount_value / 100);
        }

        // Fixed discount (value stored in paise)
        return min($this->discount_value, $amount);
    }
}
