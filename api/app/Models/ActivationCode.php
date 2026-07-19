<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ActivationCode extends Model
{
    /**
     * Characters used for code generation.
     * Excludes visually ambiguous: 0/O, 1/I/l
     */
    private const CODE_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

    protected $fillable = [
        'code',
        'course_id',
        'batch_id',
        'max_uses',
        'times_used',
        'expires_at',
        'generated_by',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    // ── Helpers ────────────────────────────────────────────────────

    /**
     * Check if this code can still be redeemed.
     */
    public function isRedeemable(): bool
    {
        if ($this->times_used >= $this->max_uses) {
            return false;
        }

        if ($this->expires_at && $this->expires_at->isPast()) {
            return false;
        }

        return true;
    }

    /**
     * Generate a unique, ambiguity-free activation code.
     */
    public static function generateUniqueCode(int $length = 8): string
    {
        do {
            $code = '';
            $charsetLength = strlen(self::CODE_CHARSET);
            for ($i = 0; $i < $length; $i++) {
                $code .= self::CODE_CHARSET[random_int(0, $charsetLength - 1)];
            }
        } while (static::where('code', $code)->exists());

        return $code;
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopeRedeemable($query)
    {
        return $query->whereColumn('times_used', '<', 'max_uses')
            ->where(function ($q) {
                $q->whereNull('expires_at')
                  ->orWhere('expires_at', '>', now());
            });
    }
}
