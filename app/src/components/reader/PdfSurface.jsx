import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PdfPage from './PdfPage';

/* How many pages either side of the one being read stay rasterised.
   Two is enough that a normal scroll never reaches a blank page, and
   small enough that a 300-page booklet holds five canvases rather than
   three hundred. */
const WINDOW = 2;

/**
 * THE READING SURFACE — the scroller that owns page geometry, which page
 * is being read, and what the student has selected.
 *
 * Page sizes are seeded from page 1 and corrected as real pages render.
 * Asking the worker for every page's dimensions up front is a round trip
 * per page before anything can be drawn, which on a 300-page booklet is
 * a visibly blank reader; almost every booklet is one paper size
 * throughout, so the seed is right for all of it and the correction
 * handles the fold-out map on page 212.
 */
export default function PdfSurface({
  pdf,
  numPages,
  fit,
  zoom,
  scrollMode,
  pageTheme,
  themeMix,
  brightness,
  contrast,
  currentPage,
  onPageChange,
  annotationsByPage,
  searchHitsByPage,
  onSelect,
  onClearSelection,
  scrollRef,
}) {
  const [baseSize, setBaseSize] = useState(null);      // { w, h } in PDF units at scale 1
  const [overrides, setOverrides] = useState({});      // pageNumber -> { w, h }
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  const innerRef = useRef(null);
  /* Set while the surface is scrolling itself to a page. Without it the
     scroll handler reads the intermediate positions of its own animation
     and reports them as the student turning pages, which fights the jump
     and lands somewhere near but not on the target. */
  const programmaticScroll = useRef(false);

  // ── Base page size ──────────────────────────────────────────────────
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    pdf.getPage(1).then((p) => {
      if (cancelled) return;
      const v = p.getViewport({ scale: 1 });
      setBaseSize({ w: v.width, h: v.height });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pdf]);

  // ── Available space ─────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);

  /* Gutter is the breathing space around the page, and it is deliberately
     tighter on a phone: on a 390px screen a 32px gutter is 16% of the
     reading width, which on a scanned booklet is the difference between
     readable body type and a squint. */
  const gutter = viewport.w < 640 ? 10 : 28;

  /* Both facts have to be in before a single page is drawn: how big the
     paper is, and how much room there is for it. Rendering at a
     placeholder scale and re-rendering at the real one is not just wasted
     work — it makes every page cancel a render it had already started,
     which is the exact condition pdf.js hangs on (see PdfPage). */
  const ready = !!baseSize && viewport.w > 0;

  const scale = useMemo(() => {
    if (!ready) return 1;
    const byWidth = (viewport.w - gutter * 2) / baseSize.w;
    if (fit === 'page') {
      const byHeight = (viewport.h - gutter * 2) / baseSize.h;
      return Math.max(0.1, Math.min(byWidth, byHeight) * zoom);
    }
    return Math.max(0.1, byWidth * zoom);
  }, [ready, baseSize, viewport, fit, zoom, gutter]);

  const sizeOf = useCallback((n) => {
    const s = overrides[n] || baseSize;
    if (!s) return { width: 0, height: 0 };
    return { width: Math.floor(s.w * scale), height: Math.floor(s.h * scale) };
  }, [overrides, baseSize, scale]);

  /* A page whose real dimensions differ from the seed corrects the layout
     once and then stops — the guard is what keeps this from being a
     render loop. */
  const noteRealSize = useCallback((n) => {
    if (!pdf) return;
    pdf.getPage(n).then((p) => {
      const v = p.getViewport({ scale: 1 });
      setOverrides((prev) => {
        const known = prev[n] || baseSize;
        if (known && Math.abs(known.w - v.width) < 0.5 && Math.abs(known.h - v.height) < 0.5) return prev;
        return { ...prev, [n]: { w: v.width, h: v.height } };
      });
    }).catch(() => {});
  }, [pdf, baseSize]);

  // ── Which pages are live ────────────────────────────────────────────
  const pages = useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages],
  );

  const isLive = useCallback(
    (n) => (scrollMode === 'paged' ? n === currentPage : Math.abs(n - currentPage) <= WINDOW),
    [scrollMode, currentPage],
  );

  // ── Reading position, from the scroll ───────────────────────────────
  useEffect(() => {
    if (scrollMode === 'paged') return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;

    let frame = 0;
    const onScroll = () => {
      if (programmaticScroll.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nodes = innerRef.current?.querySelectorAll('.rd-page');
        if (!nodes?.length) return;
        // The page being READ is the one crossing the upper third of the
        // viewport, not the one that happens to cover the most pixels: at
        // a page boundary the eye is on the top of the incoming page well
        // before it wins on area.
        const mark = el.getBoundingClientRect().top + el.clientHeight / 3;
        let found = 1;
        for (const node of nodes) {
          const r = node.getBoundingClientRect();
          if (r.top <= mark) found = Number(node.dataset.page);
          else break;
        }
        onPageChange(found);
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [scrollMode, onPageChange, scrollRef]);

  /* Jumping to a page. In continuous mode this scrolls; in paged mode the
     page simply becomes the only one mounted, so there is nothing to
     scroll and the surface resets to the top instead.

     `scale` is in the deps, and that is what makes "resume where you left
     off" actually work. On open, currentPage arrives from the server
     before the document does, so this runs while every page still has
     zero height: there is nothing to scroll to, the jump is a no-op, and
     the reader sits on page 1 while the counter reads 34. Scale goes from
     its placeholder to a real value the moment page geometry is known,
     which re-runs this with something to scroll to. It also means a zoom
     change re-anchors to the page being read instead of drifting. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    if (scrollMode === 'paged') {
      el.scrollTop = 0;
      return undefined;
    }

    const node = innerRef.current?.querySelector(`.rd-page[data-page="${currentPage}"]`);
    if (!node) return undefined;

    const delta = node.getBoundingClientRect().top - el.getBoundingClientRect().top;
    // Already on screen and near the top — the student scrolled here
    // themselves, so leave their position exactly where they put it.
    if (Math.abs(delta) < 8) return undefined;

    programmaticScroll.current = true;
    el.scrollTo({ top: el.scrollTop + delta - gutter, behavior: 'auto' });
    const t = setTimeout(() => { programmaticScroll.current = false; }, 150);
    return () => clearTimeout(t);
    // Deliberately NOT keyed on gutter: it only changes with a breakpoint
    // crossing, and re-anchoring the page on a window resize would fight
    // the student mid-scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, scrollMode, scale, numPages]);

  // ── Selection ───────────────────────────────────────────────────────
  const readSelection = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!sel || sel.isCollapsed || !text) {
      onClearSelection();
      return;
    }

    const anchor = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
    const pageEl = anchor?.closest?.('.rd-page');
    if (!pageEl) {
      onClearSelection();
      return;
    }

    const box = pageEl.getBoundingClientRect();
    if (!box.width || !box.height) return;

    const raw = Array.from(sel.getRangeAt(0).getClientRects());
    const rects = raw
      // A selection can run onto the next page; anything outside this
      // page's box is dropped rather than clamped, because a rect
      // squashed against the bottom edge would draw a bar across a line
      // the student did not select.
      .filter((r) => r.width > 0.5 && r.height > 0.5 && r.top < box.bottom && r.bottom > box.top)
      .map((r) => ({
        x: (r.left - box.left) / box.width,
        y: (r.top - box.top) / box.height,
        w: r.width / box.width,
        h: r.height / box.height,
      }))
      .filter((r) => r.x > -0.02 && r.x < 1.02);

    if (!rects.length) {
      onClearSelection();
      return;
    }

    onSelect({
      page: Number(pageEl.dataset.page),
      text,
      rects,
      // Viewport coordinates of the selection, for placing the sheet.
      anchor: { top: raw[0].top, bottom: raw[raw.length - 1].bottom, left: raw[0].left },
    });
  }, [onSelect, onClearSelection]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    // Desktop: a finished drag is a mouseup, and reading the selection
    // synchronously there is correct.
    const onMouseUp = () => setTimeout(readSelection, 0);
    el.addEventListener('mouseup', onMouseUp);

    /* Touch: `mouseup` is not reliably dispatched when a selection is made
       or adjusted with the native drag handles, so the same read is driven
       from `selectionchange` (debounced past the handle drag) and from
       `touchend` (delayed a tick, because some Android WebViews update the
       Selection API just after the finger lifts). */
    const isCoarse = window.matchMedia?.('(pointer: coarse)').matches;
    let debounce = null;
    const onSelectionChange = () => {
      clearTimeout(debounce);
      debounce = setTimeout(readSelection, 260);
    };
    const onTouchEnd = () => setTimeout(readSelection, 60);

    if (isCoarse) {
      document.addEventListener('selectionchange', onSelectionChange);
      el.addEventListener('touchend', onTouchEnd);
    }

    return () => {
      el.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('selectionchange', onSelectionChange);
      el.removeEventListener('touchend', onTouchEnd);
      clearTimeout(debounce);
    };
  }, [readSelection, scrollRef]);

  const theme = pageTheme;

  return (
    <div
      ref={innerRef}
      className={`rd-surface rd-surface-${scrollMode}`}
      style={{ padding: gutter, gap: gutter }}
    >
      {!ready && <div className="rd-surface-waiting" aria-hidden="true" />}

      {ready && pages.map((n) => {
        const { width, height } = sizeOf(n);
        if (scrollMode === 'paged' && n !== currentPage) return null;

        return (
          <div
            key={n}
            className="rd-page-frame"
            style={{
              width,
              height,
              // Contrast is the one adjustment that genuinely needs a
              // filter — there is no compositing trick for it. Applied
              // only when the student has moved it off 1, so the default
              // page is never put through a filter at all.
              ...(contrast !== 1 && { filter: `contrast(${contrast})` }),
            }}
          >
            <PdfPage
              pdf={pdf}
              pageNumber={n}
              scale={scale}
              width={width}
              height={height}
              active={isLive(n)}
              annotations={annotationsByPage[n] || []}
              searchRects={searchHitsByPage[n] || []}
              nightInvert={theme === 'night'}
              onTextReady={noteRealSize}
            />
            {/* The tint that makes a page sepia or dark. A blend layer
                rather than a filter on the canvas: filters resample the
                bitmap and soften the type, and `difference` against white
                inverts a scan while leaving a colour diagram legible,
                which `invert()` does not. */}
            {themeMix && (
              <div
                className="rd-page-tint"
                style={{
                  background: themeMix.color,
                  mixBlendMode: themeMix.mode,
                  opacity: themeMix.opacity,
                }}
                aria-hidden="true"
              />
            )}
            {brightness !== 1 && (
              <div
                className="rd-page-veil"
                style={{
                  // Dimming as a black veil rather than a filter, for the
                  // same reason as the tint: nothing resamples the page.
                  background: `rgba(0,0,0,${(1 - brightness).toFixed(3)})`,
                }}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
