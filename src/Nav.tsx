import { useCallback, useEffect, useRef, useState } from 'react';

export const TABS = [
  { id: 'investments', label: 'INVESTMENTS' },
  { id: 'projects', label: 'PROJECTS' },
  { id: 'ask', label: 'POLICY' },
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
 * The masthead title doubles as the site's navigation: "INVESTMENTS of THE
 * BROWNS", where the first line opens a menu of the other sections.
 */
export function SectionMenu({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = TABS.find((t) => t.id === tab)!;
  const others = TABS.filter((t) => t.id !== tab);

  // close on a click outside or Escape
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
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // up / down move between the choices
  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(e.currentTarget.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  };

  return (
    <div className="section-menu" ref={wrap}>
      <button
        ref={button}
        className={`mast-title section-current ${open ? 'is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
            setTimeout(() => wrap.current?.querySelector<HTMLButtonElement>('.section-menu-list button')?.focus(), 0);
          }
        }}
      >
        {current.label}
        <span className="section-caret" aria-hidden />
      </button>
      {/* the other sections unfold as rows beneath, pushing "of THE BROWNS" down */}
      <div className={`section-menu-fold ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="section-menu-list" role="menu" aria-label="Sections" onKeyDown={onMenuKey}>
          {others.map((t) => (
            <button
              key={t.id}
              role="menuitem"
              className="mast-title"
              tabIndex={open ? 0 : -1}
              onClick={() => {
                setOpen(false);
                onChange(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
