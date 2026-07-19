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
