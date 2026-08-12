/* ============================================================
   Derived notifications feed.
   ------------------------------------------------------------
   The app has no notifications backend, so this synthesises a real,
   useful feed from data the student already has:
     • submitted results  → "Result ready"  (/api/student/results)
     • activation requests → approved / rejected updates
                             (/api/student/activation-requests)
   Unread state is tracked locally: the newest item's timestamp is
   compared against the last time the user opened the Notifications
   screen (persisted in localStorage). No new API calls beyond the two
   existing student endpoints.
   ============================================================ */
import { useState, useEffect, useCallback } from 'react';
import api from '../api';

const SEEN_KEY = 'practest-notif-seen';

function ts(v) {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d.getTime() : 0;
}

function deriveResults(results = []) {
  return results.slice(0, 15).map((r) => ({
    id: `result-${r.session_id}`,
    type: 'result',
    title: 'Result ready',
    body: `${r.test_title} — ${r.score}/${r.total_marks}${r.accuracy_percentage != null ? ` · ${r.accuracy_percentage}% accuracy` : ''}`,
    time: ts(r.submitted_at),
    hue: 'green',
    icon: 'check-circle',
    link: `/tests/${r.session_id}/result`,
  }));
}

function deriveActivations(requests = []) {
  return requests
    .filter((req) => req.status === 'approved' || req.status === 'rejected')
    .map((req) => {
      const approved = req.status === 'approved';
      const course = req.batch?.course?.title || 'your course';
      const batch = req.batch?.name ? ` — ${req.batch.name}` : '';
      return {
        id: `activation-${req.id}`,
        type: 'activation',
        title: approved ? 'Activation approved' : 'Activation update',
        body: approved
          ? `${course}${batch} was approved. You can start now.`
          : `${course}${batch}: ${req.admin_notes || 'request was not approved.'}`,
        time: ts(req.updated_at || req.reviewed_at || req.created_at),
        hue: approved ? 'gold' : 'red',
        icon: 'key',
        link: '/dashboard',
      };
    });
}

export async function fetchNotifications() {
  const [resultsRes, activationRes] = await Promise.allSettled([
    api.get('/api/student/results'),
    api.get('/api/student/activation-requests'),
  ]);

  const results = resultsRes.status === 'fulfilled' ? resultsRes.value.data.results || [] : [];
  const requests = activationRes.status === 'fulfilled' ? activationRes.value.data.requests || [] : [];

  return [...deriveResults(results), ...deriveActivations(requests)].sort((a, b) => b.time - a.time);
}

function readSeen() {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}
export function markAllSeen() {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * useNotifications() → { items, loading, unread, markSeen }
 * Shared by the header bell (unread dot) and the Notifications screen.
 */
export function useNotifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchNotifications()
      .then((list) => {
        if (!alive) return;
        setItems(list);
        const seen = readSeen();
        setUnread(list.filter((n) => n.time > seen).length);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const markSeen = useCallback(() => {
    markAllSeen();
    setUnread(0);
  }, []);

  return { items, loading, unread, markSeen };
}
