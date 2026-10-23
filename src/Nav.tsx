import { useCallback, useEffect, useState } from 'react';

export const TABS = [
  { id: 'investments', label: 'INVESTMENTS' },
  { id: 'projects', label: 'PROJECTS' },
  { id: 'ask', label: 'ASK THE POLICY' },
] as const;

/** Line icons for the tab bar, drawn on a 20×20 grid. */
const ICONS: Record<TabId, JSX.Element> = {
  // a rising line on an axis
  investments: (
    <>
      <path d="M3 3v14h14" />
      <path d="M6 13l3.5-4 3 2.5L17 6" />
    </>
  ),
  // a house
  projects: (
    <>
      <path d="M3 9.5L10 3.5l7 6" />
      <path d="M5 8v8.5h10V8" />
      <path d="M8.5 16.5v-4.5h3v4.5" />
    </>
  ),
  // a speech bubble
  ask: (
    <>
      <path d="M3.5 4.5h13v9h-7l-4 3v-3h-2z" />
      <path d="M7 7.75h6M7 10.25h4" />
    </>
  ),
};

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

export function NavBar({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'is-sel' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            aria-label={t.label}
            title={t.label}
            onClick={() => onChange(t.id)}
          >
            <svg className="tab-icon" viewBox="0 0 20 20" aria-hidden>
              {ICONS[t.id]}
            </svg>
            <span className="tab-label" aria-hidden>
              <span className="tab-name">{t.label}</span>
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
