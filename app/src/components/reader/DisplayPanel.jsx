import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';
import { PAGE_THEMES, resetDisplay, setPref, toggleFocusMode } from '../../lib/readerStore';

/**
 * Aa — the right drawer: everything about how the page LOOKS.
 *
 * Labelled with two letters rather than a cog on purpose. A gear
 * promises account and privacy settings; what is behind this button is
 * type, tint and size, which is exactly what a reader expects "Aa" to
 * open.
 *
 * The page theme is separate from the app theme, and deliberately so: a
 * student reading at night wants a dark PAGE without flipping the whole
 * app into dark mode, and sepia is not something the app theme offers at
 * all. Every control here is stored on the device rather than synced,
 * because a phone in the sun and a laptop at midnight want different
 * answers and one overwriting the other is worse than neither.
 */
export default function DisplayPanel({ open, prefs, onClose, isPdfTall }) {
  const { t } = useTranslation();

  return (
    <aside
      className={`rd-panel rd-panel-right${open ? ' is-open' : ''}`}
      aria-label={t('reader.display')}
      aria-hidden={!open}
      inert={!open}
    >
      <header className="rd-panel-head">
        <h2 className="rd-panel-title">
          <Icon name="sliders-horizontal" size={18} /> {t('reader.display')}
        </h2>
        <button type="button" className="rd-icon-btn" onClick={onClose} aria-label={t('reader.close')}>
          <Icon name="x" size={18} />
        </button>
      </header>

      <div className="rd-panel-body rd-panel-body-pad">
        <Group label={t('reader.pageTheme')}>
          <div className="rd-seg">
            {Object.entries(PAGE_THEMES).map(([key, th]) => (
              <button
                key={key}
                type="button"
                className={`rd-seg-btn${prefs.pageTheme === key ? ' is-active' : ''}`}
                onClick={() => setPref({ pageTheme: key })}
                aria-pressed={prefs.pageTheme === key}
              >
                <Icon name={th.icon} size={15} />
                <span>{t(`reader.theme_${key}`)}</span>
              </button>
            ))}
          </div>
        </Group>

        <Group label={t('reader.zoom')}>
          <div className="rd-stepper">
            <button
              type="button"
              className="rd-icon-btn"
              onClick={() => setPref({ zoom: Math.max(0.5, +(prefs.zoom - 0.1).toFixed(2)) })}
              aria-label={t('reader.zoomOut')}
            >
              <Icon name="x" size={16} style={{ transform: 'rotate(45deg)' }} />
            </button>
            <span className="t-num rd-stepper-val">{Math.round(prefs.zoom * 100)}%</span>
            <button
              type="button"
              className="rd-icon-btn"
              onClick={() => setPref({ zoom: Math.min(4, +(prefs.zoom + 0.1).toFixed(2)) })}
              aria-label={t('reader.zoomIn')}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
          <div className="rd-seg rd-seg-sm">
            <button
              type="button"
              className={`rd-seg-btn${prefs.fit === 'width' ? ' is-active' : ''}`}
              onClick={() => setPref({ fit: 'width', zoom: 1 })}
            >
              {t('reader.fitWidth')}
            </button>
            <button
              type="button"
              className={`rd-seg-btn${prefs.fit === 'page' ? ' is-active' : ''}`}
              onClick={() => setPref({ fit: 'page', zoom: 1 })}
            >
              {t('reader.fitPage')}
            </button>
          </div>
        </Group>

        <Group label={t('reader.pageFlow')} hint={isPdfTall ? undefined : t('reader.pageFlowHint')}>
          <div className="rd-seg rd-seg-sm">
            <button
              type="button"
              className={`rd-seg-btn${prefs.scrollMode === 'continuous' ? ' is-active' : ''}`}
              onClick={() => setPref({ scrollMode: 'continuous' })}
            >
              {t('reader.scroll')}
            </button>
            <button
              type="button"
              className={`rd-seg-btn${prefs.scrollMode === 'paged' ? ' is-active' : ''}`}
              onClick={() => setPref({ scrollMode: 'paged' })}
            >
              {t('reader.paged')}
            </button>
          </div>
        </Group>

        <Group label={t('reader.brightness')}>
          <Slider
            min={0.5}
            max={1}
            step={0.05}
            value={prefs.brightness}
            onChange={(v) => setPref({ brightness: v })}
            display={`${Math.round(prefs.brightness * 100)}%`}
            aria={t('reader.brightness')}
          />
        </Group>

        <Group label={t('reader.contrast')}>
          <Slider
            min={0.8}
            max={1.4}
            step={0.05}
            value={prefs.contrast}
            onChange={(v) => setPref({ contrast: v })}
            display={`${prefs.contrast.toFixed(2)}×`}
            aria={t('reader.contrast')}
          />
        </Group>

        <Group label={t('reader.warmth')} hint={t('reader.warmthHint')}>
          <Slider
            min={0}
            max={100}
            step={5}
            value={prefs.warmth}
            onChange={(v) => setPref({ warmth: v })}
            display={`${prefs.warmth}%`}
            aria={t('reader.warmth')}
          />
        </Group>

        <label className="rd-switch">
          <span className="rd-switch-label">
            <Icon name="eye" size={16} /> {t('reader.focusMode')}
          </span>
          <input type="checkbox" checked={prefs.focusMode} onChange={toggleFocusMode} />
        </label>
        <p className="rd-hint">{t('reader.focusHint')}</p>

        <button type="button" className="btn-secondary rd-reset" onClick={resetDisplay}>
          <Icon name="refresh" size={15} /> {t('reader.resetDisplay')}
        </button>
      </div>
    </aside>
  );
}

function Group({ label, hint, children }) {
  return (
    <section className="rd-group">
      <h3 className="t-overline rd-group-label">{label}</h3>
      {children}
      {hint && <p className="rd-hint">{hint}</p>}
    </section>
  );
}

/* 12px labels at full opacity, not 10px uppercase at 0.7 — a reading
   app whose own controls are hard to read has picked the wrong fight. */
function Slider({ min, max, step, value, onChange, display, aria }) {
  return (
    <div className="rd-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={aria}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="t-num rd-slider-val">{display}</span>
    </div>
  );
}
