<?php

namespace App\Http\Requests\Admin;

use App\Models\Question;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // On update, question_type may be omitted (unchanged) — fall back to the
        // existing row's type so option/numeric requirements still apply correctly.
        $type = $this->input('question_type') ?? $this->route('question')?->question_type ?? Question::TYPE_SINGLE_CHOICE;
        $isNumeric = $type === Question::TYPE_NUMERIC;

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
            'question_type' => ['nullable', 'string', Rule::in(Question::QUESTION_TYPES)],
            'passage_id' => ['nullable', 'integer', 'exists:passages,id'],

            'options' => [$isNumeric ? 'prohibited' : 'nullable', 'array', 'min:2', 'max:6'],
            'options.*.label' => ['required_with:options', 'string', 'size:1', 'in:a,b,c,d,e,f'],
            'options.*.option_text' => ['required_with:options', 'string'],
            'options.*.is_correct' => ['required_with:options', 'boolean'],
            'numeric_answer' => [$isNumeric ? 'sometimes' : 'prohibited', 'numeric'],
            'numeric_tolerance' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    /**
     * Same rule as create: single_choice needs exactly one correct option,
     * multi_select needs at least one. See StoreQuestionRequest for why.
     */
    protected function validateOptions($validator): void
    {
        $type = $this->input('question_type') ?? $this->route('question')?->question_type ?? Question::TYPE_SINGLE_CHOICE;
        if ($type === Question::TYPE_NUMERIC) {
            return;
        }

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

        if ($type === Question::TYPE_SINGLE_CHOICE && $correct !== 1) {
            $validator->errors()->add(
                'options',
                "Exactly one option must be marked correct ({$correct} were)."
            );
        } elseif ($type === Question::TYPE_MULTI_SELECT && $correct < 1) {
            $validator->errors()->add('options', 'At least one option must be marked correct.');
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
        $validator->after(fn ($v) => $this->validateOptions($v));
    }
}
