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
            // See StoreCourseRequest: 'online'/'offline' are the schema's own
            // values, kept accepted so rows that predate the rule stay editable.
            'mode' => ['sometimes', 'required', 'string', 'in:online,offline,hybrid,live,recorded'],
            'syllabus' => ['nullable', 'array'],
            'faq' => ['nullable', 'array'],
            'exam_category' => ['sometimes', 'required', 'string', 'in:SSC,Banking,RRB,UPSC,State PCS'],
            // Kept byte-identical to StoreCourseRequest — see the note there.
            'thumbnail' => ['nullable', 'image', 'max:2048', 'mimes:jpeg,png,jpg,webp', 'dimensions:ratio=16/9,min_width=640'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_published' => ['boolean'],
        ];
    }
}
