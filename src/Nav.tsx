import { useCallback, useEffect, useRef, useState } from 'react';

export const TABS = [
  { id: 'investments', label: 'Investments' },
  { id: 'projects', label: 'Projects' },
  { id: 'servicing', label: 'Servicing' },
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
 * A page's left column, with the site's menu at its head: the three-line icon
 * swaps the column for the list of pages (the whole slab on a phone), at the
 * height the column had, the page you're in marked with the room's dot;
 * picking one goes there. More pages are just more entries in TABS.
 */
export function PagedSidebar({ className, tab, children }: { className: string; tab: TabId; children: React.ReactNode }) {
  const [open, setOpen] = useState<number | null>(null); // the column's height when the menu opened
  const nav = useRef<HTMLElement>(null);
  return (
    <nav ref={nav} className={`${className} ${open != null ? 'pages-open' : ''}`} style={open != null ? { height: open } : undefined}>
      <button
        className="pages-toggle"
        aria-expanded={open != null}
        aria-label={open != null ? 'Close the menu' : 'Menu'}
        onClick={() => setOpen(open != null ? null : nav.current?.offsetHeight ?? null)}
      >
        <span className="pages-icon" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </button>
      {open != null ? (
        <div className="pages-list" role="menu" aria-label="Pages">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="menuitem"
              className={`side-row pages-row ${t.id === tab ? 'is-sel' : ''}`}
              aria-current={t.id === tab ? 'page' : undefined}
              onClick={() => {
                setOpen(null);
                if (t.id !== tab) {
                  location.hash = `/${t.id}`;
                  window.scrollTo(0, 0);
                }
              }}
            >
              <span className="side-caret" aria-hidden />
              <span className="side-name page-name">{t.label}</span>
            </button>
          ))}
        </div>
      ) : (
        children
      )}
    </nav>
  );
}
