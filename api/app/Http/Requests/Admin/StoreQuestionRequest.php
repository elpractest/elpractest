<?php

namespace App\Http\Requests\Admin;

use App\Models\Question;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Spatie role middleware handles authorization
    }

    public function rules(): array
    {
        $type = $this->input('question_type', Question::TYPE_SINGLE_CHOICE);
        $isNumeric = $type === Question::TYPE_NUMERIC;

        return [
            'subject' => ['required', 'string', 'max:255'],
            'topic' => ['required', 'string', 'max:255'],
            'difficulty' => ['required', 'string', 'in:easy,medium,hard'],
            'exam_tags' => ['nullable', 'array'],
            'exam_tags.*' => ['string'],
            'question_text' => ['required', 'string'],
            // The question's own diagram — a figure a single question
            // refers to, not the shared exhibit a whole passage-linked SET
            // reads (that lives on the passage — see passage_id below).
            // 4MB comfortably covers a scanned diagram; a chart this size
            // rendered on a phone gains nothing from being any bigger.
            'image' => ['nullable', 'image', 'max:4096', 'mimes:jpeg,png,jpg,webp'],
            'explanation' => ['nullable', 'string'],
            'marks' => ['required', 'numeric', 'min:0'],
            'negative_marks' => ['required', 'numeric', 'min:0'],
            'question_type' => ['nullable', 'string', Rule::in(Question::QUESTION_TYPES)],
            'passage_id' => ['nullable', 'integer', 'exists:passages,id'],

            // Choice-based types (single_choice, multi_select) carry options;
            // numeric carries an answer + tolerance instead.
            'options' => [$isNumeric ? 'prohibited' : 'required', 'array', 'min:2', 'max:6'],
            'options.*.label' => ['required_with:options', 'string', 'size:1', 'in:a,b,c,d,e,f'],
            // An option needs EITHER text or its own image, not necessarily
            // both — "which figure completes the series" reasoning
            // questions (SSC CGL/CHSL non-verbal reasoning) have four image
            // options with nothing meaningful to caption them with. Cross-
            // checked properly (rejecting an option with NEITHER) in
            // validateOptions() below, since that needs to see both
            // sibling fields together.
            'options.*.option_text' => ['nullable', 'string'],
            'options.*.image' => ['nullable', 'image', 'max:4096', 'mimes:jpeg,png,jpg,webp'],
            // Options are replaced wholesale on every save (delete + recreate
            // — see QuestionController::update), so there is no option ROW to
            // attach a new upload to and no way to say "leave the old image
            // alone" implicitly. An edit that is not re-uploading a file
            // carries the existing path back as a plain string instead, and
            // the controller keeps it for the recreated row.
            'options.*.image_path' => ['nullable', 'string'],
            'options.*.is_correct' => ['required_with:options', 'boolean'],
            'numeric_answer' => [$isNumeric ? 'required' : 'prohibited', 'numeric'],
            'numeric_tolerance' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    /**
     * single_choice: exactly one correct option (the CBT player can only submit
     * one, so more than one is unreachable and zero is unscoreable).
     * multi_select: at least one correct option — several may be true, matching
     * SSC/RRB statement-based questions ("which of the above are correct?").
     *
     * Either way, zero correct options silently corrupts every score the
     * question takes part in, which is why this is a hard validation.
     */
    protected function validateOptions($validator): void
    {
        $type = $this->input('question_type', Question::TYPE_SINGLE_CHOICE);
        if ($type === Question::TYPE_NUMERIC) {
            return;
        }

        $options = $this->input('options');
        if (!is_array($options) || $options === []) {
            return; // the `required` rule above already reports this
        }

        $correct = 0;
        foreach ($options as $index => $option) {
            if (is_array($option) && filter_var($option['is_correct'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
                $correct++;
            }

            // An option with neither text nor an image (new upload or a
            // carried-over path) is empty — the one thing `nullable` on
            // both fields cannot catch on its own, since either alone
            // satisfies it.
            $hasText = is_array($option) && trim((string) ($option['option_text'] ?? '')) !== '';
            $hasImage = $this->hasFile("options.{$index}.image")
                || (is_array($option) && trim((string) ($option['image_path'] ?? '')) !== '');
            if (is_array($option) && !$hasText && !$hasImage) {
                $label = strtoupper((string) ($option['label'] ?? $index));
                $validator->errors()->add('options', "Option {$label} needs either text or an image.");
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
