import React, { useState } from 'react';
import Icon from './Icon';

/**
 * Floating day/night toggle, rendered once in App.jsx so it exists on
 * every page. Persists to localStorage; the boot script in index.html
 * re-applies the choice before first paint on the next visit.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  );

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('practest-theme', next);
    } catch (e) {
      // private mode — theme still applies for this session
    }
    setTheme(next);
  };

  const goingTo = theme === 'dark' ? 'day' : 'night';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${goingTo} mode`}
      title={`Switch to ${goingTo} mode`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={21} />
    </button>
  );
}
