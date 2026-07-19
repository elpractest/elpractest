<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'course_id' => ['nullable', 'exists:courses,id'],
            'batch_id' => ['nullable', 'exists:batches,id'],
            'type' => ['sometimes', 'required', 'string', 'in:practice,mock'],
            'duration_seconds' => ['required_if:type,mock', 'nullable', 'integer', 'min:30'],
            'max_attempts' => ['nullable', 'integer', 'min:1'],
            'instructions' => ['nullable', 'string'],
            'available_from' => ['nullable', 'date'],
            'available_until' => ['nullable', 'date', 'after:available_from'],
            
            'sections' => ['sometimes', 'required', 'array', 'min:1'],
            'sections.*.title' => ['required_with:sections', 'string', 'max:255'],
            'sections.*.duration_seconds' => ['nullable', 'integer', 'min:10'],
            'sections.*.question_ids' => ['required_with:sections', 'array', 'min:1'],
            'sections.*.question_ids.*' => ['required_with:sections', 'exists:questions,id'],
        ];
    }

    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $sections = $this->input('sections', []);
            $allQuestionIds = [];
            foreach ($sections as $section) {
                if (isset($section['question_ids']) && is_array($section['question_ids'])) {
                    foreach ($section['question_ids'] as $qId) {
                        if (in_array($qId, $allQuestionIds)) {
                            $validator->errors()->add('sections', "Duplicate question ID {$qId} found across test sections.");
                        }
                        $allQuestionIds[] = $qId;
                    }
                }
            }
        });
    }
}
