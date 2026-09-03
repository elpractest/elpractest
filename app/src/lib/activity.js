/* ============================================================
   Student activity — derived from data the student already has.
   ------------------------------------------------------------
   GET /api/student/results returns the full submitted-session history
   (session_id, submitted_at, score, accuracy…). Two surfaces need to
   read it at once — the header's streak pill and Home's "This week"
   card — so the request is made once per session and shared, rather
   than fired from each component.

   Nothing here invents an endpoint or a figure. The streak is the run
   of consecutive calendar days with at least one submission, ending
   today or yesterday (a streak is not broken until a whole day passes);
   the week series is a straight per-day count over the last 7 days.
   ============================================================ */
import { useEffect, useState } from 'react';
import api from '../api';

const DAY_MS = 86400000;

function dayKey(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Consecutive days with a submission, counting back from today/yesterday. */
function computeStreak(dayKeys) {
  if (dayKeys.size === 0) return 0;
  const today = dayKey(Date.now());
  let cursor = dayKeys.has(today) ? today : today - DAY_MS;
  if (!dayKeys.has(cursor)) return 0;
  let streak = 0;
  while (dayKeys.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

/** Per-day counts for the last 7 days, oldest first. */
function computeWeek(results) {
  const today = dayKey(Date.now());
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const key = today - i * DAY_MS;
    days.push({ key, date: new Date(key), count: 0 });
  }
  const index = new Map(days.map((d) => [d.key, d]));
  for (const r of results) {
    if (!r.submitted_at) continue;
    const bucket = index.get(dayKey(r.submitted_at));
    if (bucket) bucket.count += 1;
  }
  return days;
}

const EMPTY = { loading: true, results: [], streak: 0, week: [], weekTests: 0, error: false };

let cache = null;      // resolved snapshot
let inflight = null;   // shared promise
const listeners = new Set();

function emit(next) {
  cache = next;
  listeners.forEach((l) => l(next));
}

function load() {
  if (inflight) return inflight;
  inflight = api
    .get('/api/student/results')
    .then((res) => {
      const results = res.data?.results ?? (Array.isArray(res.data) ? res.data : []);
      const keys = new Set(results.filter((r) => r.submitted_at).map((r) => dayKey(r.submitted_at)));
      const week = computeWeek(results);
      emit({
        loading: false,
        results,
        streak: computeStreak(keys),
        week,
        weekTests: week.reduce((s, d) => s + d.count, 0),
        error: false,
      });
    })
    .catch(() => {
      // Still hand the week its seven days: a card that renders an honest
      // run of zeroes reads better than one that collapses to nothing.
      emit({ ...EMPTY, loading: false, error: true, week: computeWeek([]) });
    });
  return inflight;
}

/** Drop the cache so the next mount refetches (used after a submit). */
export function refreshActivity() {
  cache = null;
  inflight = null;
}

export function useActivity() {
  const [state, setState] = useState(cache || EMPTY);

  useEffect(() => {
    listeners.add(setState);
    if (cache) setState(cache);
    else load();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
