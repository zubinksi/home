// THE WEATHER AT THE DOOR. Washington, DC's current temperature and sky, from
// Open-Meteo (free, no key), refreshed every quarter hour and kept for the
// visit. The PIN pad shows it in the corner and the sunlight follows it.
// ?weather=clear|partly|overcast|rain|snow|night previews a sky.

import { useEffect, useState } from 'react';

export type Sky = 'clear' | 'partly' | 'overcast' | 'rain' | 'snow' | 'storm' | 'night';

export interface Weather {
  temp: number | null; // °F
  sky: Sky;
  word: string; // as the corner says it: "Clear", "Overcast"…
}

const URL_ =
  'https://api.open-meteo.com/v1/forecast?latitude=38.9072&longitude=-77.0369' +
  '&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=America%2FNew_York';
const KEY = 'browns.weather.v1';
const FRESH_MS = 15 * 60_000;

const WORDS: Record<Sky, string> = {
  clear: 'Clear',
  partly: 'Partly cloudy',
  overcast: 'Overcast',
  rain: 'Rain',
  snow: 'Snow',
  storm: 'Storms',
  night: 'Clear night',
};

/** WMO weather codes, as Open-Meteo gives them, to our few skies. */
function skyOf(code: number, isDay: boolean): Sky {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 3 || code === 45 || code === 48) return 'overcast';
  if (!isDay) return 'night';
  return code === 2 ? 'partly' : 'clear';
}

function preview(): Weather | null {
  const v = new URLSearchParams(location.search).get('weather') as Sky | null;
  if (!v || !(v in WORDS)) return null;
  const temps: Record<Sky, number> = { clear: 68, partly: 61, overcast: 54, rain: 49, snow: 29, storm: 72, night: 47 };
  return { temp: temps[v], sky: v, word: WORDS[v] };
}

function saved(): (Weather & { at: number }) | null {
  try {
    const w = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    return w && Date.now() - w.at < FRESH_MS ? w : null;
  } catch {
    return null;
  }
}

async function fetchWeather(): Promise<Weather | null> {
  try {
    const r = await fetch(URL_);
    if (!r.ok) return null;
    const c = (await r.json())?.current;
    if (!c) return null;
    const sky = skyOf(Number(c.weather_code), c.is_day === 1);
    const w: Weather = { temp: Math.round(Number(c.temperature_2m)), sky, word: WORDS[sky] };
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ ...w, at: Date.now() }));
    } catch {
      /* fine */
    }
    return w;
  } catch {
    return null;
  }
}

/** DC's weather now, or null until it's known (or if it can't be reached). */
export function useWeather(): Weather | null {
  const [w, setW] = useState<Weather | null>(() => preview() ?? saved());
  useEffect(() => {
    if (preview()) return;
    let live = true;
    const get = () => fetchWeather().then((x) => live && x && setW(x));
    if (!saved()) get();
    const id = setInterval(get, FRESH_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  return w;
}

/** The time now, ticking each second, on the second. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      id = setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    id = setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => clearTimeout(id);
  }, []);
  return now;
}
