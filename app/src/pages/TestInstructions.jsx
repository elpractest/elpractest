import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import Icon from '../components/Icon';

/**
 * THE GATE — every real, admin-authored test in this app passes through
 * here before the clock starts, on a fresh attempt.
 *
 * `tests.instructions` has been a real, admin-editable column since the
 * schema shipped — the admin edit form has always had a working textarea
 * for it — but nothing between the database and a student ever read it
 * back: `start()` and `resume()` hand the candidate straight into the live
 * paper. A negative-marking warning or a sectional-cutoff note that was
 * written and saved was never actually seen by anyone it was written for.
 * This page is the other half of that field.
 *
 * It calls the read-only `/preview` endpoint, never `/start`, until the
 * candidate has actually pressed the button — previewing must never create
 * an attempt. If a session for this test is ALREADY in progress (a refresh,
 * a closed tab), the gate has already been cleared once this attempt, so
 * this redirects straight to it rather than making the candidate read the
 * same instructions again mid-paper.
 *
 * Deliberately NOT in the way of the self-built practice console: a
 * student who just configured their own paper on the previous screen is
 * not surprised by anything a generic instructions screen could tell them.
 */
export default function TestInstructions() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setAcknowledged(false);

    api.get(`/api/student/tests/${testId}/preview`)
      .then((res) => {
        if (cancelled) return;

        // A session is already running — the gate already happened once
        // this attempt. Replace, not push: the candidate should not land
        // back on this screen by pressing the browser's back button
        // mid-exam.
        if (res.data.resumable_session_id) {
          navigate(`/tests/${res.data.resumable_session_id}`, { replace: true });
          return;
        }

        setData(res.data.test);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.response?.status === 403
            ? t('preview.errLocked')
            : t('preview.errGeneric'),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [testId, navigate, t]);

  const handleStart = async () => {
    setStarting(true);
    setStartError('');
    try {
      const res = await api.post(`/api/student/tests/${testId}/start`);
      navigate(`/tests/${res.data.session.id}`, { replace: true });
    } catch (err) {
      setStartError(err.response?.data?.message || t('preview.errGeneric'));
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '32px 24px', maxWidth: '640px', margin: '0 auto' }}>
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <span style={{ display: 'inline-flex', padding: '15px', borderRadius: '18px', background: 'var(--accent-soft)', color: 'var(--accent-color)', border: '1px solid var(--accent-border)' }}>
              <Icon name="lock" size={30} />
            </span>
          </div>
          <h2 style={{ margin: '0 0 12px 0' }}>{t('preview.title')}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error}</p>
          <Link to="/dashboard" className="btn-primary" style={{ textDecoration: 'none' }}>
            {t('preview.back')}
          </Link>
        </div>
      </div>
    );
  }

  const minutes = data.duration_seconds ? Math.round(data.duration_seconds / 60) : null;
  const attemptsLine = data.max_attempts
    ? t('preview.attemptsUsed', { used: data.attempts_used, max: data.max_attempts })
    : t('preview.attemptsUnlimited');

  return (
    <div style={{ padding: '20px 20px 100px', maxWidth: '720px', margin: '0 auto', width: '100%' }}>
      <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', background: 'var(--accent-soft)', color: 'var(--accent-color)', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {data.category || data.type || 'mock'}
            </span>
            {data.is_free && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)', borderRadius: '6px' }}>
                {t('preview.freeChip')}
              </span>
            )}
          </div>
          <h1 style={{ margin: '10px 0 0', fontSize: '1.5rem', fontWeight: 700 }}>{data.title}</h1>
        </div>

        {/* Key facts — the four things a candidate actually needs before
            they commit their clock to this: how long, how many, how much,
            how many tries they get. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
          <Stat label={t('preview.duration')} value={minutes ? t('preview.minutes', { n: minutes }) : '—'} icon="clock" />
          <Stat label={t('preview.questions')} value={data.question_count} icon="file-text" />
          <Stat label={t('preview.totalMarks')} value={data.total_marks} icon="award" />
          <Stat label={t('preview.attempts')} value={attemptsLine} icon="refresh" />
        </div>

        {/* Marking scheme — the single fact most likely to change how a
            candidate answers (skip vs. guess), stated once in words rather
            than left for them to infer per-question mid-paper. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '13px 15px',
            borderRadius: '14px',
            background: data.has_negative_marking ? 'var(--warning-bg)' : 'var(--success-bg)',
            border: `1px solid ${data.has_negative_marking ? 'var(--warning-border)' : 'var(--success-border)'}`,
            color: data.has_negative_marking ? 'var(--warning-text)' : 'var(--success-text)',
          }}
        >
          <Icon name={data.has_negative_marking ? 'alert' : 'check-circle'} size={18} style={{ flex: 'none', marginTop: '1px' }} />
          <span style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
            {data.has_negative_marking
              ? (data.negative_marking_uniform
                  ? t('preview.negativeYes')
                  : t('preview.negativeYesVaries'))
              : t('preview.negativeNo')}
          </span>
        </div>

        {/* Section structure — only shown when it is actually informative:
            a single-section paper telling you it has one section is noise. */}
        {data.sections?.length > 1 && (
          <div>
            <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('preview.sections')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.sections.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '12px', background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    {s.title}
                    {s.is_qualifying && (
                      <span style={{ marginLeft: '8px', fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: 'var(--accent-soft)', color: 'var(--accent-color)' }}>
                        {t('preview.qualifying')}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {t('preview.sectionRow', { n: s.question_count, minutes: s.duration_seconds ? Math.round(s.duration_seconds / 60) : minutes })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions — the field this whole page exists to surface. */}
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('preview.instructionsHeading')}
          </h3>
          <div
            style={{
              padding: '15px 16px',
              borderRadius: '14px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-color)',
              fontSize: '0.9rem',
              lineHeight: 1.65,
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              maxHeight: '320px',
              overflowY: 'auto',
            }}
          >
            {data.instructions?.trim() || t('preview.noInstructions')}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '4px 2px' }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            style={{ width: '20px', height: '20px', flex: 'none', marginTop: '1px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {t('preview.acknowledge')}
          </span>
        </label>

        {startError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', borderRadius: '13px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: '0.85rem' }}>
            <Icon name="alert" size={15} />
            {startError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary" style={{ padding: '13px 20px' }} disabled={starting}>
            {t('preview.back')}
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="btn-primary"
            style={{ flex: 1, padding: '13px 20px', minWidth: '160px' }}
            disabled={!acknowledged || starting}
          >
            {starting ? t('preview.starting') : t('preview.start')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'var(--surface-1)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
        <Icon name={icon} size={14} />
        <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</span>
      </span>
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
