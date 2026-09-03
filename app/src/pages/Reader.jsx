import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/reader.css';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import api from '../api';
import Icon from '../components/Icon';
import { fetchMaterialBytes, openDocument, readOutline, readPageText } from '../lib/pdfEngine';
import {
  PAGE_THEMES,
  closePanel,
  openPanel,
  openStudy,
  toggleFocusMode,
  togglePanel,
  useReader,
} from '../lib/readerStore';

import PdfSurface from '../components/reader/PdfSurface';
import ContentsPanel from '../components/reader/ContentsPanel';
import DisplayPanel from '../components/reader/DisplayPanel';
import SearchPanel from '../components/reader/SearchPanel';
import StudyDrawer from '../components/reader/StudyDrawer';
import SelectionSheet from '../components/reader/SelectionSheet';
import ProgressSheet from '../components/reader/ProgressSheet';
import ReaderBottomBar from '../components/reader/ReaderBottomBar';
import Watermark from '../components/reader/Watermark';
import { findOnPage } from '../components/reader/findOnPage';
import { useSpeech } from '../components/reader/useSpeech';

/* How often an open reader tells the server where it is. Also fires on
   tab-hide and on unmount, so 30s is the worst case for a browser that
   is killed outright rather than the normal one. */
const SYNC_MS = 30000;

/**
 * THE READER — a full-bleed surface, like the test-taking screen.
 *
 * No StudentShell: the app header and the bottom tab bar would take a
 * fifth of a phone screen away from the page and offer navigation that
 * is actively unwanted mid-chapter. The one way out is the back arrow,
 * and it goes where the student came from.
 *
 * Everything that can be reached is reachable from four places and no
 * more: the header (back, bookmark, find, Aa), the bottom bar (contents,
 * marks, Vajini, listen), the selection sheet (highlight, note, copy,
 * listen, ask), and the two drawers those open. Panels are mutually
 * exclusive by construction — see lib/readerStore.js.
 */
