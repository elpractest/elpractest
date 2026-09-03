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
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
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
  const theme = next === 'dark' ? 'dark' : 'light';
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
  /* gold is the REWARD hue only — streaks, badges, rank-ups. Never a nav
     state, never a button. Everything that used to be "gold as brand" now
     asks for `blue`, which is the Signal ultramarine primary. */
  gold: {
    dark: { c: '#F0B451', bg: 'rgba(240,180,81,.13)', bd: 'rgba(240,180,81,.34)' },
    light: { c: '#96601A', bg: '#FDF3E2', bd: '#F0D9AC' },
  },
  blue: {
    dark: { c: '#7C8CFF', bg: 'rgba(124,140,255,.14)', bd: 'rgba(124,140,255,.34)' },
    light: { c: '#2E3FCC', bg: '#EAECFD', bd: '#C9CFFA' },
  },
  violet: {
    dark: { c: '#A98BFF', bg: 'rgba(169,139,255,.14)', bd: 'rgba(169,139,255,.32)' },
    light: { c: '#6134C9', bg: '#EFEAFB', bd: '#DACEF6' },
  },
  green: {
    dark: { c: '#26E0A6', bg: 'rgba(38,224,166,.13)', bd: 'rgba(38,224,166,.32)' },
    light: { c: '#0E7C5A', bg: '#E5F2EC', bd: '#BFE0D2' },
  },
  red: {
    dark: { c: '#FF7B7B', bg: 'rgba(255,123,123,.13)', bd: 'rgba(255,123,123,.32)' },
    light: { c: '#C42B2B', bg: '#FCECEB', bd: '#F2C9C7' },
  },
  sky: {
    dark: { c: '#8FC7FF', bg: 'rgba(96,165,250,.14)', bd: 'rgba(96,165,250,.3)' },
    light: { c: '#1D5FA8', bg: '#E7F0FB', bd: '#C6DCF3' },
  },
  neutral: {
    dark: { c: '#C0C7D8', bg: 'rgba(255,255,255,.06)', bd: 'rgba(255,255,255,.12)' },
    light: { c: '#3A425A', bg: '#F2F4F9', bd: '#E1E5EF' },
  },
};

/**
 * tint(hue, isDark) → { c, bg, bd }
 *   c  — glyph / text colour
 *   bg — tile background tint
 *   bd — tile border
 */
export function tint(hue, isDark = false) {
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
