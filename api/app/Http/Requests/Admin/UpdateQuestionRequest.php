<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subject' => ['sometimes', 'required', 'string', 'max:255'],
            'topic' => ['sometimes', 'required', 'string', 'max:255'],
            'difficulty' => ['sometimes', 'required', 'string', 'in:easy,medium,hard'],
            'exam_tags' => ['nullable', 'array'],
            'exam_tags.*' => ['string'],
            'question_text' => ['sometimes', 'required', 'string'],
            'explanation' => ['nullable', 'string'],
            'marks' => ['sometimes', 'required', 'numeric', 'min:0'],
            'negative_marks' => ['sometimes', 'required', 'numeric', 'min:0'],
            'options' => ['nullable', 'array', 'min:4', 'max:6'],
            'options.*.label' => ['required_with:options', 'string', 'size:1', 'in:a,b,c,d,e,f'],
            'options.*.option_text' => ['required_with:options', 'string'],
            'options.*.is_correct' => ['required_with:options', 'boolean'],
        ];
    }
}
