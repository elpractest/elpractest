<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Assignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'batch_id',
        'assignable_type',
        'assignable_id',
        'available_from',
        'due_at',
        'assigned_by',
        'is_active',
    ];

    protected $casts = [
        'available_from' => 'datetime',
        'due_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function assignable(): MorphTo
    {
        return $this->morphTo();
    }

    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
