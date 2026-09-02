<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Payment extends Model
{
    protected $fillable = [
        'user_id',
        'product_id',
        'course_id',
        'batch_id',
        'razorpay_order_id',
        'razorpay_payment_id',
        'razorpay_signature',
        'google_play_purchase_token',
        'google_play_order_id',
        'google_play_product_id',
        'amount',
        'currency',
        'status',
        'coupon_id',
        'event_id',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopePaid($query)
    {
        return $query->where('status', 'paid');
    }

    /**
     * Get amount in rupees (stored in paise).
     */
    public function getAmountInRupeesAttribute(): float
    {
        return $this->amount / 100;
    }
}
