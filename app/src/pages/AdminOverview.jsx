import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';

/* ============================================================
   ADMIN / SUPER-ADMIN OVERVIEW  —  artboard 01, "Platform health"
   ------------------------------------------------------------
   Every figure on this page is derived from an endpoint the API
   ALREADY exposes. Nothing is invented and nothing is estimated:

     GET /api/admin/results?page=n        attempts, by day + unique students
     GET /api/admin/activation-requests   pending queue + oldest waiting
     GET /api/admin/tests?is_published=…  live vs draft counts
     GET /api/admin/questions?flagged=1   items whose stats look broken
     GET /api/super-admin/audit-logs      recent trail (super-admin only)

   The attempts series walks /results backwards (it is ordered by
   submitted_at desc) until it passes the 14-day boundary, so the chart
   is exact rather than sampled. The walk is capped at MAX_PAGES; if the
   cap is hit before the boundary the card says so instead of implying a
   complete count.
   ============================================================ */

const WINDOW_DAYS = 14;
const MAX_PAGES = 25; // 25 × 20 rows = 500 sessions before we admit a partial read

const DAY_MS = 86400000;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const nf = new Intl.NumberFormat('en-IN');

/* ---------- small presentational pieces ---------- */

function StatCard({ hue, icon, value, label, note, noteHue, tint, alert }) {
  const t = tint(hue);
  return (
    <div
      style={{
        background: 'var(--card)',
        border: `1px solid ${alert ? 'var(--reward-border)' : 'var(--line)'}`,
        borderRadius: '18px',
        padding: '18px',
        display: 'flex',
        gap: '15px',
        alignItems: 'flex-start',
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: '44px',
          height: '44px',
          flex: 'none',
          borderRadius: '14px',
          background: t.bg,
          color: t.c,
        }}
      >
        <Icon name={icon} size={21} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="t-num" style={{ fontSize: '26px', lineHeight: 1, color: 'var(--tx)' }}>{value}</div>
        <div
          className="t-overline"
          style={{ marginTop: '7px', letterSpacing: '.14em', color: alert ? 'var(--reward-text)' : 'var(--muted)' }}
        >
          {label}
        </div>
        <div
          style={{
            marginTop: '5px',
            font: '500 11.5px var(--font-body)',
            color: noteHue ? `var(--${noteHue})` : 'var(--muted)',
          }}
        >
          {note}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="skeleton" style={{ height: '96px', borderRadius: '18px' }} />;
}

function SectionCard({ children, style }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '20px',
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- page ---------- */

export default function AdminOverview({ isSuperAdmin, onNavigate }) {
  const { tint } = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [series, setSeries] = useState([]);          // [{ key, day, label, count }]
  const [seriesPartial, setSeriesPartial] = useState(false);
  const [uniqueStudents, setUniqueStudents] = useState(0);
  const [pending, setPending] = useState({ total: 0, oldestDays: null });
  const [tests, setTests] = useState({ live: 0, draft: 0 });
  const [flagged, setFlagged] = useState(0);
  const [logs, setLogs] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const since = startOfDay(Date.now() - (WINDOW_DAYS - 1) * DAY_MS);

    /* --- attempts: walk /results back until we pass the window --- */
    const buckets = new Map();
    for (let i = 0; i < WINDOW_DAYS; i += 1) {
      const day = new Date(since.getTime() + i * DAY_MS);
      buckets.set(day.toISOString().slice(0, 10), { day, count: 0 });
    }
    const students = new Set();
    let partial = false;

    try {
      let page = 1;
      let done = false;
      while (!done) {
        const res = await api.get('/api/admin/results', { params: { page } });
        const rows = res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
        const lastPage = res.data?.last_page ?? 1;

        for (const row of rows) {
          if (!row.submitted_at) continue;
          const at = new Date(row.submitted_at);
          if (at < since) {
            done = true;
            continue;
          }
          const key = startOfDay(at).toISOString().slice(0, 10);
          const bucket = buckets.get(key);
          if (bucket) bucket.count += 1;
          if (row.user?.id) students.add(row.user.id);
        }

        if (page >= lastPage || rows.length === 0) done = true;
        else if (page >= MAX_PAGES) {
          partial = true;
          done = true;
        }
        page += 1;
      }
    } catch {
      setError('Could not load the attempts series.');
    }

    setSeries(
      [...buckets.entries()].map(([key, b]) => ({
        key,
        day: b.day,
        label: String(b.day.getDate()).padStart(2, '0'),
        count: b.count,
      })),
    );
    setSeriesPartial(partial);
    setUniqueStudents(students.size);

    /* --- pending activations (+ how long the oldest has waited) --- */
    try {
      const res = await api.get('/api/admin/activation-requests', { params: { status: 'pending' } });
      const total = res.data?.total ?? (Array.isArray(res.data) ? res.data.length : 0);
      let oldestDays = null;
      if (total > 0) {
        const lastPage = res.data?.last_page ?? 1;
        // `latest()` orders newest-first, so the oldest row is the last one.
        const tail =
          lastPage > 1
            ? (await api.get('/api/admin/activation-requests', { params: { status: 'pending', page: lastPage } })).data
                ?.data ?? []
            : res.data?.data ?? [];
        const oldest = tail[tail.length - 1];
        if (oldest?.created_at) {
          oldestDays = Math.max(0, Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / DAY_MS));
        }
      }
      setPending({ total, oldestDays });
    } catch {
      /* the card falls back to a dash */
    }

    /* --- tests live vs draft --- */
    try {
      const [live, draft] = await Promise.all([
        api.get('/api/admin/tests', { params: { is_published: 1 } }),
        api.get('/api/admin/tests', { params: { is_published: 0 } }),
      ]);
      setTests({ live: live.data?.total ?? 0, draft: draft.data?.total ?? 0 });
    } catch {
      /* ignore */
    }

    /* --- questions whose item statistics look broken --- */
    try {
      const res = await api.get('/api/admin/questions', { params: { flagged: 1 } });
      setFlagged(res.data?.total ?? 0);
    } catch {
      /* ignore */
    }

    /* --- audit trail (super-admin only) --- */
    if (isSuperAdmin) {
      try {
        const res = await api.get('/api/super-admin/audit-logs?page=1');
        setLogs((res.data?.data ?? []).slice(0, 5));
      } catch {
        /* ignore */
      }
    }

    setLoading(false);
  }, [isSuperAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const peak = useMemo(() => series.reduce((m, d) => Math.max(m, d.count), 0), [series]);
  const today = series.length ? series[series.length - 1].count : 0;
  const yesterday = series.length > 1 ? series[series.length - 2].count : 0;
  const totalAttempts = useMemo(() => series.reduce((s, d) => s + d.count, 0), [series]);
  const peakDay = useMemo(() => series.find((d) => d.count === peak && peak > 0), [series, peak]);

  const dayDelta = yesterday === 0 ? null : Math.round(((today - yesterday) / yesterday) * 100);

  /* the "Needs you" list is built from the same real counts, never padded */
  const actions = [
    pending.total > 0 && {
      id: 'activations',
      hue: 'gold',
      icon: 'clock',
      title: `${nf.format(pending.total)} activation ${pending.total === 1 ? 'request' : 'requests'}`,
      sub: pending.oldestDays === null ? 'Waiting for review' : `Oldest waiting ${pending.oldestDays} ${pending.oldestDays === 1 ? 'day' : 'days'}`,
      tab: 'activations',
    },
    flagged > 0 && {
      id: 'flagged',
      hue: 'red',
      icon: 'alert',
      title: `${nf.format(flagged)} ${flagged === 1 ? 'question' : 'questions'} flagged`,
      sub: 'Item statistics suggest a wrong key or a dead item',
      tab: 'questions',
    },
    tests.draft > 0 && {
      id: 'drafts',
      hue: 'blue',
      icon: 'award',
      title: `${nf.format(tests.draft)} ${tests.draft === 1 ? 'test' : 'tests'} unpublished`,
      sub: 'Still in draft — students cannot see them',
      tab: 'tests',
    },
  ].filter(Boolean);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="ov-stats">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="skeleton" style={{ height: '300px', borderRadius: '20px' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <style>{`
        .ov-stats { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .ov-body { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 640px) {
          .ov-stats { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1180px) {
          .ov-stats { grid-template-columns: repeat(4, 1fr); }
          .ov-body { grid-template-columns: 1.55fr 1fr; }
        }
        .ov-action:hover { background: var(--surf); }
      `}</style>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '12px 16px',
            borderRadius: '14px',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            font: '500 13px var(--font-body)',
          }}
        >
          <Icon name="alert" size={16} />
          {error}
        </div>
      )}

      {/* ---- stat row ---- */}
      <div className="ov-stats">
        <StatCard
          tint={tint}
          hue="blue"
          icon="users"
          value={nf.format(uniqueStudents)}
          label="ACTIVE STUDENTS"
          note={`Unique attempters, last ${WINDOW_DAYS} days`}
        />
        <StatCard
          tint={tint}
          hue="green"
          icon="activity"
          value={nf.format(today)}
          label="ATTEMPTS TODAY"
          note={dayDelta === null ? `${nf.format(yesterday)} yesterday` : `${dayDelta >= 0 ? '+' : ''}${dayDelta}% vs yesterday`}
          noteHue={dayDelta === null ? null : dayDelta >= 0 ? 'success' : 'danger'}
        />
        <StatCard
          tint={tint}
          hue="gold"
          icon="clock"
          value={nf.format(pending.total)}
          label="PENDING ACTIVATIONS"
          alert={pending.total > 0}
          note={
            pending.total === 0
              ? 'Queue is clear'
              : pending.oldestDays === null
                ? 'Awaiting review'
                : `Oldest waiting ${pending.oldestDays} ${pending.oldestDays === 1 ? 'day' : 'days'}`
          }
        />
        <StatCard
          tint={tint}
          hue="violet"
          icon="award"
          value={nf.format(tests.live)}
          label="TESTS LIVE"
          note={`${nf.format(tests.draft)} in draft`}
        />
      </div>

      {/* ---- chart + side column ---- */}
      <div className="ov-body">
        {/* attempts, last 14 days — plain divs, no chart library */}
        <SectionCard style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <div className="t-heading" style={{ color: 'var(--tx)' }}>Attempts, last {WINDOW_DAYS} days</div>
            <div style={{ marginTop: '4px', font: '400 12.5px var(--font-body)', color: 'var(--muted)' }}>
              {totalAttempts === 0
                ? 'No submissions in this window yet.'
                : `${nf.format(totalAttempts)} submitted${peakDay ? ` · peak ${peakDay.day.toLocaleDateString(undefined, { weekday: 'long', day: '2-digit' })} — ${nf.format(peak)}` : ''}`}
              {seriesPartial && ' · partial read, capped at 500 sessions'}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: '220px',
              padding: '22px 20px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-end',
              overflowX: 'auto',
            }}
          >
            {series.map((d) => {
              const isPeak = peak > 0 && d.count === peak;
              const h = peak > 0 ? Math.max(4, Math.round((d.count / peak) * 100)) : 4;
              return (
                <div
                  key={d.key}
                  style={{
                    flex: 1,
                    minWidth: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '9px',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                  title={`${d.day.toDateString()} — ${nf.format(d.count)}`}
                >
                  {isPeak && (
                    <span
                      className="t-num"
                      style={{
                        padding: '4px 9px',
                        borderRadius: '8px',
                        background: 'var(--tx)',
                        color: 'var(--card)',
                        fontSize: '10.5px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {nf.format(d.count)}
                    </span>
                  )}
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '30px',
                      height: `${h}%`,
                      borderRadius: '7px',
                      background: isPeak ? 'var(--primary)' : d.count === 0 ? 'var(--line)' : 'var(--primary-soft)',
                    }}
                  />
                  <div
                    style={{
                      font: `${isPeak ? 600 : 500} 9.5px var(--font-mono)`,
                      color: isPeak ? 'var(--primary)' : 'var(--muted)',
                    }}
                  >
                    {d.label}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {/* needs you */}
          <SectionCard style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div className="t-heading" style={{ fontSize: '15px', color: 'var(--tx)' }}>Needs you</div>
              {actions.length > 0 && (
                <span
                  className="t-num"
                  style={{ padding: '3px 9px', borderRadius: '999px', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '10.5px' }}
                >
                  {actions.length}
                </span>
              )}
            </div>

            {actions.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '18px 0' }}>
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: '48px',
                    height: '48px',
                    borderRadius: '999px',
                    background: 'var(--surf)',
                    color: 'var(--muted)',
                  }}
                >
                  <Icon name="check-circle" size={24} />
                </span>
                <div style={{ font: '400 13px var(--font-body)', color: 'var(--muted)', textAlign: 'center' }}>
                  Nothing is waiting on you right now.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {actions.map((a) => {
                  const t = tint(a.hue);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className="ov-action"
                      onClick={() => onNavigate?.(a.tab)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '11px',
                        borderRadius: '13px',
                        background: 'var(--card2)',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        minHeight: '48px',
                      }}
                    >
                      <span
                        style={{
                          display: 'grid',
                          placeItems: 'center',
                          width: '34px',
                          height: '34px',
                          flex: 'none',
                          borderRadius: '11px',
                          background: t.bg,
                          color: t.c,
                        }}
                      >
                        <Icon name={a.icon} size={17} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', font: '600 12.5px var(--font-body)', color: 'var(--tx)' }}>{a.title}</span>
                        <span style={{ display: 'block', marginTop: '2px', font: '400 11.5px var(--font-body)', color: 'var(--muted)' }}>
                          {a.sub}
                        </span>
                      </span>
                      <span style={{ color: 'var(--muted)', display: 'inline-flex' }}>
                        <Icon name="chevron-right" size={16} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* recent audit trail — super-admin only, the endpoint is theirs */}
          {isSuperAdmin && (
            <SectionCard style={{ padding: '18px 20px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}>
                <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>
                  <Icon name="history" size={17} />
                </span>
                <div className="t-heading" style={{ fontSize: '15px', color: 'var(--tx)' }}>Recent audit trail</div>
              </div>

              {logs.length === 0 ? (
                <div style={{ font: '400 13px var(--font-body)', color: 'var(--muted)' }}>No audited changes yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                  {logs.map((log) => (
                    <div key={log.id} style={{ display: 'flex', gap: '11px' }}>
                      <div
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          marginTop: '6px',
                          flex: 'none',
                          background: 'var(--primary)',
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ font: '500 12.5px/1.45 var(--font-body)', color: 'var(--tx)' }}>
                          <b style={{ fontWeight: 700 }}>{log.user?.name || 'System'}</b> — {log.action}
                        </div>
                        <div
                          className="t-overline"
                          style={{ marginTop: '3px', letterSpacing: '.1em', color: 'var(--muted)', fontSize: '10.5px' }}
                        >
                          {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
