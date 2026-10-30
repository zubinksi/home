import { useEffect, useMemo, useRef, useState } from 'react';
import snapshotCsv from './assets/projects-snapshot.csv?raw';
import { MobileNav } from './MobileNav';
import { PagedSidebar } from './Nav';
import { compact } from './model';
import { areaStats, parseCsv, parseProjects, totals, type Area, type ProjectItem } from './projectsModel';
import { PROJECTS_SHEET_DIRECT_URL, PROJECTS_SHEET_URL } from './projectsSource';
import { useDrill } from './useDrill';

const SORT_KEY = 'browns.projects.sort.v1';

type SortMode = 'listed' | 'spend';

function loadSort(): SortMode {
  try {
    return localStorage.getItem(SORT_KEY) === 'spend' ? 'spend' : 'listed';
  } catch {
    return 'listed';
  }
}
const money = (n: number) => `$${compact(n)}`;

const SECTION_NAMES = { house: 'MOVE + MAINTENANCE', rooms: 'FURNISHING' } as const;

/** The detail key for the list of everything still to do. */
const TODO_KEY = 'to-do';
/** The detail key for the summary of everything, the page's default. */
const ALL_KEY = 'all';

type Source =
  | { kind: 'saved' }
  | { kind: 'live'; at: number; via: 'server' | 'browser' }
  | { kind: 'error'; message: string; hint: string };

type Got = { csv: string; at: number } | { problem: string };

/** Ask this site's server, which fetches the sheet on our behalf. */
async function viaServer(): Promise<Got> {
  try {
    const res = await fetch('/api/projects');
    if (!(res.headers.get('content-type') ?? '').includes('json')) return { problem: 'no-server' };
    const data = await res.json();
    if (res.ok && data?.csv) return { csv: data.csv, at: data.fetchedAt ?? Date.now() };
    return { problem: data?.message ?? `Server error ${res.status}` };
  } catch {
    return { problem: 'no-server' };
  }
}

/** Read the sheet straight from Google in the browser (works without the server). */
async function viaBrowser(): Promise<Got> {
  try {
    const res = await fetch(PROJECTS_SHEET_DIRECT_URL);
    const text = await res.text();
    if (!res.ok || /<html/i.test(text.slice(0, 500))) return { problem: 'not-shared' };
    return { csv: text, at: Date.now() };
  } catch {
    return { problem: 'blocked' };
  }
}

