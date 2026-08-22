<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

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
            'exam_category' => ['required', 'string', 'in:SSC,Banking,RRB,UPSC,State PCS'],
            'thumbnail' => ['nullable', 'image', 'max:2048'], // Max 2MB
            'slug' => ['nullable', 'string', 'max:255', 'unique:courses,slug'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_published' => ['boolean'],
        ];
    }
}
