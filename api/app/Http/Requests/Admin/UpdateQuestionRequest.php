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

    /**
     * Exactly one option must be marked correct.
     *
     * Without this a question can be saved with zero correct options (nobody can
     * ever score it) or several (the single-select CBT player can only submit one,
     * so the rest are unreachable). Both silently corrupt every score the question
     * takes part in, which is why it is a hard validation rather than a warning.
     */
    protected function validateExactlyOneCorrect($validator): void
    {
        $options = $this->input('options');
        if (!is_array($options) || $options === []) {
            return; // `sometimes`/`nullable` handles absence; nothing to check
        }

        $correct = 0;
        foreach ($options as $option) {
            if (is_array($option) && filter_var($option['is_correct'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
                $correct++;
            }
        }

        if ($correct !== 1) {
            $validator->errors()->add(
                'options',
                "Exactly one option must be marked correct ({$correct} were)."
            );
        }

        $labels = array_map(
            fn ($o) => strtolower(trim((string) ($o['label'] ?? ''))),
            array_filter($options, 'is_array')
        );
        if (count($labels) !== count(array_unique($labels))) {
            $validator->errors()->add('options', 'Option labels must be unique.');
        }
    }

    public function withValidator($validator): void
    {
        $validator->after(fn ($v) => $this->validateExactlyOneCorrect($v));
    }
}
