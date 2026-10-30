// THE THEME. One look for the whole site, chosen by tapping the iris in the
// masthead: Light (the soft gray wall), Dark (the dark brown wall) or Office
// (our Black Watch plaid). Remembered on this device; ?theme=dark in the URL
// previews one without changing it.

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'office';

export const THEMES: { id: Theme; name: string; ground: string }[] = [
  { id: 'light', name: 'LIGHT', ground: '#8f9186' },
  { id: 'dark', name: 'DARK', ground: '#29231b' },
  { id: 'office', name: 'OFFICE', ground: '#2c4d3e' },
];

const KEY = 'browns.theme.v1';
const listeners = new Set<() => void>();
const isTheme = (v: unknown): v is Theme => THEMES.some((t) => t.id === v);

function current(): Theme {
  const forced = new URLSearchParams(location.search).get('theme');
  if (isTheme(forced)) return forced;
  try {
    const saved = localStorage.getItem(KEY);
    if (isTheme(saved)) return saved;
  } catch {
    /* no storage: the default */
  }
  return 'light';
}

function apply() {
  const theme = current();
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES.find((t) => t.id === theme)!.ground);
  listeners.forEach((f) => f());
}

/** Sets the theme at startup, before anything renders. */
export function applyTheme() {
  apply();
}

/** Moves on to the next theme, and remembers it. */
export function nextTheme(): Theme {
  const i = THEMES.findIndex((t) => t.id === current());
  const next = THEMES[(i + 1) % THEMES.length].id;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode: this visit only */
  }
  // a preview in the URL would otherwise win over the choice
  const url = new URL(location.href);
  if (url.searchParams.has('theme')) {
    url.searchParams.delete('theme');
    history.replaceState(history.state, '', url);
  }
  apply();
  return next;
}

/** The current theme; re-renders when it changes. */
export function useTheme(): Theme {
  const [theme, set] = useState<Theme>(current);
  useEffect(() => {
    const f = () => set(current());
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return theme;
}
