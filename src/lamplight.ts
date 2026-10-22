// Evening mode: from 6 pm to 6 am the site switches to its lamplight palette
// (styles.css, :root[data-light='evening']). Add ?light=day or ?light=evening
// to the URL to preview either one.

import { useEffect, useState } from 'react';

export type Light = 'day' | 'evening';

function current(): Light {
  const forced = new URLSearchParams(location.search).get('light');
  if (forced === 'day' || forced === 'evening') return forced;
  const h = new Date().getHours();
  return h >= 18 || h < 6 ? 'evening' : 'day';
}

function apply(light: Light) {
  document.documentElement.dataset.light = light;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light === 'evening' ? '#29231b' : '#6a6349');
}

/** Sets the light once at startup, before anything renders (the PIN pad included). */
export function applyLamplight() {
  apply(current());
}

/** The current light, rechecked each minute; also sets it on <html>. */
export function useLamplight(): Light {
  const [light, setLight] = useState<Light>(current);
  useEffect(() => {
    // set <html> before re-rendering, so the chart redraws with the new colours
    const t = setInterval(() => {
      const next = current();
      apply(next);
      setLight(next);
    }, 60_000);
    return () => clearInterval(t);
  }, []);
  return light;
}
