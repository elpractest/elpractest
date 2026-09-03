/* ============================================================
   READER STORE — display preferences + panel traffic control.
   ------------------------------------------------------------
   A tiny external store on useSyncExternalStore, exactly the shape
   `lib/theme.js` already uses. The app deliberately carries no state
   library and this does not introduce one: it is ~40 lines of module
   state, a listener set and a snapshot.

   Two jobs.

   1. DISPLAY PREFERENCES — page theme, zoom, fit, scroll mode, warmth,
      contrast, focus. Persisted to localStorage, because how a student
      likes to read is a property of their eyes and their screen, not of
      the booklet they happen to have open. They are NOT synced to the
      server for the same reason: a phone in bright sun and a laptop at
      midnight want different answers, and one syncing over the other is
      worse than neither.

   2. PANEL TRAFFIC CONTROL — one `activePanel` enum rather than a
      boolean per overlay. With five overlays and five booleans, two or
      three can stack on a 390px screen and the student has to dismiss
      them in whatever order they arrived. Mutual exclusion here is not
      "remember to close the other one", it is structural: a variable
      holds one value. Adding a sixth panel later cannot bring the bug
      back.

   Reading position, bookmarks and annotations are deliberately NOT here.
   Those are server state scoped to one material, they arrive with the
   material and they sync back — keeping them in a global singleton is
   how a second material opened in another tab ends up writing the
   first one's page number.
   ============================================================ */

import { useSyncExternalStore } from 'react';

const PREFS_KEY = 'practest-reader-prefs';

/** Panels are mutually exclusive: 'contents' | 'display' | 'search' | 'study' | 'progress' | null. */
const DEFAULT_PREFS = {
  /* 'day' | 'sepia' | 'night' — the PAGE's theme, separate from the app's.
     A student reading at night wants a dark page without flipping the
     whole app, and a sepia page is not something the app theme has. */
  pageTheme: 'day',
  /* Scale multiplier applied on top of the fit. 1 = the fit exactly. */
  zoom: 1,
  /* 'width' | 'page' — what the fit means before zoom is applied. */
  fit: 'width',
  /* 'continuous' (one long scroll) | 'paged' (one spread at a time). */
  scrollMode: 'continuous',
  /* 0–100. A warm overlay for night reading; 0 is off. */
  warmth: 0,
  /* 0.8–1.3 CSS contrast on the rendered page. */
  contrast: 1,
  /* 0.55–1 brightness, for reading in the dark without the page glaring. */
  brightness: 1,
  /* Hides every piece of chrome until the student asks for it back. */
  focusMode: false,
  /* Tucks the bottom bar to a pill so the page gets the whole screen. */
  barCollapsed: false,
};

function readPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    // Spread over the defaults rather than replacing them, so a preference
    // added in a later release does not come back undefined for anyone who
    // already has a stored blob.
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let state = {
  ...readPrefs(),
  activePanel: null,
  studyTab: 'notes', // 'notes' | 'vajini'
};

const listeners = new Set();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}

function persist() {
  try {
    const out = {};
    Object.keys(DEFAULT_PREFS).forEach((k) => { out[k] = state[k]; });
    localStorage.setItem(PREFS_KEY, JSON.stringify(out));
  } catch {
    /* private mode — the preference still applies for this session */
  }
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return state;
}

/** Set one or more display preferences. */
export function setPref(patch) {
  Object.assign(state, patch);
  persist();
  emit();
}

export function resetDisplay() {
  Object.assign(state, DEFAULT_PREFS);
  persist();
  emit();
}

/* ── Panels ──
   `open` and `toggle` are separate on purpose. The bottom bar is a set
   of toggle controls and reports aria-pressed, so its buttons must be
   able to un-press. "Ask Vajini about this passage" is a command, and a
   command that closed the panel it was asked to open would be a bug —
   so it calls openStudy, never toggle. Only the call site knows which
   it is, so the store offers both rather than guessing. */
export function openPanel(panel) {
  state.activePanel = panel;
  emit();
}

export function togglePanel(panel) {
  state.activePanel = state.activePanel === panel ? null : panel;
  emit();
}

export function closePanel() {
  state.activePanel = null;
  emit();
}

export function openStudy(tab) {
  state.activePanel = 'study';
  if (tab) state.studyTab = tab;
  emit();
}

export function setStudyTab(tab) {
  state.studyTab = tab;
  emit();
}

/* Entering focus mode closes whatever panel was open — focus mode means
   "nothing but the page", and a drawer left standing over it would be
   the one thing the mode exists to remove. `focusMode` is persisted;
   `activePanel` is not, so it is set directly rather than through
   setPref. */
export function toggleFocusMode() {
  const next = !state.focusMode;
  state.focusMode = next;
  if (next) state.activePanel = null;
  persist();
  emit();
}

export function useReader() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* ── Page themes ──
   Values, not classes, because the page surface is drawn with inline
   styles like the rest of the SPA. `ink` is the colour of the chrome
   that sits ON the page surface (the page-number chip), not of the PDF
   itself — a rendered PDF carries its own ink and we never recolour it.
   `mix` is a blend layer laid over the canvas: it is what turns a white
   scan sepia or dark without touching the pixels underneath, so text
   stays exactly as sharp as it rendered. */
export const PAGE_THEMES = {
  day: {
    label: 'Day',
    icon: 'sun',
    surface: '#5b6070',
    page: '#ffffff',
    ink: '#0e1220',
    mix: null,
  },
  sepia: {
    label: 'Sepia',
    icon: 'book-open',
    surface: '#8a7a5f',
    page: '#f8f0dd',
    ink: '#4a3f2b',
    mix: { color: '#f4e4c1', mode: 'multiply', opacity: 0.55 },
  },
  night: {
    label: 'Night',
    icon: 'moon',
    surface: '#0a0d16',
    page: '#161a26',
    ink: '#e7ebf5',
    // `difference` against white inverts the page while leaving colour
    // photographs recognisable, which a plain CSS `invert()` does not.
    mix: { color: '#ffffff', mode: 'difference', opacity: 1 },
  },
};
