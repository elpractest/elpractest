<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContactMessageTest extends TestCase
{
    use RefreshDatabase;

    public function test_contact_form_saves_message_successfully(): void
    {
        $payload = [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'phone' => '1234567890',
            'message' => 'Hello, I have an inquiry about the mock test series.',
        ];

        $response = $this->postJson('/api/contact', $payload);

        $response->assertStatus(201);
        $response->assertJson([
            'message' => 'Your message has been sent. We will get back to you shortly.',
        ]);

        $this->assertDatabaseHas('contact_messages', [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'phone' => '1234567890',
            'message' => 'Hello, I have an inquiry about the mock test series.',
        ]);
    }

    public function test_contact_form_requires_mandatory_fields(): void
    {
        $response = $this->postJson('/api/contact', []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['name', 'email', 'message']);
    }
}
