<?php

namespace Database\Seeders;

use App\Models\ActivationCode;
use App\Models\Batch;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Lesson;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use Illuminate\Database\Seeder;

/**
 * Seeds demo content for QA end-to-end testing.
 *
 * Creates: a published course with a priced batch, one module with a real
 * YouTube lesson, a published sectional mock test with 6 questions, and a
 * pre-generated activation code.
 *
 * GUARD: Refuses to run when APP_ENV=production.
 */
class DevDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command->error('DevDemoSeeder cannot run in production. Aborting.');
            return;
        }

        $this->command->info('Seeding demo content for QA testing...');

        // ── 1. Publish the existing course & set batch price ──────────
        $course = Course::where('slug', 'ssc-cgl-quant-booster')->first();

        if (!$course) {
            $this->command->error('Course "ssc-cgl-quant-booster" not found. Run DatabaseSeeder first.');
            return;
        }

        $course->update(['is_published' => true]);
        $this->command->info('✓ Course published: ' . $course->title);

        $batch = Batch::where('course_id', $course->id)->first();
        if ($batch) {
            $batch->update(['price_paise' => 99900]); // ₹999
            $this->command->info('✓ Batch price set: ₹999 (' . $batch->name . ')');
        }

        // ── 2. Create a module with a real YouTube lesson ─────────────
        $module = CourseModule::firstOrCreate(
            ['course_id' => $course->id, 'title' => 'Quantitative Aptitude Foundations'],
            ['sort_order' => 0]
        );
        $this->command->info('✓ Module created: ' . $module->title);

        // Using a well-known public video (Rick Astley - Never Gonna Give You Up)
        // This is a widely-available unlisted-safe video for testing embeds.
        // Duration: 212 seconds (3:32)
        $lesson = Lesson::firstOrCreate(
            ['module_id' => $module->id, 'title' => 'Number System Basics — HCF & LCM'],
            [
                'video_provider' => 'youtube',
                'video_id' => 'dQw4w9WgXcQ',
                'duration_seconds' => 212,
                'sort_order' => 0,
                'is_free_preview' => false,
            ]
        );
        $this->command->info('✓ Lesson created: ' . $lesson->title);

        // Add a free preview lesson too (for testing that path)
        $freeLesson = Lesson::firstOrCreate(
            ['module_id' => $module->id, 'title' => 'Course Introduction — What to Expect'],
            [
                'video_provider' => 'youtube',
                'video_id' => '9bZkp7q19f0',
                'duration_seconds' => 252,
                'sort_order' => 1,
                'is_free_preview' => true,
            ]
        );
        $this->command->info('✓ Free preview lesson created: ' . $freeLesson->title);

        // ── 3. Create a sectional mock test with 6 questions ──────────
        // Check if test already exists to support idempotent runs
        $demoTest = Test::where('title', 'QA Demo Sectional Mock')->first();
        if (!$demoTest) {
            $demoTest = Test::create([
                'title' => 'QA Demo Sectional Mock',
                'course_id' => $course->id,
                'batch_id' => $batch->id,
                'type' => 'mock',
                'duration_seconds' => 180, // 3 minutes total
                'total_marks' => 12.00,
                'is_published' => true,
                'max_attempts' => 5,
                'created_by' => 1,
            ]);
            $this->command->info('✓ Mock test created: ' . $demoTest->title);

            // Section 1: General Knowledge (90 seconds)
            $section1 = TestSection::create([
                'test_id' => $demoTest->id,
                'title' => 'General Knowledge',
                'sort_order' => 0,
                'duration_seconds' => 90,
            ]);

            // Section 2: Reasoning (90 seconds)
            $section2 = TestSection::create([
                'test_id' => $demoTest->id,
                'title' => 'Reasoning',
                'sort_order' => 1,
                'duration_seconds' => 90,
            ]);

            // ── Section 1 Questions ───────────────────────────────────
            $q1 = Question::create([
                'subject' => 'GK',
                'topic' => 'Indian Polity',
                'difficulty' => 'easy',
                'question_text' => 'The Preamble to the Indian Constitution was amended by which Constitutional Amendment?',
                'marks' => 2.00,
                'negative_marks' => 0.50,
                'explanation' => 'The 42nd Constitutional Amendment (1976) added the words "Socialist", "Secular", and "Integrity" to the Preamble.',
            ]);
            QuestionOption::create(['question_id' => $q1->id, 'label' => 'a', 'option_text' => '42nd Amendment', 'is_correct' => true]);
            QuestionOption::create(['question_id' => $q1->id, 'label' => 'b', 'option_text' => '44th Amendment', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q1->id, 'label' => 'c', 'option_text' => '46th Amendment', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q1->id, 'label' => 'd', 'option_text' => '52nd Amendment', 'is_correct' => false]);
            TestSectionQuestion::create(['test_section_id' => $section1->id, 'question_id' => $q1->id, 'sort_order' => 0]);

            $q2 = Question::create([
                'subject' => 'GK',
                'topic' => 'Geography',
                'difficulty' => 'easy',
                'question_text' => 'Which river is called the "Sorrow of Bihar"?',
                'marks' => 2.00,
                'negative_marks' => 0.50,
                'explanation' => 'The Kosi river is known as the "Sorrow of Bihar" due to its frequent devastating floods.',
            ]);
            QuestionOption::create(['question_id' => $q2->id, 'label' => 'a', 'option_text' => 'Gandak', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q2->id, 'label' => 'b', 'option_text' => 'Son', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q2->id, 'label' => 'c', 'option_text' => 'Kosi', 'is_correct' => true]);
            QuestionOption::create(['question_id' => $q2->id, 'label' => 'd', 'option_text' => 'Ganga', 'is_correct' => false]);
            TestSectionQuestion::create(['test_section_id' => $section1->id, 'question_id' => $q2->id, 'sort_order' => 1]);

            $q3 = Question::create([
                'subject' => 'GK',
                'topic' => 'Economics',
                'difficulty' => 'medium',
                'question_text' => 'Which body regulates the mutual fund industry in India?',
                'marks' => 2.00,
                'negative_marks' => 0.50,
                'explanation' => 'The Securities and Exchange Board of India (SEBI) is the regulatory authority for the mutual fund industry.',
            ]);
            QuestionOption::create(['question_id' => $q3->id, 'label' => 'a', 'option_text' => 'RBI', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q3->id, 'label' => 'b', 'option_text' => 'SEBI', 'is_correct' => true]);
            QuestionOption::create(['question_id' => $q3->id, 'label' => 'c', 'option_text' => 'IRDA', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q3->id, 'label' => 'd', 'option_text' => 'NABARD', 'is_correct' => false]);
            TestSectionQuestion::create(['test_section_id' => $section1->id, 'question_id' => $q3->id, 'sort_order' => 2]);

            // ── Section 2 Questions ───────────────────────────────────
            $q4 = Question::create([
                'subject' => 'Reasoning',
                'topic' => 'Analogy',
                'difficulty' => 'easy',
                'question_text' => 'Pen : Write :: Knife : ?',
                'marks' => 2.00,
                'negative_marks' => 0.50,
                'explanation' => 'A pen is used to write; a knife is used to cut. The relationship is tool → function.',
            ]);
            QuestionOption::create(['question_id' => $q4->id, 'label' => 'a', 'option_text' => 'Sharpen', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q4->id, 'label' => 'b', 'option_text' => 'Cut', 'is_correct' => true]);
            QuestionOption::create(['question_id' => $q4->id, 'label' => 'c', 'option_text' => 'Stab', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q4->id, 'label' => 'd', 'option_text' => 'Slice', 'is_correct' => false]);
            TestSectionQuestion::create(['test_section_id' => $section2->id, 'question_id' => $q4->id, 'sort_order' => 0]);

            $q5 = Question::create([
                'subject' => 'Reasoning',
                'topic' => 'Series',
                'difficulty' => 'medium',
                'question_text' => 'Find the next number in the series: 2, 6, 12, 20, 30, ?',
                'marks' => 2.00,
                'negative_marks' => 0.50,
                'explanation' => 'The pattern is: n(n+1) where n = 1,2,3,4,5,6... So 6×7 = 42.',
            ]);
            QuestionOption::create(['question_id' => $q5->id, 'label' => 'a', 'option_text' => '40', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q5->id, 'label' => 'b', 'option_text' => '42', 'is_correct' => true]);
            QuestionOption::create(['question_id' => $q5->id, 'label' => 'c', 'option_text' => '36', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q5->id, 'label' => 'd', 'option_text' => '44', 'is_correct' => false]);
            TestSectionQuestion::create(['test_section_id' => $section2->id, 'question_id' => $q5->id, 'sort_order' => 1]);

            $q6 = Question::create([
                'subject' => 'Reasoning',
                'topic' => 'Coding-Decoding',
                'difficulty' => 'medium',
                'question_text' => 'If COMPUTER is coded as RFUVQNPD, how is MACHINE coded?',
                'marks' => 2.00,
                'negative_marks' => 0.50,
                'explanation' => 'Each letter is reversed in order (A↔Z, B↔Y, etc.) and then the string is reversed. MACHINE → FNIHCAM (reverse of complement).',
            ]);
            QuestionOption::create(['question_id' => $q6->id, 'label' => 'a', 'option_text' => 'FNIHCAM', 'is_correct' => true]);
            QuestionOption::create(['question_id' => $q6->id, 'label' => 'b', 'option_text' => 'ENIHDAM', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q6->id, 'label' => 'c', 'option_text' => 'NBDIJOF', 'is_correct' => false]);
            QuestionOption::create(['question_id' => $q6->id, 'label' => 'd', 'option_text' => 'GOJIDBN', 'is_correct' => false]);
            TestSectionQuestion::create(['test_section_id' => $section2->id, 'question_id' => $q6->id, 'sort_order' => 2]);

            $this->command->info('✓ 6 questions created across 2 sections');
        } else {
            $this->command->info('↳ Mock test already exists, skipping question creation');
        }

        // ── 4. Generate an activation code ────────────────────────────
        $existingCode = ActivationCode::where('course_id', $course->id)
            ->where('batch_id', $batch->id)
            ->where('generated_by', 1)
            ->first();

        if (!$existingCode) {
            $code = ActivationCode::create([
                'code' => ActivationCode::generateUniqueCode(),
                'course_id' => $course->id,
                'batch_id' => $batch->id,
                'max_uses' => 10,
                'times_used' => 0,
                'expires_at' => now()->addMonths(3),
                'generated_by' => 1,
            ]);
            $this->command->info('✓ Activation code generated: ' . $code->code);
        } else {
            $this->command->info('↳ Activation code already exists: ' . $existingCode->code);
        }

        $this->command->info('');
        $this->command->info('Demo content seeded successfully! Ready for QA testing.');
    }
}
