<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * FCM v1.1 — the in-app notifications feed (Laravel `database` channel).
 *
 * Every v1.1 notification writes a row via toDatabase() whose `data` json holds
 * { type, title, body, hue, icon, route }. This controller presents that in the
 * exact shape app/src/pages/Notifications.jsx already renders, so the client's
 * derived feed (lib/notifications.js) can be swapped for a server-authoritative
 * one with read-state tracked in the DB. See docs/FCM_V1.1_SCOPE.md.
 */
class NotificationController extends Controller
{
    /** Latest notifications for the caller + the unread count. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $notifications = $user->notifications()
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn (DatabaseNotification $n) => $this->present($n))
            ->all();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    /** Unread count only — cheap poll for the header bell badge. */
    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    /** Mark a single notification read. */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->find($id);

        if (! $notification) {
            return response()->json(['message' => 'Notification not found.'], 404);
        }

        $notification->markAsRead();

        return response()->json(['message' => 'Marked read.']);
    }

    /** Mark all of the caller's notifications read. */
    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['message' => 'All marked read.']);
    }

    /**
     * Map a stored notification to the frontend feed item shape
     * ({ id, type, title, body, time, hue, icon, link, read }). `time` is an
     * epoch-ms integer, matching lib/notifications.js's relative() helper.
     */
    private function present(DatabaseNotification $n): array
    {
        $data = $n->data;

        return [
            'id' => $n->id,
            'type' => $data['type'] ?? null,
            'title' => $data['title'] ?? '',
            'body' => $data['body'] ?? '',
            'time' => $n->created_at?->getTimestampMs(),
            'hue' => $data['hue'] ?? 'neutral',
            'icon' => $data['icon'] ?? 'bell',
            'link' => $data['route'] ?? null,
            'read' => $n->read_at !== null,
        ];
    }
}
