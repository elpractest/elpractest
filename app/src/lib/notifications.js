/* ============================================================
   Notifications feed.
   ------------------------------------------------------------
   Authoritative source is the server feed (GET /student/notifications),
   which carries every event the backend raises — activation approved/
   rejected, result ready, new mock/series, enrolment — plus server-tracked
   read state (unread_count).

   If that endpoint isn't reachable (e.g. the FCM/notifications backend
   hasn't been deployed yet → 404), we fall back to the OLD client-derived
   feed synthesised from data the student already has:
     • submitted results  → "Result ready"  (/api/student/results)
     • activation requests → approved / rejected (/api/student/activation-requests)
   The two never run together, so there are no duplicates: server feed when
   available, derived feed only as a fallback.
   ============================================================ */
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';

const SEEN_KEY = 'practest-notif-seen';

function ts(v) {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d.getTime() : 0;
}

/* ---- Authoritative: server feed ---- */
async function fetchServerFeed() {
  const { data } = await api.get('/api/student/notifications');
  return {
    items: Array.isArray(data?.notifications) ? data.notifications : [],
    unread: Number(data?.unread_count) || 0,
  };
}

/* ---- Fallback: client-derived feed (only when the server feed 404s) ---- */
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

async function fetchDerivedFeed() {
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
  const modeRef = useRef('server'); // 'server' | 'derived'

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const feed = await fetchServerFeed();
        if (!alive) return;
        modeRef.current = 'server';
        setItems(feed.items);
        setUnread(feed.unread);
      } catch {
        // Endpoint not deployed yet (404) or failed → derived fallback.
        modeRef.current = 'derived';
        try {
          const list = await fetchDerivedFeed();
          if (!alive) return;
          setItems(list);
          const seen = readSeen();
          setUnread(list.filter((n) => n.time > seen).length);
        } catch {
          if (alive) {
            setItems([]);
            setUnread(0);
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  const markSeen = useCallback(() => {
    setUnread(0);
    if (modeRef.current === 'server') {
      // Server-authoritative: opening the screen marks everything read.
      api.post('/api/student/notifications/read-all').catch(() => {});
    } else {
      markAllSeen();
    }
  }, []);

  return { items, loading, unread, markSeen };
}
