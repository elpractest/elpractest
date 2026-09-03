import React, { useEffect, useRef, useState } from 'react';
import { highlightColor } from './palette';

/**
 * ONE PAGE of the booklet: the rasterised picture, the invisible text
 * layer over it, and the student's marks over that.
 *
 * Three layers, in that order, and the order is the whole design:
 *
 *   canvas      the page as pixels. Never recoloured — a night or sepia
 *               page is a blend layer laid over this, so the glyphs stay
 *               exactly as sharp as they rendered.
 *   .textLayer  pdf.js's transparent, selectable copy of the text. This
 *               is what makes selection, copy, search and read-aloud
 *               possible at all; it is invisible but it is the only real
 *               text on screen.
 *   marks       highlights, drawn UNDER the text layer's pointer events
 *               so a highlight never blocks the next selection.
 *
 * The page only renders when the surface says it is near the viewport.
 * A 300-page booklet rasterised in full is hundreds of megabytes of
 * canvas and will be killed by the OS on a mid-range phone, which is the
 * device most of this audience reads on.
 */
export default function PdfPage({
  pdf,
  pageNumber,
  scale,
  width,
  height,
  active,
  annotations,
  searchRects,
  nightInvert,
  onTextReady,
}) {
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  /* Held in a ref so the render effect below does not depend on this
     callback's identity. The parent rebuilds it whenever it learns a
     page's real dimensions, and with it in the dependency array every
     page cancelled its own half-finished render and started again — the
     canvas survived that, but the text layer was cleared by the restart
     and often never repopulated, which quietly takes selection, search,
     highlighting and read-aloud with it. */
  const onTextReadyRef = useRef(onTextReady);
  useEffect(() => { onTextReadyRef.current = onTextReady; }, [onTextReady]);

  /* The previous render on THIS canvas, as a promise that always settles.
     pdf.js will not start a second render for a page whose previous task
     is still tearing down: `page.render()` returns a task whose promise
     then never settles at all — no resolve, no reject — so the canvas is
     painted but the text layer after it is never built, and selection,
     search, highlighting and read-aloud all silently stop working.

     `cancel()` rejects the promise, so awaiting the caught version here is
     a barrier that waits for the teardown to actually complete before
     asking for the next frame. */
  const inFlight = useRef(null);

  useEffect(() => {
    if (!active || !pdf) return undefined;

    let cancelled = false;
    let renderTask = null;
    let textLayer = null;
    /* Set once this pass has drawn everything it was going to draw.
       Nothing finished is ever cancelled: `cancel()` on a completed render
       task, or on a text layer whose stream has already ended, still
       sends a cancellation down to the worker for that page, and the NEXT
       render of the same page then waits for an operator list the worker
       will never send — a promise that neither resolves nor rejects. The
       page paints and everything after it (the text layer, and with it
       selection, search, highlighting and read-aloud) silently never
       happens. React's StrictMode double-invoke in development is what
       made this reproducible; a zoom change in production would have hit
       it just as surely. */
    let finished = false;

    (async () => {
      if (inFlight.current) {
        try { await inFlight.current; } catch { /* cancelled — that is the point */ }
        if (cancelled) return;
      }

      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Render at device resolution and display at CSS resolution, so the
      // page is sharp on a phone's 3x screen instead of being upscaled
      // from a 1x bitmap. Capped at 2: beyond that the memory cost per
      // page doubles again for a difference nobody can see.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d', { alpha: false });
      renderTask = page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0],
      });
      inFlight.current = renderTask.promise.catch(() => {});

      try {
        await renderTask.promise;
      } catch (err) {
        // A cancelled render is the normal outcome of scrolling fast or
        // changing zoom mid-paint, not a failure worth surfacing.
        if (err?.name !== 'RenderingCancelledException') throw err;
        return;
      }
      if (cancelled) return;

      const container = textRef.current;
      if (container) {
        container.replaceChildren();
        const { TextLayer } = await import('pdfjs-dist/build/pdf.mjs');
        if (cancelled) return;

        textLayer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container,
          viewport,
        });
        await textLayer.render();
        if (cancelled) return;

        // pdf.js relies on a zero-height sentinel after the last span to
        // make "select to the end of the page" behave; TextLayer does not
        // add it for us when we drive it directly.
        const end = document.createElement('div');
        end.className = 'endOfContent';
        container.append(end);

        onTextReadyRef.current?.(pageNumber);
      }

      finished = true;
      setRendered(true);
    })().catch((err) => {
      /* A page that will not rasterise (a corrupt object stream, a font
         the engine chokes on) must not take the whole booklet down with
         it — that page stays blank and the rest reads normally. But it is
         still reported: swallowing it entirely is how a booklet that
         renders as twelve blank pages looks like a mystery rather than a
         bug with a cause. */
      console.warn(`[reader] page ${pageNumber} could not be rendered:`, err);
    });

    return () => {
      cancelled = true;
      if (finished) return;
      renderTask?.cancel();
      textLayer?.cancel?.();
    };
  }, [pdf, pageNumber, scale, active]);

  // Freed when the page leaves the window, which is the entire point of
  // unmounting it: a canvas that is merely detached still holds its
  // backing store until it is collected.
  useEffect(() => {
    if (active) return undefined;
    return () => { setRendered(false); };
  }, [active]);

  return (
    <div
      className="rd-page"
      data-page={pageNumber}
      style={{ width, height, '--scale-factor': scale }}
    >
      {/* Marks sit between the picture and the text layer. Above the
          canvas so they are visible, below the text so they never
          intercept the pointer that is trying to select the words. */}
      <div className="rd-marks" aria-hidden="true">
        {annotations.map((a) => (
          (a.rects || []).map((r, i) => (
            <span
              key={`${a.id}-${i}`}
              className="rd-mark"
              style={{
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
                background: highlightColor(a.color, nightInvert),
                // A note with no highlight still needs to be findable on
                // the page, so it gets an underline rather than a wash.
                ...(a.type === 'note' && { background: 'transparent', borderBottom: `2px solid ${highlightColor(a.color, nightInvert)}` }),
              }}
            />
          ))
        ))}
        {searchRects.map((r, i) => (
          <span
            key={`s-${i}`}
            className={`rd-mark rd-mark-find${r.active ? ' is-active' : ''}`}
            style={{
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
            }}
          />
        ))}
      </div>

      <canvas ref={canvasRef} className="rd-canvas" />
      <div ref={textRef} className="textLayer" />

      {!rendered && (
        <div className="rd-page-pending" aria-hidden="true">
          <span className="rd-page-pending-num">{pageNumber}</span>
        </div>
      )}
    </div>
  );
}
