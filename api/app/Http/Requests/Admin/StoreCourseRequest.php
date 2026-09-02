<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Middleware handles auth
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'short_description' => ['nullable', 'string', 'max:1000'],
            // 'online'/'offline' are the schema's own vocabulary (the column
            // defaults to 'online'), so rows that predate this rule stay
            // editable instead of 422-ing on a field the editor never touched.
            'mode' => ['required', 'string', 'in:online,offline,hybrid,live,recorded'],
            'syllabus' => ['nullable', 'array'],
            'faq' => ['nullable', 'array'],
            'exam_category' => ['required', 'string', Rule::in(config('exams.categories'))],
            // 16:9 so one piece of art crops cleanly into both the thumbnail
            // and the course banner. Max 2MB.
            'thumbnail' => ['nullable', 'image', 'max:2048', 'mimes:jpeg,png,jpg,webp', 'dimensions:ratio=16/9,min_width=640'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:courses,slug'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_published' => ['boolean'],
        ];
    }
}
