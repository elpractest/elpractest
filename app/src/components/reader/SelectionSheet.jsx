import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import { HIGHLIGHT_SWATCHES, highlightLabel } from './palette';

/**
 * What appears the moment a student selects a passage.
 *
 * Two forms, and the breakpoint is not cosmetic. On a wide screen it is
 * a popover anchored to the selection, nudged to stay on screen. Below
 * 768px it becomes a sheet pinned to the bottom edge, because a toolbar
 * this wide anchored to a selection on a 390px screen has nowhere to go:
 * every nudge lands it on the sentence it is about. Pinned to the bottom
 * is the one placement that cannot cover the thing being acted on — and
 * since the sheet is then nowhere near the selection, it shows the
 * selected text back so the student can see what they are acting on.
 *
 * The breakpoint is watched, not read once, so rotating a tablet swaps
 * the form instead of leaving a desktop popover on a narrow screen.
 */
export default function SelectionSheet({
  selection,
  onHighlight,
  onNote,
  onListen,
  onAsk,
  onDismiss,
}) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [nudge, setNudge] = useState({ dx: 0, dy: 0 });
  const [copied, setCopied] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || compact || !selection) return;

    const margin = 10;
    const r = el.getBoundingClientRect();
    let dx = 0;
    let dy = 0;

    if (r.right > window.innerWidth - margin) dx = window.innerWidth - margin - r.right;
    if (r.left + dx < margin) dx = margin - r.left;

    // No room below the selection — flip above it rather than clamping
    // into (and covering) the text that was just selected.
    if (r.bottom > window.innerHeight - margin) {
      dy = -(r.height + (selection.anchor.bottom - selection.anchor.top) + 14);
    }
    if (r.top + dy < margin) dy = margin - r.top;

    setNudge({ dx, dy });
  }, [selection, compact]);

  useEffect(() => { setCopied(false); }, [selection?.text]);

  if (!selection) return null;

  const copy = () => {
    navigator.clipboard?.writeText(selection.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  };

  const shell = compact
    ? { position: 'fixed', left: 0, right: 0, bottom: 0 }
    : {
        position: 'fixed',
        top: selection.anchor.bottom + 10,
        left: selection.anchor.left,
        transform: `translate(${nudge.dx}px, ${nudge.dy}px)`,
      };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t('reader.selectionActions')}
      className={`rd-sel${compact ? ' is-sheet' : ''}`}
      style={shell}
      /* The sheet must not steal the selection it exists to act on:
         a mousedown inside it would collapse the range before the click
         handler ever runs. */
      onMouseDown={(e) => e.preventDefault()}
    >
      {compact && <p className="rd-sel-quote">{selection.text}</p>}

      <div className="rd-sel-row">
        {HIGHLIGHT_SWATCHES.map((s) => (
          <button
            key={s.value}
            type="button"
            className="rd-swatch"
            aria-label={t('reader.highlightIn', { colour: highlightLabel(s.value) })}
            title={highlightLabel(s.value)}
            onClick={() => onHighlight(s.value)}
          >
            <span style={{ background: s.light }} />
          </button>
        ))}

        <span className="rd-sel-div" />

        <button type="button" className="rd-sel-btn" onClick={onNote}>
          <Icon name="file-text" size={14} /> {t('reader.note')}
        </button>
        <button type="button" className="rd-sel-btn" onClick={copy}>
          <Icon name={copied ? 'check' : 'file'} size={14} /> {copied ? t('reader.copied') : t('reader.copy')}
        </button>
        <button type="button" className="rd-sel-btn" onClick={onListen}>
          <Icon name="mic" size={14} /> {t('reader.listen')}
        </button>
        <button type="button" className="rd-sel-btn is-ai" onClick={onAsk}>
          <Icon name="sparkles" size={14} /> {t('reader.askVajini')}
        </button>

        {compact && (
          <button
            type="button"
            className="rd-sel-btn rd-sel-dismiss"
            onClick={onDismiss}
            aria-label={t('reader.dismiss')}
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
