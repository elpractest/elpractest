<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'group',
    ];

    /**
     * Scope to filter by group.
     */
    public function scopeGroup($query, string $group)
    {
        return $query->where('group', $group);
    }

    /**
     * Get the typed value (auto-decode JSON if applicable).
     */
    public function getTypedValueAttribute(): mixed
    {
        $decoded = json_decode($this->value, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $this->value;
    }
}
