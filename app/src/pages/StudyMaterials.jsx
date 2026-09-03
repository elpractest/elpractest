import React, { useEffect, useMemo, useState } from 'react';
import '../styles/reader.css';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import Icon from '../components/Icon';
import { useTheme } from '../lib/theme';

/**
 * STUDY MATERIAL — the shelf.
 *
 * Every PDF the student's purchases open, across every course, in one
 * list. Grouped by course because that is how they were bought and how
 * a student thinks about them ("the notes from the CGL course"), and
 * filterable by subject because that is how they are used ("everything
 * I have on Polity").
 *
 * A card that has been opened before shows where to resume rather than
 * just a page count — the shelf's job is to get someone back to reading
 * in one tap, not to describe a file.
 */
function readable(bytes) {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function StudyMaterials() {
  const navigate = useNavigate();
  const { tint } = useTheme();
  const { t } = useTranslation();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState(null);

  useEffect(() => {
    api.get('/api/student/study-materials')
      .then((res) => setData(res.data))
      .catch(() => setData({ materials: [], subjects: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    if (!data?.materials) return [];
    const filtered = subject
      ? data.materials.filter((m) => m.subject === subject)
      : data.materials;

    const byCourse = new Map();
    filtered.forEach((m) => {
      const key = m.course?.id ?? 0;
      if (!byCourse.has(key)) byCourse.set(key, { course: m.course, items: [] });
      byCourse.get(key).items.push(m);
    });
    return [...byCourse.values()];
  }, [data, subject]);

  if (loading) {
    return <div className="rd-shelf-loading"><div className="spinner" /></div>;
  }

  if (!data || data.total === 0) {
    return (
      <div className="rd-shelf">
        <h1 className="t-title rd-shelf-title">{t('materials.title')}</h1>
        <div className="glass-panel rd-shelf-empty">
          <span
            className="rd-shelf-empty-glyph"
            style={{ background: tint('blue').bg, color: tint('blue').c }}
          >
            <Icon name="book-open" size={22} />
          </span>
          <div className="t-heading">{t('materials.emptyTitle')}</div>
          <p>{t('materials.emptyBody')}</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/store')}>
            {t('materials.browseStore')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rd-shelf">
      <h1 className="t-title rd-shelf-title">{t('materials.title')}</h1>
      <p className="rd-shelf-sub">{t('materials.subtitle')}</p>

      {data.subjects?.length > 1 && (
        <div className="rd-shelf-filters">
          <button
            type="button"
            className={`chip-filter${subject === null ? ' active' : ''}`}
            onClick={() => setSubject(null)}
          >
            {t('materials.allSubjects')}
          </button>
          {data.subjects.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip-filter${subject === s ? ' active' : ''}`}
              onClick={() => setSubject(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {groups.map(({ course, items }) => (
        <section key={course?.id ?? 'loose'} className="rd-shelf-group">
          <h2 className="t-heading rd-shelf-course">
            {course?.title || t('materials.otherMaterial')}
            <span className="rd-shelf-count">{items.length}</span>
          </h2>

          <div className="rd-shelf-grid">
            {items.map((m) => {
              const p = m.reading_progress || {};
              const started = p.current_page > 1 || p.percent_complete > 0;
              const tc = tint(started ? 'green' : 'blue');

              return (
                <button
                  key={m.id}
                  type="button"
                  className="glass-panel rd-card"
                  onClick={() => navigate(`/reader/${m.id}`)}
                >
                  <span className="rd-card-top">
                    <span className="rd-card-glyph" style={{ background: tc.bg, color: tc.c }}>
                      <Icon name="file-text" size={18} />
                    </span>
                    {m.is_free_preview && <span className="chip rd-card-chip">{t('materials.preview')}</span>}
                  </span>

                  <span className="rd-card-title">{m.title}</span>

                  {m.subject && <span className="rd-card-subject">{m.subject}</span>}

                  <span className="rd-card-meta">
                    {m.page_count ? t('materials.nPages', { n: m.page_count }) : readable(m.file_size)}
                    {m.module?.title && <span className="rd-card-module"> · {m.module.title}</span>}
                  </span>

                  {started ? (
                    <span className="rd-card-resume">
                      <span className="rd-card-bar">
                        <span style={{ width: `${Math.max(2, p.percent_complete)}%` }} />
                      </span>
                      <span className="rd-card-resume-label">
                        {t('materials.resumeOn', { n: p.current_page })}
                      </span>
                    </span>
                  ) : (
                    <span className="rd-card-start">{t('materials.startReading')}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
