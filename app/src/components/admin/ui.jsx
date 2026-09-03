import React, { useEffect } from 'react';
import Icon from '../Icon';

/* ============================================================
   ADMIN UI KIT — the Signal console pattern in one place.
   ------------------------------------------------------------
   Every list screen in the console draws from these primitives, so
   the table, the toolbar, the empty state, the skeleton and the
   modal behave identically on all 14 screens. They are presentation
   only: nothing here fetches, mutates or validates.

   The table is a CSS grid rather than a <table> so a row can collapse
   into a stacked card on a phone without duplicating the markup.
   ============================================================ */

/* ---------- page heading ---------- */

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="adm-pagehead">
      <div style={{ minWidth: 0 }}>
        <h1 className="t-title" style={{ margin: 0, color: 'var(--tx)' }}>{title}</h1>
        {subtitle && (
          <p style={{ margin: '6px 0 0', font: '400 13.5px/1.55 var(--font-body)', color: 'var(--muted)', maxWidth: '70ch' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="adm-pagehead-actions">{children}</div>}
    </div>
  );
}

/* ---------- chips ---------- */

export function Chip({ active, queue, onClick, children, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`adm-chip${active ? ' active' : ''}${queue ? ' queue' : ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- toolbar above the header row ---------- */

export function Toolbar({ children, trailing }) {
  return (
    <div className="adm-toolbar">
      <div className="adm-toolbar-chips">{children}</div>
      {trailing && <div className="adm-toolbar-trailing">{trailing}</div>}
    </div>
  );
}

/* ---------- status + badges ---------- */

const TONES = {
  success: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  danger: { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  reward: { bg: 'var(--reward-bg)', fg: 'var(--reward-text)' },
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  ai: { bg: 'var(--ai-bg)', fg: 'var(--ai)' },
  neutral: { bg: 'var(--surf)', fg: 'var(--tx2)' },
};

/** Status is always a dot AND a word — never colour alone. */
export function StatusDot({ tone = 'neutral', children }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', font: '600 11.5px var(--font-body)', color: t.fg }}>
      <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.fg, flex: 'none' }} />
      {children}
    </span>
  );
}

export function Badge({ tone = 'neutral', mono = false, children, style }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: '7px',
        background: t.bg,
        color: t.fg,
        font: `600 11px ${mono ? 'var(--font-mono)' : 'var(--font-body)'}`,
        ...(mono ? { fontVariantNumeric: 'tabular-nums' } : null),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

const DIFFICULTY_TONE = { easy: 'success', medium: 'reward', hard: 'danger' };

export function DifficultyBadge({ value }) {
  if (!value) return null;
  const key = String(value).toLowerCase();
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return <Badge tone={DIFFICULTY_TONE[key] || 'neutral'}>{label}</Badge>;
}

/* ---------- numbers ---------- */

export function Num({ children, style }) {
  return (
    <span className="t-num" style={{ fontWeight: 600, ...style }}>
      {children}
    </span>
  );
}

/* ---------- table ---------- */

export function TableCard({ children, style }) {
  return (
    <div className="adm-tablecard" style={style}>
      {children}
    </div>
  );
}

/**
 * columns: [{ key, label, width, align, hideBelow }]
 *   width      any grid track ('1fr', '120px'…)
 *   hideBelow  'tablet' drops the column under 1024px so the tablet
 *              tier keeps to 4 columns, per the design system.
 */
export function Table({ columns, children, gridStyle }) {
  const template = columns.map((c) => c.width || '1fr').join(' ');
  return (
    <div className="adm-table" style={{ '--adm-cols': template, ...gridStyle }}>
      <div className="adm-thead" role="row">
        {columns.map((c) => (
          <div
            key={c.key}
            role="columnheader"
            className={`adm-th${c.hideBelow === 'tablet' ? ' hide-tablet' : ''}`}
            style={c.align === 'right' ? { textAlign: 'right' } : undefined}
          >
            {c.label}
          </div>
        ))}
      </div>
      <div className="adm-tbody">{children}</div>
    </div>
  );
}

export function Row({ selected, onClick, children, style }) {
  const interactive = typeof onClick === 'function';
  return (
    <div
      role="row"
      className={`adm-tr${selected ? ' selected' : ''}${interactive ? ' clickable' : ''}`}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter') onClick(e); } : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={style}
    >
      {children}
    </div>
  );
}

export function Cell({ label, align, hideBelow, children, style }) {
  return (
    <div
      role="cell"
      className={`adm-td${hideBelow === 'tablet' ? ' hide-tablet' : ''}`}
      data-label={label}
      style={{ ...(align === 'right' ? { justifyContent: 'flex-end', textAlign: 'right' } : null), ...style }}
    >
      <span className="adm-td-inner">{children}</span>
    </div>
  );
}

/** Primary text in a cell — 13.5px, ellipsised. */
export function CellTitle({ children, hindi }) {
  return (
    <span
      style={{
        display: 'block',
        font: `400 13.5px ${hindi ? 'var(--font-hindi)' : 'var(--font-body)'}`,
        color: 'var(--tx)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function CellSub({ children }) {
  return (
    <span
      style={{
        display: 'block',
        marginTop: '2px',
        font: '500 12px var(--font-body)',
        color: 'var(--muted)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/** Trailing chevron that opens the detail drawer / sheet. */
export function RowChevron({ onClick, label = 'Open details' }) {
  return (
    <button type="button" className="adm-rowaction" onClick={onClick} aria-label={label} title={label}>
      <Icon name="chevron-right" size={17} />
    </button>
  );
}

export function RowMenu({ onClick, label = 'More actions' }) {
  return (
    <button type="button" className="adm-rowaction" onClick={onClick} aria-label={label} title={label}>
      <Icon name="ellipsis" size={17} />
    </button>
  );
}

/* ---------- empty + loading ---------- */

export function EmptyState({ icon = 'search', message, action }) {
  return (
    <div className="adm-empty">
      <span className="adm-empty-tile">
        <Icon name={icon} size={24} />
      </span>
      <p className="adm-empty-msg">{message}</p>
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }) {
  return (
    <div style={{ padding: '8px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: '12px 16px' }}>
          <div className="skeleton" style={{ height: '28px', borderRadius: '9px' }} />
        </div>
      ))}
    </div>
  );
}

/* ---------- pagination ---------- */

export function Pagination({ page, lastPage, onPage }) {
  if (!lastPage || lastPage <= 1) return null;
  return (
    <div className="adm-pagination">
      <button type="button" className="btn-secondary adm-page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <Icon name="chevron-left" size={16} />
        Previous
      </button>
      <span style={{ font: '500 12.5px var(--font-body)', color: 'var(--muted)' }}>
        Page <Num>{page}</Num> of <Num>{lastPage}</Num>
      </span>
      <button
        type="button"
        className="btn-secondary adm-page-btn"
        disabled={page >= lastPage}
        onClick={() => onPage(page + 1)}
      >
        Next
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  );
}

/* ---------- forms ---------- */

export function Field({ label, error, hint, htmlFor, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      {label && (
        <label className={`form-label${error ? ' is-error' : ''}`} htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && !error && (
        <div style={{ marginTop: '6px', font: '400 11.5px/1.45 var(--font-body)', color: 'var(--muted)' }}>{hint}</div>
      )}
      {error && (
        <div className="form-error">
          <Icon name="alert" size={14} />
          {error}
        </div>
      )}
    </div>
  );
}

export function FormSection({ title, description, children }) {
  return (
    <section className="adm-formsection">
      {(title || description) && (
        <header style={{ marginBottom: '14px' }}>
          {title && <h3 className="t-heading" style={{ margin: 0, color: 'var(--tx)' }}>{title}</h3>}
          {description && (
            <p style={{ margin: '5px 0 0', font: '400 12.5px/1.55 var(--font-body)', color: 'var(--muted)', maxWidth: '70ch' }}>
              {description}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

export function FormGrid({ children, min = '220px' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`, gap: '14px' }}>
      {children}
    </div>
  );
}

