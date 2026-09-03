<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReadingProgress extends Model
{
    protected $table = 'reading_progress';

    protected $fillable = [
        'user_id',
        'study_material_id',
        'current_page',
        'percent_complete',
        'seconds_read',
        'bookmarks',
        'last_read_at',
    ];

    protected function casts(): array
    {
        return [
            'bookmarks' => 'array',
            'last_read_at' => 'datetime',
            'current_page' => 'integer',
            'percent_complete' => 'integer',
            'seconds_read' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(StudyMaterial::class, 'study_material_id');
    }
}
