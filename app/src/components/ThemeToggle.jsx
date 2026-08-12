import React from 'react';
import Icon from './Icon';
import { useTheme } from '../lib/theme';

/**
 * Floating day/night toggle. Rendered on surfaces that have no branded
 * header (auth pages, admin) — inside the student shell the header owns
 * the toggle. Backed by the shared theme store so every toggle stays in
 * sync; the boot script in index.html re-applies the choice on next load.
 */
export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const goingTo = isDark ? 'day' : 'night';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${goingTo} mode`}
      title={`Switch to ${goingTo} mode`}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={21} />
    </button>
  );
}
