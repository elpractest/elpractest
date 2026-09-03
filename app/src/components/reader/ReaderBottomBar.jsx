import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import { openStudy, closePanel, setPref, togglePanel } from '../../lib/readerStore';

/**
 * ONE OWNER FOR THE THUMB ZONE.
 *
 * The bottom of a phone screen is the only part of it a thumb reaches
 * without regripping, so it gets exactly one resident. Contents, marks,
 * Vajini and read-aloud all live here; nothing else floats over it. The
 * progress line above the actions states the two facts a student
 * actually wants — where am I, how much is left — in words rather than
 * as a third redundant percentage, and tapping it opens the full stats.
 *
 * It can be tucked to a pill for students who want the whole screen for
 * the page. The collapsed flag lives in the reader store rather than in
 * this component, because the reading surface has to reclaim the band
 * the bar was reserving.
 */
export default function ReaderBottomBar({
  currentPage,
  totalPages,
  percent,
  minutesLeft,
  activePanel,
  studyTab,
  collapsed,
  isSpeaking,
  onListen,
}) {
  const { t } = useTranslation();

  const studyOpen = activePanel === 'study';
  const marksActive = studyOpen && studyTab === 'notes';
  const vajiniActive = studyOpen && studyTab === 'vajini';

  /* The study entries toggle. Each reports aria-pressed, which promises a
     control that can be pressed AND released — and `openStudy` only ever
     opens. The toggle lives here rather than in the store because "Ask
     Vajini" from a selection is a command that must open the drawer
     whether or not it is already showing that tab; a store-level toggle
     would make it close the panel it was asked to open. */
  const toggleStudy = (tab, isActive) => (isActive ? closePanel() : openStudy(tab));

  if (collapsed) {
    return (
      <button
        type="button"
        className="rd-bar-pill"
        onClick={() => setPref({ barCollapsed: false })}
        aria-label={t('reader.showToolbar', { page: currentPage, total: totalPages })}
      >
        <Icon name="chevron-down" size={16} style={{ transform: 'rotate(180deg)' }} />
        <span className="t-num">{currentPage} / {totalPages}</span>
      </button>
    );
  }

  const actions = [
    {
      key: 'contents',
      label: t('reader.contents'),
      icon: 'menu',
      active: activePanel === 'contents',
      onClick: () => togglePanel('contents'),
    },
    {
      key: 'marks',
      label: t('reader.myMarks'),
      icon: 'edit',
      active: marksActive,
      onClick: () => toggleStudy('notes', marksActive),
    },
    {
      key: 'vajini',
      label: t('vajini.name'),
      icon: 'sparkles',
      active: vajiniActive,
      onClick: () => toggleStudy('vajini', vajiniActive),
    },
    {
      key: 'listen',
      label: isSpeaking ? t('reader.stop') : t('reader.listen'),
      icon: isSpeaking ? 'x' : 'mic',
      active: isSpeaking,
      onClick: onListen,
    },
  ];

  return (
    <nav className="rd-bar" aria-label={t('reader.readerActions')}>
      <div className="rd-bar-progress" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>

      <div className="rd-bar-top">
        <button
          type="button"
          className="rd-bar-stats"
          onClick={() => togglePanel('progress')}
          aria-label={t('reader.statsAria', { page: currentPage, total: totalPages, minutes: minutesLeft })}
        >
          <span aria-hidden="true">
            <strong className="t-num">{currentPage}</strong>
            <span className="rd-bar-of"> / {totalPages}</span>
            <span className="rd-bar-dot">·</span>
            {t('reader.minutesLeft', { n: minutesLeft })}
          </span>
        </button>
        <button
          type="button"
          className="rd-icon-btn rd-bar-collapse"
          onClick={() => setPref({ barCollapsed: true })}
          aria-label={t('reader.hideToolbar')}
        >
          <Icon name="chevron-down" size={16} />
        </button>
      </div>

      <div className="rd-bar-actions">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            aria-pressed={a.active}
            className={`rd-bar-btn${a.active ? ' is-active' : ''}`}
          >
            <Icon name={a.icon} size={20} />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
