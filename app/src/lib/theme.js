/* ============================================================
   Shared theme + language layer for the Practest student SPA.
   ------------------------------------------------------------
   - Theme is stored on <html data-theme="dark|light"> and applied
     before first paint by the boot script in index.html. This module
     is the single source of truth at runtime and keeps localStorage +
     the cross-site cookie in sync (mirrors the original ThemeToggle).
   - Language is an EN / हिं toggle. The app has no i18n library yet, so
     `lang` is persisted and exposed for future wiring; strings stay
     English for now (see RESTYLE_NOTES.md — TODO i18n).
   - tint(hue, isDark) returns {c, bg, bd} for theme-aware icon tiles.

   Implemented as a tiny external store so any component can call
   useTheme() without threading a context provider through the tree.
   ============================================================ */

const THEME_KEY = 'practest-theme';

function readTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

let state = { theme: readTheme() };
const listeners = new Set();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}
function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}

export function setTheme(next) {
  const theme = next === 'light' ? 'light' : 'dark';
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
    // Cookie syncs the choice with the public marketing site (subdomain-wide in prod).
    const domain =
      typeof location !== 'undefined' && location.hostname.endsWith('practest.live')
        ? ';domain=.practest.live'
        : '';
    document.cookie = `practest_theme=${theme};path=/;max-age=31536000;SameSite=Lax${domain}`;
  } catch {
    /* private mode — theme still applies for this session */
  }
  state.theme = theme;
  emit();
}

export function toggleTheme() {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
}

/* ------------------------------------------------------------
   Theme-aware accent (icon) palette. Glyph colour + tile tint flip
   per theme so light mode is not washed out. Mirrors the mockup's TN.
   ------------------------------------------------------------ */
const TINTS = {
  gold: {
    dark: { c: '#FFC968', bg: 'rgba(245,166,35,.16)', bd: 'rgba(245,166,35,.3)' },
    light: { c: '#A85F00', bg: 'rgba(245,166,35,.2)', bd: 'rgba(168,95,0,.35)' },
  },
  blue: {
    dark: { c: '#8FB0FF', bg: 'rgba(59,111,246,.16)', bd: 'rgba(59,111,246,.3)' },
    light: { c: '#2450CC', bg: 'rgba(59,111,246,.14)', bd: 'rgba(36,80,204,.32)' },
  },
  violet: {
    dark: { c: '#B9A6FF', bg: 'rgba(139,92,246,.16)', bd: 'rgba(139,92,246,.3)' },
    light: { c: '#6A34DE', bg: 'rgba(139,92,246,.14)', bd: 'rgba(106,52,222,.32)' },
  },
  green: {
    dark: { c: '#3DDBA9', bg: 'rgba(18,185,129,.16)', bd: 'rgba(18,185,129,.3)' },
    light: { c: '#08805A', bg: 'rgba(18,185,129,.16)', bd: 'rgba(8,128,90,.32)' },
  },
  red: {
    dark: { c: '#FB8F92', bg: 'rgba(229,72,77,.16)', bd: 'rgba(229,72,77,.3)' },
    light: { c: '#CB2F37', bg: 'rgba(229,72,77,.13)', bd: 'rgba(203,47,55,.3)' },
  },
  sky: {
    dark: { c: '#7DD3FC', bg: 'rgba(14,165,233,.16)', bd: 'rgba(14,165,233,.3)' },
    light: { c: '#0A78B4', bg: 'rgba(14,165,233,.15)', bd: 'rgba(10,120,180,.3)' },
  },
  neutral: {
    dark: { c: '#C7D0E4', bg: 'rgba(255,255,255,.08)', bd: 'rgba(255,255,255,.14)' },
    light: { c: '#465065', bg: 'rgba(18,22,35,.07)', bd: 'rgba(18,22,35,.14)' },
  },
};

/**
 * tint(hue, isDark) → { c, bg, bd }
 *   c  — glyph / text colour
 *   bg — tile background tint
 *   bd — tile border
 */
export function tint(hue, isDark = true) {
  const t = TINTS[hue] || TINTS.neutral;
  return isDark ? t.dark : t.light;
}

export { TINTS };

/* React hook — subscribes to the store. */
import { useSyncExternalStore } from 'react';

export function useTheme() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isDark = snap.theme === 'dark';
  return {
    theme: snap.theme,
    isDark,
    setTheme,
    toggleTheme,
    /** convenience: tint bound to the current theme */
    tint: (hue) => tint(hue, isDark),
  };
}
