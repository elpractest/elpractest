<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Spatie role middleware handles authorization
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'max:255'],
            'topic' => ['required', 'string', 'max:255'],
            'difficulty' => ['required', 'string', 'in:easy,medium,hard'],
            'exam_tags' => ['nullable', 'array'],
            'exam_tags.*' => ['string'],
            'question_text' => ['required', 'string'],
            'explanation' => ['nullable', 'string'],
            'marks' => ['required', 'numeric', 'min:0'],
            'negative_marks' => ['required', 'numeric', 'min:0'],
            'options' => ['required', 'array', 'min:4', 'max:6'],
            'options.*.label' => ['required', 'string', 'size:1', 'in:a,b,c,d,e,f'],
            'options.*.option_text' => ['required', 'string'],
            'options.*.is_correct' => ['required', 'boolean'],
        ];
    }
}
