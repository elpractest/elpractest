<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreLessonRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'video_provider' => ['required', 'string', 'in:youtube'],
            'video_id' => ['required', 'string', 'max:255'],
            'duration_seconds' => ['required', 'integer', 'min:0'],
            'sort_order' => ['integer'],
            'is_free_preview' => ['boolean'],
        ];
    }
}
