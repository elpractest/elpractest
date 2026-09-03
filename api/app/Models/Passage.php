<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Passage extends Model
{
    protected $fillable = [
        'title',
        'body',
        'image_path',
        'table_data',
        'created_by',
    ];

    protected $appends = ['image_url'];

    protected function casts(): array
    {
        return [
            // {headers: string[], rows: string[][]} — a Data Interpretation
            // table rendered client-side as a real <table>, not an image:
            // crisp at any zoom, selectable, and costs no storage.
            'table_data' => 'array',
        ];
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? \Illuminate\Support\Facades\Storage::disk('public')->url($this->image_path) : null;
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
