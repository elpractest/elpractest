<?php

namespace App\Jobs;

use App\Models\Enrollment;
use App\Models\User;
use App\Notifications\TestStartingSoon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Notification;

/**
 * Fan the "your mock opens shortly" reminder out to every active enrollee of
 * the test's course (batch-scoped when the test is batch-bound).
 *
 * Same shape as FanOutContentNotification: distinct user ids are pulled once
 * and chunked, so a popular mock never loads thousands of models at once, and
 * each per-user send is itself queued by the notification's ShouldQueue.
 */
class FanOutTestReminder implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private int $testId,
        private string $testTitle,
        private int $courseId,
        private ?int $batchId,
        private int $minutesUntilStart,
    ) {
    }

    public function handle(): void
    {
        $userIds = Enrollment::where('course_id', $this->courseId)
            ->where('is_active', true)
            ->when($this->batchId, fn ($q) => $q->where('batch_id', $this->batchId))
            ->distinct()
            ->pluck('user_id');

        if ($userIds->isEmpty()) {
            return;
        }

        $notification = new TestStartingSoon($this->testId, $this->testTitle, $this->minutesUntilStart);

        foreach ($userIds->chunk(500) as $chunk) {
            $users = User::whereIn('id', $chunk)->get();
            Notification::send($users, $notification);
        }
    }
}
