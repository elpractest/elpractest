<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Course;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicCourseApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_courses_returns_only_published_with_active_priced_batches(): void
    {
        // 1. Published course with active priced batch -> should return
        $course1 = Course::create([
            'title' => 'Math Special',
            'slug' => 'math-special',
            'exam_category' => 'SSC',
            'mode' => 'recorded',
            'is_published' => true,
        ]);
        $batch1 = Batch::create([
            'course_id' => $course1->id,
            'name' => 'Morning Batch',
            'price_paise' => 99900,
            'is_active' => true,
        ]);

        // 2. Published course with unpriced batch -> should return course, but batch is withheld from list
        $course2 = Course::create([
            'title' => 'English Special',
            'slug' => 'english-special',
            'exam_category' => 'SSC',
            'mode' => 'recorded',
            'is_published' => true,
        ]);
        $batch2 = Batch::create([
            'course_id' => $course2->id,
            'name' => 'Free Trial Batch',
            'price_paise' => null, // Free/Unpriced
            'is_active' => true,
        ]);

        // 3. Draft course with priced batch -> should NOT return at all
        $course3 = Course::create([
            'title' => 'Reasoning Special',
            'slug' => 'reasoning-special',
            'exam_category' => 'SSC',
            'mode' => 'recorded',
            'is_published' => false, // Draft
        ]);
        $batch3 = Batch::create([
            'course_id' => $course3->id,
            'name' => 'Advanced Batch',
            'price_paise' => 199900,
            'is_active' => true,
        ]);

        $response = $this->getJson('/api/courses/public');

        $response->assertOk();
        $response->assertJsonCount(2); // Only course1 and course2 should be returned

        // Check Course 1
        $response->assertJsonFragment([
            'title' => 'Math Special',
            'slug' => 'math-special',
        ]);
        // Check Batch 1 is present
        $response->assertJsonFragment([
            'name' => 'Morning Batch',
            'price_paise' => 99900,
        ]);

        // Check Course 2
        $response->assertJsonFragment([
            'title' => 'English Special',
            'slug' => 'english-special',
        ]);
        // Check Batch 2 is NOT present in its batches list
        $data = $response->json();
        $englishCourse = collect($data)->firstWhere('slug', 'english-special');
        $this->assertEmpty($englishCourse['batches']);
    }
}
