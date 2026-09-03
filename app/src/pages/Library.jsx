import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';

/**
 * MY LIBRARY — everything the student holds, however they came by it.
 *
 * One shelf for both kinds of access, because a student does not think in terms
 * of "enrolments" and "entitlements": a course bought outright, a course opened
 * by an activation code, a series bought on its own and a series that arrived
 * inside a bundle all belong in the same list.
 *
 * Reads /api/student/library, which resolves both rails server-side.
 */
function expiryLabel(iso) {
  if (!iso) return 'Lifetime access';

  const days = Math.ceil((new Date(iso) - Date.now()) / 86400000);
  if (days <= 0) return 'Expired';
  if (days <= 30) return `${days} day${days === 1 ? '' : 's'} left`;

  return `Until ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export default function Library() {
  const navigate = useNavigate();
  const { tint } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/student/library')
      .then((res) => setData(res.data))
      .catch(() => setData({ courses: [], test_series: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}><div className="spinner" /></div>;
  }

  const empty = !data || data.total === 0;

  const Card = ({ item, hue, icon, onOpen, meta }) => {
    const tc = tint(hue);
    const expiringSoon = item.expires_at && expiryLabel(item.expires_at).includes('day');

    return (
      <button
        onClick={onOpen}
        className="glass-panel"
        style={{ textAlign: 'left', cursor: 'pointer', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '38px', height: '38px', borderRadius: '11px', background: tc.bg, color: tc.c, display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Icon name={icon} size={18} />
          </span>
          <span style={{ font: '600 11px var(--font-body)', color: 'var(--muted)' }}>{item.exam_category}</span>
        </div>

        <span style={{ display: 'block', font: '700 14.5px var(--font-body)', color: 'var(--tx)' }}>{item.title}</span>

        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', font: '600 11px var(--font-body)' }}>
          <span style={{ color: 'var(--muted)' }}>{meta}</span>
          <span style={{ color: expiringSoon ? tint('red').c : 'var(--muted)' }}>{expiryLabel(item.expires_at)}</span>
        </span>
      </button>
    );
  };

  return (
    <div style={{ padding: '16px 18px 24px', animation: 'fade-in .35s ease both' }}>
      <h1 className="t-title" style={{ margin: '0 0 4px', color: 'var(--tx)' }}>My library</h1>
      <p style={{ margin: '0 0 18px', font: '500 13px var(--font-body)', color: 'var(--muted)' }}>
        Everything you have access to — bought, bundled or activated.
      </p>

      {empty ? (
        <div className="glass-panel" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
          <span style={{ width: '52px', height: '52px', borderRadius: '15px', background: tint('blue').bg, color: tint('blue').c, display: 'grid', placeItems: 'center' }}>
            <Icon name="book-open" size={22} />
          </span>
          <div style={{ font: '700 16px var(--font-display)', color: 'var(--tx)' }}>Your library is empty</div>
          <p style={{ margin: 0, maxWidth: '44ch', font: '500 13px/1.6 var(--font-body)', color: 'var(--muted)' }}>
            Buy a course or test series, or redeem an activation code from your institute, and it appears here.
          </p>
          <button onClick={() => navigate('/store')} className="btn-primary" style={{ marginTop: '4px', padding: '10px 18px', fontSize: '0.85rem' }}>
            Browse the store
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {/* A shelf holds books as well as courses. The PDFs live on
              their own page because they cut across courses — a student
              looking for "my Polity notes" does not want to remember
              which course they came in. */}
          <button
            onClick={() => navigate('/materials')}
            className="glass-panel"
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ width: '38px', height: '38px', borderRadius: '11px', background: tint('violet').bg, color: tint('violet').c, display: 'grid', placeItems: 'center', flex: 'none' }}>
              <Icon name="file-text" size={18} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: '700 14px var(--font-body)', color: 'var(--tx)' }}>Study material</span>
              <span style={{ display: 'block', font: '500 11.5px var(--font-body)', color: 'var(--muted)' }}>
                Notes, handouts and booklets you can read in the app
              </span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>

          {data.courses.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', font: '700 15px var(--font-display)', color: 'var(--tx)' }}>
                Courses <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{data.courses.length}</span>
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                {data.courses.map((c) => (
                  <Card
                    key={`course-${c.id}`}
                    item={c}
                    hue="blue"
                    icon="book-open"
                    meta="Lessons & notes"
                    onOpen={() => navigate(`/courses/${c.id}/outline`)}
                  />
                ))}
              </div>
            </section>
          )}

          {data.test_series.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', font: '700 15px var(--font-display)', color: 'var(--tx)' }}>
                Test series <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{data.test_series.length}</span>
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                {data.test_series.map((s) => (
                  <Card
                    key={`series-${s.id}`}
                    item={s}
                    hue="gold"
                    icon="target"
                    meta={`${s.test_count} paper${s.test_count === 1 ? '' : 's'}`}
                    onOpen={() => navigate(`/student/test-series/${s.id}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
