import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';

/**
 * READING STATS — on demand, and above the bar rather than over it.
 *
 * These numbers used to be the kind of thing that gets pinned to the
 * screen permanently as a floating strip. Three progress indicators
 * competing for the same corner answer no question; one line in the bar
 * answers "where am I", and this sheet — opened by tapping that line —
 * answers everything else. It sits ABOVE the bar it was launched from,
 * so the control that opened it is still reachable.
 */
export default function ProgressSheet({
  open,
  currentPage,
  totalPages,
  percent,
  minutesLeft,
  sessionSeconds,
  markCount,
  bookmarkCount,
  onClose,
}) {
  const { t } = useTranslation();

  const mm = Math.floor(sessionSeconds / 60);
  const ss = String(sessionSeconds % 60).padStart(2, '0');

  const stats = [
    { icon: 'book-open', label: t('reader.statProgress'), value: `${percent}%`, sub: t('reader.pageOf', { n: currentPage, total: totalPages }) },
    { icon: 'clock', label: t('reader.statLeft'), value: t('reader.nMin', { n: minutesLeft }), sub: t('reader.atYourPace') },
    { icon: 'activity', label: t('reader.statSession'), value: `${mm}:${ss}`, sub: t('reader.thisSitting') },
    { icon: 'edit', label: t('reader.statMarks'), value: String(markCount), sub: t('reader.onThisBooklet') },
    { icon: 'bookmark', label: t('reader.statBookmarks'), value: String(bookmarkCount), sub: t('reader.savedPages') },
  ];

  return (
    <div
      className={`rd-sheet${open ? ' is-open' : ''}`}
      role="dialog"
      aria-label={t('reader.readingStats')}
      aria-hidden={!open}
      inert={!open}
    >
      <header className="rd-sheet-head">
        <h2 className="rd-panel-title">{t('reader.readingStats')}</h2>
        <button type="button" className="rd-icon-btn" onClick={onClose} aria-label={t('reader.close')}>
          <Icon name="x" size={18} />
        </button>
      </header>

      <ul className="rd-stats">
        {stats.map((s) => (
          <li key={s.label} className="rd-stat">
            <span className="rd-stat-label"><Icon name={s.icon} size={14} /> {s.label}</span>
            <span className="t-num rd-stat-value">{s.value}</span>
            <span className="rd-stat-sub">{s.sub}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