/** Starts from the saved copy, then swaps in the live sheet when it arrives. */
function useProjects() {
  const saved = useMemo(() => parseProjects(parseCsv(snapshotCsv)), []);
  const [areas, setAreas] = useState<Area[]>(saved);
  const [source, setSource] = useState<Source>({ kind: 'saved' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const use = (got: Got, via: 'server' | 'browser') => {
        if (!('csv' in got)) return false;
        const live = parseProjects(parseCsv(got.csv));
        if (!live.length) return false;
        if (!cancelled) {
          setAreas(live);
          setSource({ kind: 'live', at: got.at, via });
        }
        return true;
      };
      const server = await viaServer();
      if (use(server, 'server')) return;
      const browser = await viaBrowser();
      if (use(browser, 'browser')) return;
      if (cancelled) return;
      console.warn('[projects] server:', 'problem' in server ? server.problem : 'ok', '· browser:', 'problem' in browser ? browser.problem : 'ok');
      const notShared = 'problem' in browser && browser.problem === 'not-shared';
      setSource({
        kind: 'error',
        message: notShared ? 'The sheet isn’t shared by link' : 'Couldn’t reach the sheet',
        hint: notShared
          ? 'In Google Sheets: Share → General access → Anyone with the link → Viewer.'
          : 'problem' in server && server.problem === 'no-server'
            ? 'Restart the site (npm run dev) so its sheet reader is running, and check the sheet is shared by link.'
            : 'Check the sheet is shared “Anyone with the link · Viewer”.',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { areas, source };
}

export function Projects(props: {
  narrow: boolean;
  sub: string | null;
  openSub: (k: string) => void;
  replaceSub: (k: string) => void;
  closeSub: () => void;
}) {
  const { areas, source } = useProjects();
  const [sort, setSort] = useState<SortMode>(loadSort);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SORT_KEY, sort);
    } catch {
      /* fine */
    }
  }, [sort]);

  // as listed: the sheet's order, house first then rooms; by spend: one list, highest first
  const house = areas.filter((a) => a.section === 'house');
  const rooms = areas.filter((a) => a.section === 'rooms');
  const ordered =
    sort === 'spend'
      ? [...areas].sort((x, y) => areaStats(y).spent - areaStats(x).spent)
      : [...house, ...rooms];

  const sequence = ordered.map((a) => a.key);
  const drill = useDrill({
    narrow: props.narrow,
    sub: props.sub,
    keys: [ALL_KEY, ...sequence, TODO_KEY],
    sequence,
    defaultKey: ALL_KEY,
    openSub: props.openSub,
    replaceSub: props.replaceSub,
    closeSub: props.closeSub,
    panelRef,
  });

  const t = totals(areas);
  // on wide screens an area is always showing: the chosen one, else the first in order
  const showTodo = drill.selKey === TODO_KEY;
  // on wide screens something always shows: the chosen area, the to-do list, else the summary
  const activeKey = sequence.includes(drill.selKey) ? drill.selKey : '';
  const showAll = !showTodo && !activeKey;
  const area = areas.find((a) => a.key === activeKey) ?? null;

  // a section's name with what its areas have spent, in the amount column
  const section = (name: string, list: Area[]) => (
    <div className="label side-section proj-section">
      <span>{name}</span>
      <span>{compact(list.reduce((t, a) => t + areaStats(a).spent, 0))}</span>
    </div>
  );

  const row = (a: Area) => {
    const s = areaStats(a);
    return (
      <button
        key={a.key}
        className={`side-row proj-row ${!props.narrow && activeKey === a.key ? 'is-sel' : ''}`}
        onClick={() => drill.select(a.key)}
      >
        <span className="side-caret" aria-hidden />
        <span className="side-name">{a.name}</span>
        <span className="side-bar" title={`${s.done} of ${s.total} done`}>
          <span style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }} />
        </span>
        <span className="side-pct">
          {s.done}/{s.total}
        </span>
        <span className="side-amt">{s.spent ? compact(s.spent) : '—'}</span>
      </button>
    );
  };

  return (
    <main className="body">
      <section className="slab sleeves projects" ref={panelRef}>
        <div className={`sleeves-grid ${drill.gridClass}`}>
          {drill.showList && (
            <PagedSidebar className={`sidebar ${drill.listClass}`} tab="projects">
              <button className={`side-row total ${!props.narrow && showAll ? 'is-sel' : ''}`} onClick={() => drill.select(ALL_KEY)}>
                <span className="side-caret" aria-hidden />
                <span className="side-name page-name">Projects</span>
                <span />
                <span className="side-amt">{compact(t.spent)}</span>
              </button>
              <div className="side-sub">
                {t.done} OF {t.items} DONE ·{' '}
                <button className="todo-link" onClick={() => drill.select(TODO_KEY)}>
                  {t.openNeeded} TO DO
                </button>
              </div>
              <div className="side-rule" />

              <div className="proj-sortbar">
                <span className="label">{sort === 'spend' ? 'BY SPEND' : ''}</span>
                <button
                  className={`proj-sort ${sort === 'spend' ? 'on' : ''}`}
                  onClick={() => setSort(sort === 'spend' ? 'listed' : 'spend')}
                  aria-label={sort === 'spend' ? 'Sorted by highest spend. Switch to sheet order' : 'In sheet order. Sort by highest spend'}
                  title={sort === 'spend' ? 'Sorted by highest spend' : 'Sort by highest spend'}
                >
                  <svg viewBox="0 0 16 14" width="16" height="14" aria-hidden>
                    <path d="M1 2h14M1 7h9M1 12h4" />
                  </svg>
                  {sort === 'spend' ? 'SPEND' : 'LISTED'}
                </button>
              </div>
              {sort === 'spend' ? (
                ordered.map(row)
              ) : (
                <>
                  {section(SECTION_NAMES.house, house)}
                  {house.map(row)}
                  {section(SECTION_NAMES.rooms, rooms)}
                  {rooms.map(row)}
                </>
              )}

              <div className="proj-foot">
                <div className="proj-foot-row">
                  <div className={`proj-source ${source.kind}`}>
                    {source.kind === 'live' &&
                      `LIVE · ${new Date(source.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase()}`}
                    {source.kind === 'saved' && 'LOADING THE SHEET…'}
                    {source.kind === 'error' && `SAVED COPY · ${source.message.toUpperCase()}`}
                  </div>
                  <a className="proj-sheet" href={PROJECTS_SHEET_URL} target="_blank" rel="noreferrer">
                    OPEN THE SHEET <span aria-hidden>↗</span>
                  </a>
                </div>
                {source.kind === 'error' && <div className="proj-hint">{source.hint}</div>}
              </div>
            </PagedSidebar>
          )}

          {drill.showDetail && (
            <div key={drill.detailKey} className={`detail ${drill.detailClass}`} {...drill.touchHandlers}>
              {props.narrow && <MobileNav onBack={drill.back} />}
              {showTodo ? (
                <TodoDetail areas={ordered} onArea={(k) => drill.select(k)} />
              ) : area ? (
                <AreaDetail area={area} />
              ) : (
                <ProjectsSummary house={house} rooms={rooms} onArea={(k) => drill.select(k)} onTodo={() => drill.select(TODO_KEY)} />
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/**
 * The whole house at a glance, as the Total is for Investments: what's been
 * spent and on what, how far along it is, where nothing's started yet, and
 * the biggest single costs.
 */
function ProjectsSummary(props: { house: Area[]; rooms: Area[]; onArea: (key: string) => void; onTodo: () => void }) {
  const all = [...props.house, ...props.rooms];
  const t = totals(all);
  const spent = (list: Area[]) => list.reduce((s, a) => s + areaStats(a).spent, 0);
  const sections = [
    { name: SECTION_NAMES.house, spent: spent(props.house) },
    { name: SECTION_NAMES.rooms, spent: spent(props.rooms) },
  ];
  const doneShare = t.items ? t.done / t.items : 0;
  const untouched = all.filter((a) => {
    const s = areaStats(a);
    return s.total > 0 && s.done === 0;
  });
  const biggest = all
    .flatMap((a) => a.items.filter((i) => i.done && !i.closed && (i.cost ?? 0) > 0).map((item) => ({ item, area: a })))
    .sort((x, y) => (y.item.cost ?? 0) - (x.item.cost ?? 0))
    .slice(0, 3);

  return (
    <>
      <div className="d-title">
        <span className="d-name proj-name page-name">Projects</span>
        <span className="d-amt">{money(t.spent)}</span>
      </div>
      <div className="d-sub">
        <span className="d-alloc" style={{ color: t.done === t.items ? 'var(--green)' : 'var(--amber)' }}>
          {t.done} OF {t.items} DONE · {Math.round(doneShare * 100)}%
        </span>
      </div>

      <div className="module">
        <div className="module-head">
          <span className="label">SPENT</span>
        </div>
        {sections.map((x) => (
          <div key={x.name} className="psum-row">
            <span className="psum-name">{x.name}</span>
            <span className="psum-amt">{money(x.spent)}</span>
            <span className="psum-pct">{t.spent ? Math.round((x.spent / t.spent) * 100) : 0}%</span>
            <span className="psum-bar">
              <span style={{ width: `${t.spent ? (x.spent / t.spent) * 100 : 0}%` }} />
            </span>
          </div>
        ))}
      </div>

      <div className="module">
        <div className="module-head">
          <span className="label">PROGRESS</span>
          <button className="label psum-link" onClick={props.onTodo}>
            SEE WHAT’S LEFT →
          </button>
        </div>
        <div className="psum-progress">
          <span style={{ width: `${doneShare * 100}%` }} />
        </div>
        <div className="psum-counts">
          <span>
            <b>{t.done}</b> DONE
          </span>
          <span>
            <b>{t.openNeeded}</b> NEEDED
          </span>
          <span>
            <b>{t.openOptional}</b> OPTIONAL
          </span>
        </div>
      </div>

      {biggest.length > 0 && (
        <div className="module">
          <div className="module-head">
            <span className="label">BIGGEST SPENDS</span>
          </div>
          <div className="todo-table">
            {biggest.map(({ item, area }, n) => (
              <div key={n} className="todo-row psum-big">
                <span className="todo-item">{item.text}</span>
                <span>
                  <button className="todo-area" onClick={() => props.onArea(area.key)}>
                    {area.name}
                  </button>
                </span>
                <span className="psum-cost">{money(item.cost ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {untouched.length > 0 && (
        <div className="module">
          <div className="module-head">
            <span className="label">NOT STARTED · {untouched.length}</span>
          </div>
          <div className="psum-chips">
            {untouched.map((a) => (
              <button key={a.key} className="psum-chip" onClick={() => props.onArea(a.key)}>
                {a.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Every unfinished item across the house in one table: needed first, then optional. */
function TodoDetail({ areas, onArea }: { areas: Area[]; onArea: (key: string) => void }) {
  const open = areas.flatMap((a) => a.items.filter((i) => !i.done && !i.closed).map((item) => ({ item, area: a })));
  const needed = open.filter((r) => !r.item.optional);
  const optional = open.filter((r) => r.item.optional);
  return (
    <>
      <div className="d-title">
        <span className="d-name proj-name">TO DO</span>
        <span className="d-amt">{needed.length}</span>
      </div>
      <div className="d-sub">
        <span className="d-alloc" style={{ color: 'var(--amber)' }}>
          {needed.length} NEEDED · {optional.length} OPTIONAL · ACROSS THE HOUSE
        </span>
      </div>
      <div className="todo-table" role="table">
        <div className="todo-row head" role="row">
          <span role="columnheader">ITEM</span>
          <span role="columnheader">AREA</span>
          <span role="columnheader" />
        </div>
        {[...needed, ...optional].map(({ item, area }, n) => (
          <div key={n} className={`todo-row ${item.optional ? 'is-optional' : ''}`} role="row">
            <span className="todo-item" role="cell">
              {item.text}
            </span>
            <span role="cell">
              <button className="todo-area" onClick={() => onArea(area.key)}>
                {area.name}
              </button>
            </span>
            <span className="todo-tag" role="cell">
              {item.optional ? 'OPTIONAL' : ''}
            </span>
          </div>
        ))}
      </div>
      {open.length === 0 && <div className="module-note">Nothing left to do.</div>}
    </>
  );
}

function ItemRow({ item }: { item: ProjectItem }) {
  return (
    <div className={`pitem ${item.done ? 'is-done' : ''} ${item.closed ? 'is-closed' : ''} ${item.optional ? 'is-optional' : ''}`}>
      <span className="pitem-mark">{item.closed ? '–' : item.done ? '✓' : '○'}</span>
      <span className="pitem-text">{item.text}</span>
      {item.done && <span className="pitem-kind">{item.kind === 'maintenance' ? 'MAINT' : 'FURN'}</span>}
      {item.done && <span className="pitem-cost">{item.cost === 0 ? 'FREE' : money(item.cost ?? 0)}</span>}
    </div>
  );
}

function AreaDetail({ area }: { area: Area }) {
  const s = areaStats(area);
  const live = area.items.filter((i) => !i.closed);
  const todo = live.filter((i) => !i.done && !i.optional);
  const optional = live.filter((i) => !i.done && i.optional);
  const done = live.filter((i) => i.done);
  const closed = area.items.filter((i) => i.closed);
  const complete = s.total > 0 && s.done === s.total;

  const group = (label: string, items: ProjectItem[], foot?: string) =>
    items.length > 0 && (
      <div className="module">
        <div className="module-head">
          <span className="label">
            {label} · {items.length}
          </span>
          {foot && <span className="label">{foot}</span>}
        </div>
        <div className="pitems">
          {items.map((i, n) => (
            <ItemRow key={n} item={i} />
          ))}
        </div>
      </div>
    );

  return (
    <>
      <div className="d-title">
        <span className="d-name proj-name">{area.name}</span>
        <span className="d-amt">{s.spent ? money(s.spent) : '—'}</span>
      </div>
      <div className="d-sub">
        <span className="d-alloc" style={{ color: complete ? 'var(--green)' : 'var(--amber)' }}>
          {complete ? 'ALL DONE' : `${s.done} OF ${s.total} DONE`} · {SECTION_NAMES[area.section]}
        </span>
      </div>
      {area.note && <p className="proj-note">{area.note}</p>}
      {group('TO DO', todo)}
      {group('OPTIONAL', optional)}
      {group('DONE', done, s.spent ? `SPENT ${money(s.spent)}` : undefined)}
      {group('CLOSED', closed)}
      {todo.length === 0 && optional.length === 0 && done.length === 0 && (
        <div className="module-note">Nothing listed here yet.</div>
      )}
    </>
  );
}
