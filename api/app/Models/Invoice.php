<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    protected $fillable = [
        'payment_id',
        'user_id',
        'invoice_number',
        'financial_year',
        'sequence',
        'issued_at',
        'seller_name',
        'seller_address',
        'seller_gstin',
        'seller_state',
        'sac_code',
        'buyer_name',
        'buyer_email',
        'description',
        'total_paise',
        'taxable_paise',
        'gst_rate',
        'cgst_paise',
        'sgst_paise',
        'igst_paise',
        'is_tax_invoice',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'datetime',
            'is_tax_invoice' => 'boolean',
            'gst_rate' => 'decimal:2',
        ];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Rupee view of any paise column, for display and templates. */
    public function rupees(string $column): string
    {
        return number_format(((int) $this->{$column}) / 100, 2);
    }
}
