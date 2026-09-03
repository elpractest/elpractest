/* ============================================================
   PENDING LESSON PROGRESS — a small localStorage-backed retry queue.
   ------------------------------------------------------------
   The player reports watched_seconds every 15s, on pause, and on the
   way out. Every one of those is "best effort": the request can lose
   the race against a tab being force-closed, a phone locking mid-
   upload on a spotty connection, or a plain network blip — and when
   it does, that write was gone for good. On a slow connection this
   is not a rare edge case, it is a normal Tuesday.

   This does not make delivery guaranteed — nothing short of a
   service worker background-sync queue does that, and this app has
   none. What it buys is SURVIVING THE NEXT VISIT: a save that failed
   is remembered on the device, and is retried the next time the
   student opens any lesson, including the same one. Given how a
   student actually behaves (opens a lesson, watches some, comes back
   later), that covers the overwhelming majority of real drops.

   Keyed by lesson id, value is the highest watched_seconds this
   device has tried and failed to save — never the running total,
   because the server side already does `max(stored, incoming)`, so
   only the high-water mark is ever worth resending.
   ============================================================ */

const KEY = 'practest-lesson-progress-pending';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private mode, or storage full — the write simply is not retried later */
  }
}

export function markPending(lessonId, seconds) {
  const all = readAll();
  const existing = all[lessonId] || 0;
  if (seconds > existing) {
    all[lessonId] = seconds;
    writeAll(all);
  }
}

export function clearPending(lessonId) {
  const all = readAll();
  if (lessonId in all) {
    delete all[lessonId];
    writeAll(all);
  }
}

/** Every lesson with an unsent watch position, as [lessonId, seconds] pairs. */
export function listPending() {
  return Object.entries(readAll());
}
