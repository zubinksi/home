import { useCallback, useEffect, useState } from 'react';

export const TABS = [
  { id: 'investments', label: 'INVESTMENTS' },
  { id: 'projects', label: 'PROJECTS' },
  // { id: 'ask', label: 'POLICY' }, // off for now; the page lives in src/Ask.tsx
] as const;

export type TabId = (typeof TABS)[number]['id'];

/** `#/tab/sub`: the tab, plus an optional open detail page within it (phones only). */
export interface Route {
  tab: TabId;
  sub: string | null;
}

function parse(): Route {
  const [t, sub] = location.hash.replace(/^#\/?/, '').split('/');
  const tab = TABS.some((x) => x.id === t) ? (t as TabId) : 'investments';
  return { tab, sub: sub || null };
}

/**
 * Where we are, kept in the URL hash so refresh, Back and the phone's back
 * gesture all keep your place. Detail pages opened from the list are pushed
 * with a marker, so "back" can pop them instead of adding history.
 */
export function useRoute() {
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    const sync = () => setRoute(parse());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const goTab = useCallback((t: TabId) => {
    const r = parse();
    if (t === r.tab && !r.sub) return;
    location.hash = `/${t}`;
    window.scrollTo(0, 0);
  }, []);

  const openSub = useCallback((sub: string) => {
    history.pushState({ fromList: true }, '', `#/${parse().tab}/${sub}`);
    setRoute(parse());
  }, []);

  const replaceSub = useCallback((sub: string) => {
    history.replaceState(history.state, '', `#/${parse().tab}/${sub}`);
    setRoute(parse());
  }, []);

  const closeSub = useCallback(() => {
    if (history.state?.fromList) history.back();
    else {
      history.replaceState(null, '', `#/${parse().tab}`);
      setRoute(parse());
    }
  }, []);

  return { route, goTab, openSub, replaceSub, closeSub };
}

/** True below the phone breakpoint used throughout styles.css. */
export function useNarrow(query = '(max-width: 860px)') {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return narrow;
}

/**
 * The iris is the site's navigation: tapping it turns the flower and flips
 * the title between "INVESTMENTS of THE BROWNS" and "PROJECTS of THE BROWNS".
 */
export function IrisSwitch({ tab, onChange, icon }: { tab: TabId; onChange: (t: TabId) => void; icon: string }) {
  const [turns, setTurns] = useState(0);
  const other = TABS.find((t) => t.id !== tab)!;
  return (
    <button
      className="mast-iris-btn"
      aria-label={`Go to ${other.label.toLowerCase()}`}
      title={other.label}
      onClick={() => {
        setTurns((n) => n + 1);
        onChange(other.id);
      }}
    >
      <span
        className="mast-iris"
        style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})`, ['--turns' as string]: turns }}
        aria-hidden
      />
    </button>
  );
}

/** The page's name, rolling in from below whenever it changes. */
export function SectionTitle({ tab }: { tab: TabId }) {
  return (
    <div className="mast-title section-title" aria-live="polite">
      <span key={tab}>{TABS.find((t) => t.id === tab)!.label}</span>
    </div>
  );
}
