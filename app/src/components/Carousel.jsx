import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';

/**
 * Carousel chrome around a native scroll-snap strip.
 *
 * The track keeps `overflow-x: auto` + scroll snapping, so touch swipe,
 * momentum, and keyboard scrolling stay native — this only adds the parts a
 * plain slider is missing: prev/next arrows, dot indicators, and optional
 * auto-advance.
 *
 * It is layout-agnostic on purpose. The caller styles the track (the existing
 * flex/grid classes are passed through as `trackClassName`), and every control
 * hides itself when the track is not actually scrollable — so a strip that
 * becomes a grid at ≥640px silently stops being a carousel there, with no
 * breakpoint duplicated in JS.
 *
 * Children must be the slides themselves (flex: none + scroll-snap-align),
 * exactly as they were before this wrapper existed.
 */
export default function Carousel({
  children,
  trackClassName = '',
  ariaLabel,
  autoPlay = false,
  interval = 5000,
  showDots = true,
  trackStyle,
}) {
  const trackRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  const [active, setActive] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [paused, setPaused] = useState(false);

  const count = React.Children.count(children);

  /* Scroll offsets that align each slide to the track's content edge. */
  const slidePositions = useCallback(() => {
    const el = trackRef.current;
    if (!el) return [];
    const padLeft = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const trackLeft = el.getBoundingClientRect().left;
    // rect left is viewport-relative, so add the current scroll back to land
    // in the track's own content coordinates.
    return Array.from(el.children).map(
      (child) => Math.max(0, child.getBoundingClientRect().left - trackLeft + el.scrollLeft - padLeft)
    );
  }, []);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;

    /* Snap points ignore the track's own padding, so a snapped slide would sit
       flush against the edge and lose the gutter. Mirroring the padding into
       scroll-padding keeps the gutter and lines the native snap up with the
       offsets the arrows and dots scroll to. */
    const padLeft = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    if (parseFloat(el.style.scrollPaddingLeft || '0') !== padLeft) {
      el.style.scrollPaddingLeft = `${padLeft}px`;
    }

    const max = el.scrollWidth - el.clientWidth;
    setOverflowing(max > 4);
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < max - 4);

    const positions = slidePositions();
    if (positions.length === 0) return;
    let nearest = 0;
    positions.forEach((pos, i) => {
      if (Math.abs(pos - el.scrollLeft) < Math.abs(positions[nearest] - el.scrollLeft)) nearest = i;
    });
    setActive(nearest);
  }, [slidePositions]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    el.addEventListener('scroll', onScroll, { passive: true });

    // Re-measure on layout changes: breakpoint flips, font load, item count.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    window.addEventListener('resize', sync);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
      ro?.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [sync, count]);

  const scrollToSlide = useCallback((index) => {
    const el = trackRef.current;
    if (!el) return;
    const positions = slidePositions();
    const target = positions[Math.max(0, Math.min(index, positions.length - 1))];
    if (target === undefined) return;
    // 'auto' defers to the track's CSS scroll-behavior, which is smooth except
    // under prefers-reduced-motion — so motion preference is honoured in CSS only.
    el.scrollTo({ left: target, behavior: 'auto' });
  }, [slidePositions]);

  /* Step by one slide rather than one viewport: with multi-item strips a
     viewport step skips partially visible cards. */
  const step = useCallback((dir) => {
    const el = trackRef.current;
    if (!el) return;
    const positions = slidePositions();
    const here = el.scrollLeft;
    const next = dir > 0
      ? positions.find((p) => p > here + 4)
      : [...positions].reverse().find((p) => p < here - 4);
    el.scrollTo({ left: next === undefined ? (dir > 0 ? el.scrollWidth : 0) : next, behavior: 'auto' });
  }, [slidePositions]);

  /* Auto-advance — only while visible, unpaused, and motion is welcome. */
  useEffect(() => {
    if (!autoPlay || !overflowing || paused || count < 2) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const id = setInterval(() => {
      const el = trackRef.current;
      if (!el || document.hidden) return;
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 4) el.scrollTo({ left: 0, behavior: 'auto' });
      else step(1);
    }, interval);
    return () => clearInterval(id);
  }, [autoPlay, overflowing, paused, count, interval, step]);

  const holdFor = autoPlay
    ? {
        onMouseEnter: () => setPaused(true),
        onMouseLeave: () => setPaused(false),
        onFocusCapture: () => setPaused(true),
        onBlurCapture: () => setPaused(false),
        // resume after a swipe, otherwise the first touch stops autoplay for good
        onTouchStart: () => setPaused(true),
        onTouchEnd: () => setPaused(false),
        onTouchCancel: () => setPaused(false),
      }
    : {};

  return (
    <div
      className="pt-carousel"
      role="group"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      {...holdFor}
    >
      {/* The arrows live in here so they centre on the strip, not on the
          strip + dot row. */}
      <div className="pt-carousel-viewport">
        <div ref={trackRef} className={`pt-carousel-track ${trackClassName}`.trim()} style={trackStyle}>
          {children}
        </div>

        {overflowing && (
          <>
            <button
              type="button"
              className="pt-carousel-arrow prev"
              onClick={() => step(-1)}
              disabled={!canPrev}
              aria-label="Previous"
            >
              <Icon name="chevronLeft" size={19} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="pt-carousel-arrow next"
              onClick={() => step(1)}
              disabled={!canNext}
              aria-label="Next"
            >
              <Icon name="chevronRight" size={19} strokeWidth={2.4} />
            </button>
          </>
        )}
      </div>

      {overflowing && showDots && count > 1 && (
        <div className="pt-carousel-dots">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={`pt-carousel-dot${i === active ? ' active' : ''}`}
              onClick={() => scrollToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === active ? 'true' : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
