import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';

/**
 * FIND IN BOOK — an overlay, not a drawer.
 *
 * Search is a detour: you type, you jump, you are gone. A drawer that
 * stays open next to the page would spend most of its life covering a
 * quarter of the reading width for a job that lasted four seconds.
 *
 * The index is built once per booklet, on first open, page by page with
 * a visible count — a 300-page scan takes a few seconds to extract and
 * pretending otherwise with a spinner that never moves is worse than
 * saying so.
 */
export default function SearchPanel({
  open,
  query,
  onQuery,
  indexing,
  indexed,
  totalPages,
  results,
  activeIndex,
  onJump,
  onClose,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [live, setLive] = useState(query);

  useEffect(() => {
    if (!open) return;
    setLive(query);
    // preventScroll: focusing a control inside an overlay must never
    // scroll the reader shell to bring it into view.
    inputRef.current?.focus({ preventScroll: true });
  }, [open, query]);

  // Debounced, because every keystroke re-scans the whole extracted text.
  useEffect(() => {
    if (!open) return undefined;
    const id = setTimeout(() => onQuery(live), 220);
    return () => clearTimeout(id);
  }, [live, open, onQuery]);

  if (!open) return null;

  return (
    <div
      className="rd-overlay"
      role="dialog"
      aria-label={t('reader.findInBook')}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rd-find">
        <div className="rd-find-bar">
          <Icon name="search" size={17} />
          <input
            ref={inputRef}
            type="search"
            className="rd-find-input"
            placeholder={t('reader.findPlaceholder')}
            value={live}
            onChange={(e) => setLive(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && results.length) {
                onJump(e.shiftKey
                  ? (activeIndex <= 0 ? results.length - 1 : activeIndex - 1)
                  : (activeIndex >= results.length - 1 ? 0 : activeIndex + 1));
              }
            }}
          />
          <button type="button" className="rd-icon-btn" onClick={onClose} aria-label={t('reader.close')}>
            <Icon name="x" size={17} />
          </button>
        </div>

        {indexing && (
          <div className="rd-find-status">
            <span className="spinner rd-spinner-sm" />
            {t('reader.indexing', { done: indexed, total: totalPages })}
          </div>
        )}

        {!indexing && live.trim().length >= 2 && (
          results.length === 0 ? (
            <div className="rd-find-status">{t('reader.noMatches', { q: live.trim() })}</div>
          ) : (
            <>
              <div className="rd-find-status">
                {t('reader.matchCount', { count: results.length })}
                <span className="rd-find-kbd">{t('reader.enterCycles')}</span>
              </div>
              <ul className="rd-find-list">
                {results.map((r, i) => (
                  <li key={`${r.page}-${r.at}`}>
                    <button
                      type="button"
                      className={`rd-find-hit${i === activeIndex ? ' is-active' : ''}`}
                      onClick={() => onJump(i)}
                    >
                      <span className="rd-find-page">{t('reader.pageN', { n: r.page })}</span>
                      <span className="rd-find-snippet">
                        {r.before}
                        <mark>{r.match}</mark>
                        {r.after}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        )}
      </div>
    </div>
  );
}
