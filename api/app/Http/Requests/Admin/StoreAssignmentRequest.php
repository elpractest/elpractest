<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreAssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && ($this->user()->hasRole('admin') || $this->user()->hasRole('super-admin'));
    }

    public function rules(): array
    {
        return [
            'batch_ids' => ['required', 'array', 'min:1'],
            'batch_ids.*' => ['required', 'exists:batches,id'],
            'assignable_type' => ['required', 'string', 'in:series,test,App\\Models\\TestSeries,App\\Models\\Test'],
            'assignable_id' => ['required', 'integer'],
            'available_from' => ['nullable', 'date'],
            'due_at' => ['nullable', 'date', 'after_or_equal:available_from'],
        ];
    }
}