export default function Reader({ user }) {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const prefs = useReader();

  // ── Server state ────────────────────────────────────────────────────
  const [material, setMaterial] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loadError, setLoadError] = useState('');

  // ── Document ────────────────────────────────────────────────────────
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [outline, setOutline] = useState([]);
  const [downloadPct, setDownloadPct] = useState(0);
  const [opening, setOpening] = useState(true);

  // ── Reading ─────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [selection, setSelection] = useState(null);
  const [noteFor, setNoteFor] = useState(null);   // selection awaiting a note
  const [noteDraft, setNoteDraft] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [vajiniSeed, setVajiniSeed] = useState('');

  // ── Search ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [indexing, setIndexing] = useState(false);
  const [indexed, setIndexed] = useState(0);
  const [hitRects, setHitRects] = useState({});
  const [activeHit, setActiveHit] = useState(0);
  const textIndex = useRef(null);   // pageNumber -> extracted text

  const scrollRef = useRef(null);
  const speech = useSpeech();

  /* Seconds already reported to the server this sitting. The client sends
     the DELTA, not a running total: two tabs open on the same booklet
     would otherwise overwrite each other with whichever closed last. */
  const syncedSeconds = useRef(0);
  const pageRef = useRef(1);
  const bookmarksRef = useRef([]);
  useEffect(() => { pageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { bookmarksRef.current = bookmarks; }, [bookmarks]);

  // ── Open ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setOpening(true);
    setLoadError('');

    (async () => {
      const { data } = await api.get(`/api/student/study-materials/${materialId}`);
      if (cancelled) return;

      setMaterial(data.material);
      setAnnotations(data.annotations || []);
      setBookmarks(data.progress?.bookmarks || []);

      /* A `?page=` in the URL wins over the saved position — that link
         came from a bookmark, a note or a search result and naming a page
         is the whole point of it. Otherwise resume where they stopped. */
      const wanted = Number(params.get('page'));
      setCurrentPage(wanted > 0 ? wanted : (data.progress?.current_page || 1));

      const bytes = await fetchMaterialBytes(materialId, {
        signal: controller.signal,
        onProgress: (pct) => { if (!cancelled) setDownloadPct(pct ?? 0); },
      });
      if (cancelled) return;

      const doc = await openDocument(bytes);
      if (cancelled) { doc.destroy(); return; }

      setPdf(doc);
      setNumPages(doc.numPages);
      setOpening(false);

      // The index is nice to have and slow on a big booklet, so it is
      // resolved after the first page is already readable.
      readOutline(doc).then((o) => { if (!cancelled) setOutline(o); });
    })().catch((err) => {
      if (cancelled || err?.name === 'CanceledError' || err?.name === 'AbortError') return;
      setLoadError(
        err?.response?.status === 403
          ? t('reader.errLocked')
          : err?.response?.status === 404
            ? t('reader.errMissing')
            : t('reader.errGeneric'),
      );
      setOpening(false);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  // The worker holds the whole document; letting it go is what frees the
  // tens of megabytes a booklet occupies.
  useEffect(() => () => { pdf?.destroy?.(); }, [pdf]);

  // ── Session clock ───────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      // Only count time the reader is actually in front of someone. A tab
      // left open overnight is not four hundred minutes of reading, and
      // letting it claim so would make the pace estimate useless.
      if (document.visibilityState === 'visible') setSessionSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Sync ────────────────────────────────────────────────────────────
  const percent = numPages ? Math.max(1, Math.round((currentPage / numPages) * 100)) : 0;

  const sync = useCallback(() => {
    if (!numPages) return;
    const elapsed = Math.max(0, sessionSeconds - syncedSeconds.current);
    syncedSeconds.current = sessionSeconds;

    api.patch(`/api/student/study-materials/${materialId}/progress`, {
      current_page: pageRef.current,
      percent_complete: numPages ? Math.round((pageRef.current / numPages) * 100) : 0,
      seconds_read: elapsed,
      bookmarks: bookmarksRef.current,
    }).catch(() => {
      /* A failed sync is never surfaced: it is background bookkeeping and
         interrupting someone's reading to tell them their page number did
         not save is worse than the missed save. The next tick retries. */
    });
  }, [materialId, numPages, sessionSeconds]);

  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; }, [sync]);

  useEffect(() => {
    if (!numPages) return undefined;
    const id = setInterval(() => syncRef.current(), SYNC_MS);
    const onHide = () => { if (document.visibilityState === 'hidden') syncRef.current(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      syncRef.current();
    };
  }, [numPages]);

  /* Settling on a new page is worth a sync of its own, debounced.
     The heartbeat alone means a student who reads to page 40 and then
     closes the tab outright can lose up to half a minute of position —
     and a browser killed during an unload does not finish an in-flight
     request, so the unmount sync is not a guarantee. Debounced rather
     than fired per page so scrolling through twenty pages is one write,
     not twenty; well inside the endpoint's 40/min. */
  useEffect(() => {
    if (!numPages) return undefined;
    const id = setTimeout(() => syncRef.current(), 4000);
    return () => clearTimeout(id);
  }, [currentPage, bookmarks, numPages]);

  // ── Navigation ──────────────────────────────────────────────────────
  const goTo = useCallback((n) => {
    setCurrentPage(Math.min(Math.max(1, n), numPages || 1));
  }, [numPages]);

  const toggleBookmark = useCallback((page) => {
    setBookmarks((prev) => (
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page].sort((a, b) => a - b)
    ));
  }, []);

  // ── Annotations ─────────────────────────────────────────────────────
  const saveAnnotation = useCallback(async (body) => {
    try {
      const { data } = await api.post(`/api/student/study-materials/${materialId}/annotations`, body);
      setAnnotations((prev) => [...prev, data.annotation]);
    } catch {
      /* Unlike a position sync, a lost highlight is work the student can
         see disappear, so it is worth one honest line rather than silence.
         Kept as an alert only because the SPA has no toast primitive. */
      window.alert(t('reader.markFailed'));
    }
  }, [materialId, t]);

  const updateAnnotation = useCallback(async (id, patch) => {
    const before = annotations;
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    try {
      await api.put(`/api/student/annotations/${id}`, patch);
    } catch {
      setAnnotations(before);
    }
  }, [annotations]);

  const deleteAnnotation = useCallback(async (id) => {
    const before = annotations;
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    try {
      await api.delete(`/api/student/annotations/${id}`);
    } catch {
      setAnnotations(before);
    }
  }, [annotations]);

  const clearSelection = useCallback(() => setSelection(null), []);

  const highlight = (color) => {
    if (!selection) return;
    saveAnnotation({
      type: 'highlight',
      color,
      page: selection.page,
      selected_text: selection.text.slice(0, 5000),
      rects: selection.rects,
    });
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  };

  const startNote = () => {
    if (!selection) return;
    setNoteFor(selection);
    setNoteDraft('');
    setSelection(null);
  };

  const commitNote = () => {
    if (!noteFor) return;
    saveAnnotation({
      type: 'note',
      color: 'blue',
      page: noteFor.page,
      selected_text: noteFor.text.slice(0, 5000),
      note: noteDraft.trim() || null,
      rects: noteFor.rects,
    });
    window.getSelection()?.removeAllRanges();
    setNoteFor(null);
    setNoteDraft('');
  };

  const askVajini = () => {
    if (!selection) return;
    setVajiniSeed(selection.text.slice(0, 1200));
    openStudy('vajini');
    setSelection(null);
  };

  // ── Read aloud ──────────────────────────────────────────────────────
  const listenToPage = useCallback(async () => {
    if (speech.speaking) { speech.stop(); return; }
    if (!pdf) return;
    const text = await readPageText(pdf, currentPage);
    if (text) speech.speak(text);
  }, [pdf, currentPage, speech]);

  // ── Search ──────────────────────────────────────────────────────────
  const buildIndex = useCallback(async () => {
    if (!pdf || textIndex.current) return;
    setIndexing(true);
    setIndexed(0);
    const map = {};
    for (let n = 1; n <= pdf.numPages; n += 1) {
      // eslint-disable-next-line no-await-in-loop
      map[n] = await readPageText(pdf, n).catch(() => '');
      setIndexed(n);
    }
    textIndex.current = map;
    setIndexing(false);
  }, [pdf]);

  useEffect(() => {
    if (prefs.activePanel === 'search') buildIndex();
  }, [prefs.activePanel, buildIndex]);

  // A new booklet invalidates the index.
  useEffect(() => { textIndex.current = null; }, [materialId]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2 || !textIndex.current) return [];

    const out = [];
    for (const [page, text] of Object.entries(textIndex.current)) {
      const lower = text.toLowerCase();
      let from = 0;
      while (out.length < 200) {
        const at = lower.indexOf(needle, from);
        if (at === -1) break;
        from = at + needle.length;
        out.push({
          page: Number(page),
          at,
          before: text.slice(Math.max(0, at - 42), at),
          match: text.slice(at, at + needle.length),
          after: text.slice(at + needle.length, at + needle.length + 58),
        });
      }
      if (out.length >= 200) break;
    }
    return out;
  }, [query]);

  useEffect(() => { setActiveHit(0); }, [query]);

  /* Marking the hits needs geometry, and geometry only exists once a page
     is rasterised — so this runs against the DOM after the page settles
     rather than being derived from the extracted text. A frame plus a
     short delay covers the render; a page that has not painted yet simply
     produces no marks and gets them on the next pass. */
  useEffect(() => {
    if (prefs.activePanel !== 'search' && !query.trim()) { setHitRects({}); return undefined; }
    const needle = query.trim();
    if (needle.length < 2) { setHitRects({}); return undefined; }

    let raf = 0;
    const id = setTimeout(() => {
      raf = requestAnimationFrame(() => {
        const next = {};
        scrollRef.current?.querySelectorAll('.rd-page').forEach((el) => {
          const page = Number(el.dataset.page);
          const rects = findOnPage(el, needle);
          if (rects.length) next[page] = rects.map((r) => ({ ...r, active: page === currentPage }));
        });
        setHitRects(next);
      });
    }, 180);

    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [query, currentPage, prefs.activePanel, prefs.zoom, prefs.fit]);

  const jumpToHit = (i) => {
    const hit = results[i];
    if (!hit) return;
    setActiveHit(i);
    goTo(hit.page);
    closePanel();
  };

  // ── Keyboard ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target instanceof HTMLInputElement
        || e.target instanceof HTMLTextAreaElement
        || e.target?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openPanel('search');
        return;
      }
      if (typing) return;

      if (e.key === 'Escape') {
        if (prefs.activePanel) { closePanel(); return; }
        if (noteFor) { setNoteFor(null); return; }
        if (prefs.focusMode) toggleFocusMode();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goTo(pageRef.current + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goTo(pageRef.current - 1); }
      if (e.key.toLowerCase() === 'b') toggleBookmark(pageRef.current);
      if (e.key.toLowerCase() === 'f') toggleFocusMode();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, toggleBookmark, prefs.activePanel, prefs.focusMode, noteFor]);

  // ── Derived ─────────────────────────────────────────────────────────
  const annotationsByPage = useMemo(() => {
    const map = {};
    annotations.forEach((a) => {
      (map[a.page] ||= []).push(a);
    });
    return map;
  }, [annotations]);

  /* Minutes left, from the pace the student is actually reading at rather
     than a constant. Before there is enough of a session to measure, it
     falls back to a minute a page, which is roughly right for dense notes
     and honest about being an estimate. */
  const minutesLeft = useMemo(() => {
    const pagesTurned = Math.max(1, currentPage - 1);
    const perPage = sessionSeconds > 45 ? sessionSeconds / pagesTurned : 60;
    return Math.max(0, Math.ceil(((numPages - currentPage) * perPage) / 60));
  }, [sessionSeconds, currentPage, numPages]);

  const theme = PAGE_THEMES[prefs.pageTheme] ?? PAGE_THEMES.day;
  const chromeHidden = prefs.focusMode;

  // ── Failure ─────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="rd-root rd-root-message">
        <div className="glass-panel rd-message">
          <span className="rd-message-glyph"><Icon name="lock" size={26} /></span>
          <h1 className="t-title">{t('reader.cannotOpen')}</h1>
          <p>{loadError}</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/materials')}>
            {t('reader.backToMaterials')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rd-root rd-theme-${prefs.pageTheme}${chromeHidden ? ' is-focus' : ''}`}
      style={{ background: theme.surface }}
      /* The shell is never meant to scroll — see the `overflow: clip` note
         in reader.css. This is the fallback for browsers without clip:
         if anything does manage to scroll it (a focus() on a control
         inside a parked drawer), it is put straight back, because there
         is no control anywhere that scrolls it the other way. */
      onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollLeft !== 0) el.scrollLeft = 0;
        if (el.scrollTop !== 0) el.scrollTop = 0;
      }}
    >
      {/* ── Header ── */}
      <header className="rd-head">
        <button
          type="button"
          className="rd-icon-btn"
          onClick={() => navigate(-1)}
          aria-label={t('reader.back')}
        >
          <Icon name="arrow-left" size={20} />
        </button>

        <div className="rd-head-title">
          <span className="rd-head-name">{material?.title || t('reader.opening')}</span>
          {material?.course?.title && <span className="rd-head-sub">{material.course.title}</span>}
        </div>

        <div className="rd-head-actions">
          <button
            type="button"
            className={`rd-icon-btn${bookmarks.includes(currentPage) ? ' is-on' : ''}`}
            onClick={() => toggleBookmark(currentPage)}
            aria-pressed={bookmarks.includes(currentPage)}
            aria-label={bookmarks.includes(currentPage)
              ? t('reader.removeBookmark', { n: currentPage })
              : t('reader.bookmarkPage', { n: currentPage })}
          >
            <Icon name="bookmark" size={20} />
          </button>
          <button
            type="button"
            className={`rd-icon-btn${prefs.activePanel === 'search' ? ' is-on' : ''}`}
            onClick={() => togglePanel('search')}
            aria-pressed={prefs.activePanel === 'search'}
            aria-label={t('reader.findInBook')}
          >
            <Icon name="search" size={20} />
          </button>
          <button
            type="button"
            className={`rd-icon-btn rd-aa${prefs.activePanel === 'display' ? ' is-on' : ''}`}
            onClick={() => togglePanel('display')}
            aria-pressed={prefs.activePanel === 'display'}
            aria-label={t('reader.display')}
          >
            Aa
          </button>
        </div>
      </header>

      {/* ── The page ── */}
      <main
        className="rd-main"
        ref={scrollRef}
        style={{
          // The bar is a fixed 84px band unless it is tucked away, in
          // which case the page takes the space back rather than leaving
          // a blank strip under it.
          paddingBottom: chromeHidden || prefs.barCollapsed ? 0 : 84,
        }}
      >
        {opening ? (
          <div className="rd-opening">
            <div className="spinner" />
            <p>{downloadPct > 0 ? t('reader.downloading', { pct: downloadPct }) : t('reader.opening')}</p>
            {downloadPct > 0 && (
              <div className="rd-dl"><span style={{ width: `${downloadPct}%` }} /></div>
            )}
          </div>
        ) : (
          <PdfSurface
            pdf={pdf}
            numPages={numPages}
            fit={prefs.fit}
            zoom={prefs.zoom}
            scrollMode={prefs.scrollMode}
            pageTheme={prefs.pageTheme}
            themeMix={theme.mix}
            brightness={prefs.brightness}
            contrast={prefs.contrast}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            annotationsByPage={annotationsByPage}
            searchHitsByPage={hitRects}
            onSelect={setSelection}
            onClearSelection={clearSelection}
            scrollRef={scrollRef}
          />
        )}
      </main>

      {/* Warm overlay for night reading. Over the page and under the
          chrome, so the controls stay their own colour. */}
      {prefs.warmth > 0 && (
        <div
          className="rd-warmth"
          style={{ opacity: prefs.warmth / 320 }}
          aria-hidden="true"
        />
      )}

      {user && <Watermark name={user.name} email={user.email} />}

      {/* Paged mode has no scroll to turn a page with, so it gets its own
          edge controls rather than borrowing the header's page counter. */}
      {!opening && prefs.scrollMode === 'paged' && (
        <>
          <button
            type="button"
            className="rd-flip rd-flip-prev"
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label={t('reader.previousPage')}
          >
            <Icon name="chevron-left" size={22} />
          </button>
          <button
            type="button"
            className="rd-flip rd-flip-next"
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage >= numPages}
            aria-label={t('reader.nextPage')}
          >
            <Icon name="chevron-right" size={22} />
          </button>
        </>
      )}

      {/* ── Panels ── */}
      <ContentsPanel
        open={prefs.activePanel === 'contents' && !chromeHidden}
        outline={outline}
        numPages={numPages}
        currentPage={currentPage}
        bookmarks={bookmarks}
        pdf={pdf}
        onGoTo={(n) => { goTo(n); closePanel(); }}
        onToggleBookmark={toggleBookmark}
        onClose={closePanel}
      />

      <DisplayPanel
        open={prefs.activePanel === 'display' && !chromeHidden}
        prefs={prefs}
        onClose={closePanel}
      />

      <StudyDrawer
        open={prefs.activePanel === 'study' && !chromeHidden}
        tab={prefs.studyTab}
        annotations={annotations}
        currentPage={currentPage}
        materialTitle={material?.title || ''}
        seedQuestion={vajiniSeed}
        onSeedUsed={() => setVajiniSeed('')}
        onGoTo={(n) => goTo(n)}
        onUpdateAnnotation={updateAnnotation}
        onDeleteAnnotation={deleteAnnotation}
        onClose={closePanel}
      />

      <SearchPanel
        open={prefs.activePanel === 'search'}
        query={query}
        onQuery={setQuery}
        indexing={indexing}
        indexed={indexed}
        totalPages={numPages}
        results={results}
        activeIndex={activeHit}
        onJump={jumpToHit}
        onClose={closePanel}
      />

      <ProgressSheet
        open={prefs.activePanel === 'progress' && !chromeHidden}
        currentPage={currentPage}
        totalPages={numPages}
        percent={percent}
        minutesLeft={minutesLeft}
        sessionSeconds={sessionSeconds}
        markCount={annotations.length}
        bookmarkCount={bookmarks.length}
        onClose={closePanel}
      />

      <SelectionSheet
        selection={selection}
        onHighlight={highlight}
        onNote={startNote}
        onListen={() => { speech.speak(selection.text); setSelection(null); }}
        onAsk={askVajini}
        onDismiss={() => { window.getSelection()?.removeAllRanges(); setSelection(null); }}
      />

      {/* Note composer — a small modal rather than an inline popover,
          because typing next to a selection on a phone puts the keyboard
          over the passage being annotated. */}
      {noteFor && (
        <div className="rd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setNoteFor(null); }}>
          <div className="rd-note-modal">
            <h2 className="t-heading">{t('reader.addNoteTitle')}</h2>
            <blockquote className="rd-mark-quote">{noteFor.text}</blockquote>
            <textarea
              className="form-input"
              rows={4}
              autoFocus
              value={noteDraft}
              placeholder={t('reader.notePlaceholder')}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitNote(); }}
            />
            <div className="rd-note-edit-actions">
              <button type="button" className="btn-secondary" onClick={() => setNoteFor(null)}>
                {t('reader.cancel')}
              </button>
              <button type="button" className="btn-primary" onClick={commitNote}>
                {t('reader.saveNote')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── The thumb zone ── */}
      {!chromeHidden && !opening && (
        <ReaderBottomBar
          currentPage={currentPage}
          totalPages={numPages}
          percent={percent}
          minutesLeft={minutesLeft}
          activePanel={prefs.activePanel}
          studyTab={prefs.studyTab}
          collapsed={prefs.barCollapsed}
          isSpeaking={speech.speaking}
          onListen={listenToPage}
        />
      )}

      {/* Focus mode hides everything; this is the one way back, and it
          stays visible rather than appearing on hover — a control you
          have to discover by waving the mouse at the right band of the
          screen does not exist on a phone at all. */}
      {chromeHidden && (
        <button type="button" className="rd-exit-focus" onClick={toggleFocusMode}>
          <Icon name="eye-off" size={16} /> {t('reader.exitFocus')}
        </button>
      )}
    </div>
  );
}
