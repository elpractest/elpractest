<?php

namespace App\Jobs;

use App\Models\Enrollment;
use App\Models\User;
use App\Notifications\NewMockPublished;
use App\Notifications\NewSeriesPublished;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Notification;

/**
 * FCM v1.1 — fan a "new mock / new series" notification out to every active
 * enrollee of the content's course (batch-scoped when the content is batch-
 * bound). Distinct user ids are pulled once (bounded — they're ints) then
 * chunked, so a popular publish never loops thousands of models inline. Each
 * per-user send is itself queued by the notification's ShouldQueue.
 * See docs/FCM_V1.1_SCOPE.md.
 */
class FanOutContentNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private string $kind, // 'test' | 'series'
        private int $contentId,
        private string $contentTitle,
        private int $courseId,
        private ?int $batchId = null,
        private ?int $seriesId = null,
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

        $notification = $this->kind === 'series'
            ? new NewSeriesPublished($this->contentId, $this->contentTitle)
            : new NewMockPublished($this->contentId, $this->contentTitle, $this->seriesId);

        foreach ($userIds->chunk(500) as $chunk) {
            $users = User::whereIn('id', $chunk)->get();
            Notification::send($users, $notification);
        }
    }
}
