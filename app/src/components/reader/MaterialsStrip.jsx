import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import Icon from '../Icon';
import { useTheme } from '../../lib/theme';

/**
 * The booklets attached to one course, shown inside its outline.
 *
 * Study material belongs beside the syllabus, not only on a separate
 * shelf: a student who has just watched a lesson on ratios and wants the
 * formula sheet is looking at the outline, and sending them to a global
 * list to find it is a detour through everything they own.
 *
 * Renders NOTHING when the course has no material — an empty panel
 * headed "Study material" on every course that has none is furniture,
 * not information.
 *
 * Styled inline like the outline it sits in, rather than from the
 * reader's stylesheet: this component is reached from a page that is in
 * the main bundle, and importing reader.css here would drag the whole
 * reader's CSS into every page load to style four rows.
 */
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
  padding: '13px 18px',
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
};

export default function MaterialsStrip({ courseId }) {
  const navigate = useNavigate();
  const { tint } = useTheme();
  const { t } = useTranslation();
  const [materials, setMaterials] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/student/courses/${courseId}/study-materials`)
      .then((res) => { if (!cancelled) setMaterials(res.data.materials || []); })
      // A course whose materials cannot be fetched still has a working
      // outline; this section simply does not appear.
      .catch(() => { if (!cancelled) setMaterials([]); });
    return () => { cancelled = true; };
  }, [courseId]);

  if (!materials?.length) return null;

  return (
    <section>
      <h2 style={{ margin: '0 0 12px', fontSize: '1.3rem', fontWeight: 700 }}>
        {t('materials.inCourse')}{' '}
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--muted)' }}>
          {t('materials.inCourseSub', { count: materials.length })}
        </span>
      </h2>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {materials.map((m, i) => {
          const p = m.reading_progress || {};
          const started = p.current_page > 1 || p.percent_complete > 0;
          const tc = tint(started ? 'green' : 'violet');

          return (
            <button
              key={m.id}
              type="button"
              style={{
                ...rowStyle,
                borderBottom: i === materials.length - 1 ? 'none' : '1px solid var(--surface-2)',
              }}
              onClick={() => navigate(`/reader/${m.id}`)}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ width: '34px', height: '34px', borderRadius: '10px', flex: 'none', display: 'grid', placeItems: 'center', background: tc.bg, color: tc.c }}>
                <Icon name="file-text" size={16} />
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ font: '600 13.5px var(--font-body)', color: 'var(--tx)' }}>{m.title}</span>
                <span style={{ font: '500 11.5px var(--font-body)', color: 'var(--muted)' }}>
                  {[m.subject, m.page_count ? t('materials.nPages', { n: m.page_count }) : null]
                    .filter(Boolean).join(' · ')}
                </span>
              </span>
              <span style={{ flex: 'none', font: '600 12px var(--font-body)', color: 'var(--primary)' }}>
                {started ? t('materials.resume', { n: p.current_page }) : t('materials.read')}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
