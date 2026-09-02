<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * A sellable thing: one course, one test series, or a bundle of several.
 *
 * The type is a label for the storefront, not a branch in the grant path —
 * every product hands over whatever sits in `items`, however many that is.
 */
class Product extends Model
{
    use SoftDeletes;

    public const TYPE_COURSE = 'course';
    public const TYPE_TEST_SERIES = 'test_series';
    public const TYPE_BUNDLE = 'bundle';

    public const TYPES = [
        self::TYPE_COURSE,
        self::TYPE_TEST_SERIES,
        self::TYPE_BUNDLE,
    ];

    protected $fillable = [
        'type',
        'title',
        'slug',
        'description',
        'short_description',
        'exam_category',
        'price_paise',
        'list_price_paise',
        'access_days',
        'play_product_id',
        'thumbnail_path',
        'is_published',
        'sort_order',
        'created_by',
    ];

    protected $appends = [
        'price_rupees',
        'list_price_rupees',
        'thumbnail_url',
        'savings_percent',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'price_paise' => 'integer',
            'list_price_paise' => 'integer',
            'access_days' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Product $product) {
            if (empty($product->slug)) {
                $base = Str::slug($product->title);
                $slug = $base;
                $n = 2;

                // Titles repeat across years ("SSC CGL 2026 Test Series"), and a
                // duplicate slug would 500 on a unique-constraint violation
                // rather than telling the admin anything useful.
                while (static::withTrashed()->where('slug', $slug)->exists()) {
                    $slug = "{$base}-{$n}";
                    $n++;
                }

                $product->slug = $slug;
            }
        });
    }

    public function items(): HasMany
    {
        return $this->hasMany(ProductItem::class)->orderBy('sort_order');
    }

    public function entitlements(): HasMany
    {
        return $this->hasMany(Entitlement::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getPriceRupeesAttribute(): float
    {
        return $this->price_paise / 100;
    }

    public function getListPriceRupeesAttribute(): ?float
    {
        return $this->list_price_paise === null ? null : $this->list_price_paise / 100;
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        return $this->thumbnail_path
            ? \Illuminate\Support\Facades\Storage::disk('public')->url($this->thumbnail_path)
            : null;
    }

    /**
     * Whole-number discount off the struck-through price, or null when there is
     * nothing to strike through. Rounded down so the badge never overstates it.
     */
    public function getSavingsPercentAttribute(): ?int
    {
        if (!$this->list_price_paise || $this->list_price_paise <= $this->price_paise) {
            return null;
        }

        return (int) floor(
            (($this->list_price_paise - $this->price_paise) / $this->list_price_paise) * 100
        );
    }

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }
}
