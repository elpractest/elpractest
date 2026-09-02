<?php

namespace App\Notifications;

/**
 * Fired by `tests:remind-upcoming` shortly before a scheduled mock opens.
 *
 * The whole point of a scheduled mock is that everyone sits it together, which
 * only works if people remember it is happening. This is the one notification
 * that is genuinely time-critical — a candidate who reads it an hour late has
 * missed the thing entirely.
 */
class TestStartingSoon extends FcmNotification
{
    public function __construct(
        private int $testId,
        private string $testTitle,
        private int $minutesUntilStart,
    ) {
    }

    private function whenPhrase(): string
    {
        if ($this->minutesUntilStart <= 1) {
            return 'now';
        }
        if ($this->minutesUntilStart < 60) {
            return "in {$this->minutesUntilStart} minutes";
        }

        $hours = (int) round($this->minutesUntilStart / 60);

        return $hours === 1 ? 'in an hour' : "in {$hours} hours";
    }

    protected function payload(): array
    {
        return [
            'type' => 'test_reminder',
            'title' => 'Mock starts ' . $this->whenPhrase(),
            'body' => "{$this->testTitle} opens " . $this->whenPhrase() . '. Be ready.',
            'hue' => 'gold',
            'icon' => 'clock',
            'route' => '/student/test-series',
        ];
    }

    /**
     * Worth a WhatsApp: this is time-critical in a way nothing else here is.
     * A push that goes unread until the evening is worthless; the reminder has
     * to land somewhere the candidate actually looks within the hour.
     */
    public function toWhatsApp(object $notifiable): array
    {
        return [
            'template' => config('services.msg91.whatsapp.templates.test_reminder'),
            'variables' => [$this->testTitle, (string) $this->minutesUntilStart],
        ];
    }
}
