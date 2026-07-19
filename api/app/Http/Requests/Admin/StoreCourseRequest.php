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
            'mode' => ['required', 'string', 'in:live,recorded,hybrid'],
            'syllabus' => ['nullable', 'array'],
            'faq' => ['nullable', 'array'],
            'exam_category' => ['required', 'string', 'in:SSC,Banking,RRB,UPSC,State PCS'],
            'thumbnail' => ['nullable', 'image', 'max:2048'], // Max 2MB
            'is_published' => ['boolean'],
        ];
    }
}
