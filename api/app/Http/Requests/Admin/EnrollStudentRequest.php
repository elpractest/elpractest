<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EnrollStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id' => ['required', 'exists:users,id'],
            'course_id' => ['required', 'exists:courses,id'],
            'batch_id' => [
                'required',
                'exists:batches,id',
                Rule::exists('batches', 'id')->where('course_id', $this->course_id),
            ],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ];
    }

    public function messages(): array
    {
        return [
            'batch_id.exists' => 'The selected batch must belong to the selected course.',
        ];
    }
}