/* ---------- modal / bottom sheet ---------- */

export function Modal({ open = true, title, description, onClose, footer, width = 560, children, danger }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="adm-overlay" onClick={onClose} role="presentation">
      <div
        className="adm-modal"
        style={{ maxWidth: `${width}px` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="adm-modal-handle" aria-hidden="true" />
        <header className="adm-modal-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="t-heading" style={{ margin: 0, color: danger ? 'var(--danger)' : 'var(--tx)' }}>{title}</h2>
            {description && (
              <p style={{ margin: '5px 0 0', font: '400 13px/1.5 var(--font-body)', color: 'var(--muted)' }}>{description}</p>
            )}
          </div>
          <button type="button" className="adm-rowaction" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="adm-modal-body">{children}</div>
        {footer && <footer className="adm-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/** Right-side detail drawer on desktop, bottom sheet on a phone. */
export function Drawer({ open = true, title, subtitle, onClose, footer, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="adm-overlay adm-overlay-drawer" onClick={onClose} role="presentation">
      <aside
        className="adm-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="adm-modal-handle" aria-hidden="true" />
        <header className="adm-modal-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="t-heading" style={{ margin: 0, color: 'var(--tx)' }}>{title}</h2>
            {subtitle && (
              <p style={{ margin: '5px 0 0', font: '400 12.5px/1.5 var(--font-body)', color: 'var(--muted)' }}>{subtitle}</p>
            )}
          </div>
          <button type="button" className="adm-rowaction" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="adm-drawer-body">{children}</div>
        {footer && <footer className="adm-modal-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

/* ---------- feedback bars ---------- */

export function Notice({ tone = 'primary', icon, children, onDismiss }) {
  const t = TONES[tone] || TONES.primary;
  const bd =
    tone === 'success'
      ? 'var(--success-border)'
      : tone === 'danger'
        ? 'var(--danger-border)'
        : tone === 'reward'
          ? 'var(--reward-border)'
          : 'var(--primary-border)';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        padding: '11px 14px',
        borderRadius: '13px',
        background: t.bg,
        border: `1px solid ${bd}`,
        color: t.fg,
        font: '500 12.5px/1.5 var(--font-body)',
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="notice-dismiss">
          <Icon name="x" size={15} />
        </button>
      )}
    </div>
  );
}

/* ---------- analytics ---------- */

/** A labelled track. Exactly one bar in a set should be `highlight`. */
export function MeterRow({ label, value, max = 100, suffix = '%', highlight }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span
        style={{
          width: '38%',
          minWidth: 0,
          font: '500 12.5px var(--font-body)',
          color: 'var(--tx2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: '8px', borderRadius: '99px', background: 'var(--line)', overflow: 'hidden' }}>
        <span
          style={{
            display: 'block',
            width: `${pct}%`,
            height: '100%',
            borderRadius: '99px',
            background: highlight ? 'var(--primary)' : 'var(--primary-soft)',
          }}
        />
      </span>
      <span className="t-num" style={{ width: '58px', textAlign: 'right', fontSize: '12.5px', color: 'var(--tx)' }}>
        {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}
        {suffix}
      </span>
    </div>
  );
}

export function StatCard({ icon, tone = 'primary', value, label, note, noteTone }) {
  const t = TONES[tone] || TONES.primary;
  const nt = noteTone ? TONES[noteTone] : null;
  return (
    <div className="adm-statcard">
      <span className="adm-statcard-tile" style={{ background: t.bg, color: t.fg }}>
        <Icon name={icon} size={21} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="t-num" style={{ fontSize: '26px', lineHeight: 1, color: 'var(--tx)' }}>{value}</div>
        <div className="t-overline" style={{ marginTop: '7px', letterSpacing: '.14em', color: 'var(--muted)' }}>{label}</div>
        {note && (
          <div style={{ marginTop: '5px', font: '500 11.5px var(--font-body)', color: nt ? nt.fg : 'var(--muted)' }}>{note}</div>
        )}
      </div>
    </div>
  );
}

export function StatGrid({ children }) {
  return <div className="adm-statgrid">{children}</div>;
}
