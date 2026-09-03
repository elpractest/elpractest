import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';

/**
 * CONTENTS — the left drawer: the booklet's own index, a page grid, and
 * the student's bookmarks.
 *
 * Three tabs rather than three drawers, because they answer the same
 * question ("take me somewhere in this book") and a student looking for
 * a place does not know in advance which of the three will have it.
 *
 * The Pages tab draws real thumbnails, on demand and only for what is on
 * screen: a 300-page grid rendered eagerly is the same memory problem
 * the reading surface solves by windowing, and it would be paid for a
 * panel that is usually closed.
 */
export default function ContentsPanel({
  open,
  outline,
  numPages,
  currentPage,
  bookmarks,
  pdf,
  onGoTo,
  onToggleBookmark,
  onClose,
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('index');

  // A booklet with no embedded outline — most scanned material — should
  // open on something useful rather than on an empty list.
  useEffect(() => {
    if (open && tab === 'index' && outline.length === 0) setTab('pages');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outline.length]);

  const tabs = [
    { key: 'index', label: t('reader.index'), icon: 'menu' },
    { key: 'pages', label: t('reader.pages'), icon: 'grid' },
    { key: 'marks', label: t('reader.bookmarks'), icon: 'bookmark' },
  ];

  return (
    <aside
      className={`rd-panel rd-panel-left${open ? ' is-open' : ''}`}
      aria-label={t('reader.contents')}
      aria-hidden={!open}
      inert={!open}
    >
      <header className="rd-panel-head">
        <h2 className="rd-panel-title">
          <Icon name="menu" size={18} /> {t('reader.contents')}
        </h2>
        <button type="button" className="rd-icon-btn" onClick={onClose} aria-label={t('reader.close')}>
          <Icon name="x" size={18} />
        </button>
      </header>

      <div className="rd-tabs" role="tablist">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            aria-selected={tab === tb.key}
            className={`rd-tab${tab === tb.key ? ' is-active' : ''}`}
            onClick={() => setTab(tb.key)}
          >
            <Icon name={tb.icon} size={15} />
            <span>{tb.label}</span>
          </button>
        ))}
      </div>

      <div className="rd-panel-body">
        {tab === 'index' && (
          outline.length === 0 ? (
            <Empty
              icon="menu"
              title={t('reader.noIndexTitle')}
              body={t('reader.noIndexBody')}
            />
          ) : (
            <ul className="rd-list">
              {outline.map((item, i) => (
                <li key={`${item.title}-${i}`}>
                  <button
                    type="button"
                    className={`rd-list-btn${item.page === currentPage ? ' is-active' : ''}`}
                    style={{ paddingLeft: 12 + item.depth * 14 }}
                    disabled={!item.page}
                    onClick={() => item.page && onGoTo(item.page)}
                  >
                    <span className="rd-list-label">{item.title}</span>
                    {item.page && <span className="rd-list-num">{item.page}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'pages' && (
          <ThumbnailGrid
            pdf={pdf}
            numPages={numPages}
            currentPage={currentPage}
            onGoTo={onGoTo}
          />
        )}

        {tab === 'marks' && (
          bookmarks.length === 0 ? (
            <Empty
              icon="bookmark"
              title={t('reader.noBookmarksTitle')}
              body={t('reader.noBookmarksBody')}
            />
          ) : (
            <ul className="rd-list">
              {bookmarks.map((p) => (
                <li key={p} className="rd-list-row">
                  <button
                    type="button"
                    className={`rd-list-btn${p === currentPage ? ' is-active' : ''}`}
                    onClick={() => onGoTo(p)}
                  >
                    <Icon name="bookmark" size={15} />
                    <span className="rd-list-label">{t('reader.pageN', { n: p })}</span>
                  </button>
                  <button
                    type="button"
                    className="rd-icon-btn rd-icon-btn-sm"
                    onClick={() => onToggleBookmark(p)}
                    aria-label={t('reader.removeBookmark', { n: p })}
                  >
                    <Icon name="x" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </aside>
  );
}

function Empty({ icon, title, body }) {
  return (
    <div className="rd-empty">
      <span className="rd-empty-glyph"><Icon name={icon} size={22} /></span>
      <p className="rd-empty-title">{title}</p>
      <p className="rd-empty-body">{body}</p>
    </div>
  );
}

/* ── Page thumbnails ──
   Rendered one at a time as each tile scrolls into view, at a fixed
   small width, and kept once drawn. An IntersectionObserver rather than
   a scroll handler: the panel is its own scroller and the observer
   reports what is actually visible without the panel having to know its
   own geometry. */
function ThumbnailGrid({ pdf, numPages, currentPage, onGoTo }) {
  const { t } = useTranslation();
  const gridRef = useRef(null);
  const [wanted, setWanted] = useState(() => new Set());

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    const io = new IntersectionObserver((entries) => {
      const next = [];
      entries.forEach((e) => {
        if (e.isIntersecting) next.push(Number(e.target.dataset.page));
      });
      if (next.length) {
        setWanted((prev) => {
          const merged = new Set(prev);
          next.forEach((n) => merged.add(n));
          return merged;
        });
      }
    }, { root: grid, rootMargin: '200px' });

    grid.querySelectorAll('.rd-thumb').forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [numPages]);

  return (
    <div className="rd-thumbs" ref={gridRef}>
      {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          data-page={n}
          className={`rd-thumb${n === currentPage ? ' is-active' : ''}`}
          onClick={() => onGoTo(n)}
          aria-label={t('reader.goToPage', { n })}
        >
          <Thumbnail pdf={pdf} pageNumber={n} enabled={wanted.has(n)} />
          <span className="rd-thumb-num">{n}</span>
        </button>
      ))}
    </div>
  );
}

function Thumbnail({ pdf, pageNumber, enabled }) {
  const canvasRef = useRef(null);
  const drawn = useRef(false);

  useEffect(() => {
    if (!enabled || !pdf || drawn.current) return undefined;
    let cancelled = false;
    let task = null;

    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 108 / base.width });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      task = page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport });
      return task.promise.then(() => { if (!cancelled) drawn.current = true; });
    }).catch(() => {
      // A page that will not draw leaves an empty tile with its number,
      // which is still a working jump target.
    });

    return () => { cancelled = true; task?.cancel(); };
  }, [enabled, pdf, pageNumber]);

  return <canvas ref={canvasRef} className="rd-thumb-canvas" />;
}
