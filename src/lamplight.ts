// Day or evening. By the clock, evening runs 6 pm to 6 am; setLight()
// overrides that until the next 6 am / 6 pm. ?light=day or
// ?light=evening in the URL previews either one.

import { useEffect, useState } from 'react';

export type Light = 'day' | 'evening';

const KEY = 'browns.light.v1';
const listeners = new Set<() => void>();

function byClock(): Light {
  const h = new Date().getHours();
  return h >= 18 || h < 6 ? 'evening' : 'day';
}

/** The next 6 am or 6 pm, when the clock takes over again. */
function nextChange(): number {
  const d = new Date();
  const h = d.getHours();
  if (h >= 18) d.setDate(d.getDate() + 1);
  d.setHours(h >= 6 && h < 18 ? 18 : 6, 0, 0, 0);
  return d.getTime();
}

// Evening only for now. To bring back day by the clock, remove this line.
const ONLY: Light | null = 'evening';

function current(): Light {
  if (ONLY) return ONLY;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { light: Light; until: number } | null;
    if (saved && Date.now() < saved.until) return saved.light;
  } catch {
    /* no storage: follow the clock */
  }
  const forced = new URLSearchParams(location.search).get('light');
  if (forced === 'day' || forced === 'evening') return forced;
  return byClock();
}

function refresh() {
  const light = current();
  document.documentElement.dataset.light = light;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light === 'evening' ? '#29231b' : '#776550');
  listeners.forEach((f) => f());
}

/** Sets the light at startup, before anything renders, then rechecks each minute. */
export function applyLamplight() {
  refresh();
  setInterval(refresh, 60_000);
}

/** Flip the switch: holds until the clock's next change. */
export function setLight(light: Light) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ light, until: nextChange() }));
  } catch {
    /* private mode: this visit only */
  }
  const forced = new URL(location.href);
  if (forced.searchParams.has('light')) {
    forced.searchParams.delete('light');
    history.replaceState(history.state, '', forced);
  }
  refresh();
}

/** The current light; re-renders when it changes. */
export function useLamplight(): Light {
  const [light, set] = useState<Light>(current);
  useEffect(() => {
    const f = () => set(current());
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return light;
}
