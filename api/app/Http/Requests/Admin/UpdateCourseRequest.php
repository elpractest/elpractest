<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $course = $this->route('course');
        $courseId = is_object($course) ? $course->id : $course;

        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:courses,slug,' . $courseId],
            'description' => ['sometimes', 'required', 'string'],
            'short_description' => ['nullable', 'string', 'max:1000'],
            'mode' => ['sometimes', 'required', 'string', 'in:live,recorded,hybrid'],
            'syllabus' => ['nullable', 'array'],
            'faq' => ['nullable', 'array'],
            'exam_category' => ['sometimes', 'required', 'string', 'in:SSC,Banking,RRB,UPSC,State PCS'],
            'thumbnail' => ['nullable', 'image', 'max:2048'],
            'is_published' => ['boolean'],
        ];
    }
}
