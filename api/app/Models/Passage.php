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
        'created_by',
    ];

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
