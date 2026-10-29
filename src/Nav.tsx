import { useCallback, useEffect, useRef, useState } from 'react';

export const TABS = [
  { id: 'investments', label: 'INVESTMENTS' },
  { id: 'projects', label: 'PROJECTS' },
  { id: 'servicing', label: 'SERVICING' },
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
 * The site's pages behind a menu button in the masthead: tap it and the pages
 * drop down as a stack on a small card, the one you're in marked with the
 * room's dot. Closes on a choice, a tap elsewhere or Escape; arrow keys move
 * through the list. More pages are just more entries in TABS.
 */
export function SiteMenu({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = TABS.find((t) => t.id === tab)!;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    // start on the page you're in, so arrows and Enter work straight away
    wrap.current?.querySelector<HTMLButtonElement>('.site-menu-list .on')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onListKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll('button')];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  };

  return (
    <div className="site-menu" ref={wrap}>
      <button
        ref={button}
        className={`site-menu-button ${open ? 'is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu: ${current.label.toLowerCase()}`}
        onClick={() => setOpen(!open)}
      >
        {/* three lines that fold into a cross while the menu is open */}
        <span aria-hidden />
        <span aria-hidden />
        <span aria-hidden />
      </button>
      {open && (
        <div className="site-menu-list" role="menu" aria-label="Pages" onKeyDown={onListKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              role="menuitem"
              className={t.id === tab ? 'on' : ''}
              aria-current={t.id === tab ? 'page' : undefined}
              onClick={() => {
                setOpen(false);
                onChange(t.id);
              }}
            >
              <span className="site-menu-dot" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
