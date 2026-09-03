<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaterialAnnotation extends Model
{
    public const TYPES = ['highlight', 'note'];

    /** Mirrors HIGHLIGHT_SWATCHES in app/src/components/reader/palette.js. */
    public const COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'];

    protected $fillable = [
        'user_id',
        'study_material_id',
        'type',
        'color',
        'page',
        'selected_text',
        'note',
        'rects',
    ];

    protected function casts(): array
    {
        return [
            'rects' => 'array',
            'page' => 'integer',
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
