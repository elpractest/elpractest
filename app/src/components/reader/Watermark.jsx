import React, { useMemo } from 'react';

/**
 * A faint, tiled watermark carrying the reader's own identity.
 *
 * This is not DRM and does not pretend to be — anything rendered in a
 * browser can be captured. What it does is make a leaked screenshot
 * traceable, which is the realistic deterrent for paid course material:
 * the person who shares it knows their own name is on every frame.
 *
 * Deliberately cheap and deliberately unobtrusive: one absolutely
 * positioned layer, pointer-events off, at an opacity that survives a
 * screenshot but does not fight the text. Rotated so it crosses lines
 * rather than sitting between them, which is what makes it awkward to
 * crop out.
 */
export default function Watermark({ name, email }) {
  const label = useMemo(
    () => [name, email].filter(Boolean).join(' · '),
    [name, email],
  );

  if (!label) return null;

  return (
    <div className="rd-watermark" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i}>{label}</span>
      ))}
    </div>
  );
}
