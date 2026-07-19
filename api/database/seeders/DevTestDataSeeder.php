<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Course;
use App\Models\Batch;
use App\Models\Enrollment;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\TestSectionQuestion;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DevTestDataSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Ensure test student exists and has password 'password'
        $student = User::where('email', 'student@test.com')->first();
        if ($student) {
            $student->update([
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]);
        } else {
            $student = User::create([
                'name' => 'Test Student',
                'email' => 'student@test.com',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]);
            $student->assignRole('student');
        }

        // 2. Create a Course
        $course = Course::create([
            'title' => 'SSC CGL Quant Booster',
            'slug' => 'ssc-cgl-quant-booster',
            'description' => 'Comprehensive Mock Test & Practice series for SSC CGL Tier-1 and Tier-2 preparation.',
            'short_description' => 'Quant and English full syllabus mock test practice.',
            'mode' => 'hybrid',
            'exam_category' => 'SSC',
            'syllabus' => ['Quantitative Aptitude', 'English Language', 'General Intelligence'],
            'faq' => [
                ['question' => 'Is this valid for CGL 2026?', 'answer' => 'Yes, updated according to the latest pattern.'],
            ]
        ]);

        // 3. Create a Batch
        $batch = Batch::create([
            'course_id' => $course->id,
            'name' => 'July 2026 Super 30',
            'max_students' => 30,
        ]);

        // 4. Enroll Student
        Enrollment::create([
            'user_id' => $student->id,
            'course_id' => $course->id,
            'batch_id' => $batch->id,
            'enrolled_at' => now(),
            'is_active' => true,
        ]);

        // 5. Create a Mock Test with sectional timing (2 minutes total)
        $test = Test::create([
            'title' => 'CGL Tier-1 CBT Mock #01',
            'course_id' => $course->id,
            'batch_id' => $batch->id,
            'type' => 'mock',
            'duration_seconds' => 120, // 2 mins total
            'total_marks' => 8.00,
            'is_published' => true,
            'max_attempts' => 3,
            'created_by' => 1,
        ]);

        // 6. Section 1 (English, 60 seconds limit)
        $section1 = TestSection::create([
            'test_id' => $test->id,
            'title' => 'English Language',
            'sort_order' => 0,
            'duration_seconds' => 60,
        ]);

        // 7. Section 2 (Quantitative Aptitude, 60 seconds limit)
        $section2 = TestSection::create([
            'test_id' => $test->id,
            'title' => 'Quantitative Aptitude',
            'sort_order' => 1,
            'duration_seconds' => 60,
        ]);

        // 8. Questions for Section 1 (English)
        $q1 = Question::create([
            'subject' => 'English',
            'topic' => 'Spotting Error',
            'difficulty' => 'easy',
            'question_text' => 'Identify the grammatical error in: "The student was sleeping when the alarm bell rings."',
            'marks' => 2.00,
            'explanation' => 'The sentence is in past continuous form, so the past tense "rang" should be used instead of "rings".',
        ]);
        QuestionOption::create(['question_id' => $q1->id, 'label' => 'a', 'option_text' => 'when the alarm', 'is_correct' => false]);
        QuestionOption::create(['question_id' => $q1->id, 'label' => 'b', 'option_text' => 'bell rings', 'is_correct' => true]);
        QuestionOption::create(['question_id' => $q1->id, 'label' => 'c', 'option_text' => 'was sleeping', 'is_correct' => false]);
        QuestionOption::create(['question_id' => $q1->id, 'label' => 'd', 'option_text' => 'No error', 'is_correct' => false]);

        TestSectionQuestion::create([
            'test_section_id' => $section1->id,
            'question_id' => $q1->id,
            'sort_order' => 0,
        ]);

        $q2 = Question::create([
            'subject' => 'English',
            'topic' => 'Vocabulary',
            'difficulty' => 'medium',
            'question_text' => 'What is the synonym of "ABANDON"?',
            'marks' => 2.00,
            'explanation' => 'To abandon means to desert or give up completely.',
        ]);
        QuestionOption::create(['question_id' => $q2->id, 'label' => 'a', 'option_text' => 'Maintain', 'is_correct' => false]);
        QuestionOption::create(['question_id' => $q2->id, 'label' => 'b', 'option_text' => 'Forsake', 'is_correct' => true]);
        QuestionOption::create(['question_id' => $q2->id, 'label' => 'c', 'option_text' => 'Retain', 'is_correct' => false]);
        QuestionOption::create(['question_id' => $q2->id, 'label' => 'd', 'option_text' => 'Adopt', 'is_correct' => false]);

        TestSectionQuestion::create([
            'test_section_id' => $section1->id,
            'question_id' => $q2->id,
            'sort_order' => 1,
        ]);

        // 9. Questions for Section 2 (Math - with LaTeX formulas!)
        $q3 = Question::create([
            'subject' => 'Math',
            'topic' => 'Algebra',
            'difficulty' => 'medium',
            'question_text' => 'If $x + \frac{1}{x} = 5$, find the value of $x^2 + \frac{1}{x^2}$.',
            'marks' => 2.00,
            'explanation' => 'Squaring both sides: $(x + \frac{1}{x})^2 = 5^2 \implies x^2 + \frac{1}{x^2} + 2 = 25 \implies x^2 + \frac{1}{x^2} = 23$.',
        ]);
        QuestionOption::create(['question_id' => $q3->id, 'label' => 'a', 'option_text' => '$25$', 'is_correct' => false]);
        QuestionOption::create(['question_id' => $q3->id, 'label' => 'b', 'option_text' => '$23$', 'is_correct' => true]);
        QuestionOption::create(['question_id' => $q3->id, 'label' => 'c', 'option_text' => '$27$', 'is_correct' => false]);
        QuestionOption::create(['question_id' => $q3->id, 'label' => 'd', 'option_text' => '$21$', 'is_correct' => false]);

        TestSectionQuestion::create([
            'test_section_id' => $section2->id,
            'question_id' => $q3->id,
            'sort_order' => 0,
        ]);

        $q4 = Question::create([
            'subject' => 'Math',
            'topic' => 'Trigonometry',
            'difficulty' => 'hard',
            'question_text' => 'Evaluate: $\int \sin^2(x) \cos(x) dx$. Choose the correct answer representation.',
            'marks' => 2.00,
            'explanation' => 'Let $u = \sin(x) \implies du = \cos(x) dx$. The integral becomes $\int u^2 du = \frac{u^3}{3} + C = \frac{\sin^3(x)}{3} + C$.',
        ]);
        QuestionOption::create(['question_id' => $q4->id, 'label' => 'a', 'option_text' => '$\frac{\sin^3(x)}{3} + C$', 'is_correct' => true]);
        QuestionOption::create(['question_id' => $q4->id, 'label' => 'b', 'option_text' => '$\frac{\cos^3(x)}{3} + C$', 'is_correct' => false]);
        QuestionOption::create(['question_id' => $q4->id, 'label' => 'c', 'option_text' => '$\sin^3(x) + C$', 'is_correct' => false]);
        QuestionOption::create(['question_id' => $q4->id, 'label' => 'd', 'option_text' => '$\frac{\sin^2(x)}{2} + C$', 'is_correct' => false]);

        TestSectionQuestion::create([
            'test_section_id' => $section2->id,
            'question_id' => $q4->id,
            'sort_order' => 1,
        ]);
    }
}
