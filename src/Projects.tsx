import { useEffect, useMemo, useRef, useState } from 'react';
import snapshotCsv from './assets/projects-snapshot.csv?raw';
import { MobileNav } from './MobileNav';
import { PagedSidebar } from './Nav';
import { compact } from './model';
import { areaStats, parseCsv, parseProjects, totals, type Area, type ProjectItem } from './projectsModel';
import { PROJECTS_SHEET_DIRECT_URL, PROJECTS_SHEET_URL } from './projectsSource';
import { useDrill } from './useDrill';

const money = (n: number) => `$${compact(n)}`;

const SECTION_NAMES = { house: 'MOVE + MAINTENANCE', rooms: 'FURNISHING' } as const;

/** The detail key for the summary of everything, the page's default. */
const ALL_KEY = 'all';

/** What's been done, split by which column the cost went in. */
type DoneView = 'maintenance' | 'furnishing';
/** What's left, split into what's planned and what's optional. */
type TodoView = 'planned' | 'optional';

/** The left column's views: what's done, by column, then what's left to do and what's optional. */
const VIEWS = [
  { key: 'done-maintenance', name: 'MAINTENANCE', done: 'maintenance' as DoneView },
  { key: 'done-furnishing', name: 'FURNISHING', done: 'furnishing' as DoneView },
  { key: 'to-do', name: 'TO DO', todo: 'planned' as TodoView, gap: true },
  { key: 'to-do-optional', name: 'OPTIONAL', todo: 'optional' as TodoView },
];
type ViewDef = (typeof VIEWS)[number];
const TODO_KEY = 'to-do';

/** The items a view covers (closed ones never count). */
function viewItems(areas: Area[], v: ViewDef) {
  return areas.flatMap((area) =>
    area.items
      .filter((i) => !i.closed)
      .filter((i) =>
        v.done ? i.done && i.kind === v.done : !i.done && (v.todo === 'optional') === i.optional,
      )
      .map((item) => ({ item, area })),
  );
}

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
  const panelRef = useRef<HTMLElement>(null);

  // the sheet's order, house first then rooms
  const house = areas.filter((a) => a.section === 'house');
  const rooms = areas.filter((a) => a.section === 'rooms');
  const ordered = [...house, ...rooms];

  // the left column steps through the views; an area opens from the lists on the right
  const sequence = VIEWS.map((v) => v.key);
  const drill = useDrill({
    narrow: props.narrow,
    sub: props.sub,
    keys: [ALL_KEY, ...sequence, ...ordered.map((a) => a.key)],
    sequence,
    defaultKey: ALL_KEY,
    openSub: props.openSub,
    replaceSub: props.replaceSub,
    closeSub: props.closeSub,
    panelRef,
  });

  const t = totals(areas);
  // on wide screens something always shows: the chosen view or area, else the summary
  const view = VIEWS.find((v) => v.key === drill.selKey) ?? null;
  const area = areas.find((a) => a.key === drill.selKey) ?? null;
  const showAll = !view && !area;

  // a view's line: how many items, and what they cost
  const row = (v: ViewDef) => {
    const list = viewItems(ordered, v);
    const spent = list.reduce((s, r) => s + (r.item.cost ?? 0), 0);
    return (
      <button
        key={v.key}
        className={`side-row proj-view ${v.gap ? 'is-gap' : ''} ${!props.narrow && view === v ? 'is-sel' : ''}`}
        onClick={() => drill.select(v.key)}
      >
        <span className="side-caret" aria-hidden />
        <span className="side-name">{v.name}</span>
        <span className="side-pct">{list.length}</span>
        <span className="side-amt">{v.done ? compact(spent) : ''}</span>
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
                {t.done} OF {t.items} DONE · {t.items ? Math.round((t.done / t.items) * 100) : 0}%
              </div>
              <div className="side-rule" />
              {VIEWS.map(row)}

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
              {view?.done ? (
                <DoneDetail view={view} areas={ordered} onArea={(k) => drill.select(k)} />
              ) : view ? (
                <TodoDetail view={view} areas={ordered} onArea={(k) => drill.select(k)} />
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
  // by which column the cost went in, as the left column splits Completed
  const sections = [
    { name: 'MAINTENANCE', spent: t.maintenance },
    { name: 'FURNISHING', spent: t.furnishing },
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
            <b>{t.openNeeded}</b> TO DO
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

/** A view's title: "To do", "Optional", "Maintenance". */
const viewTitle = (v: ViewDef) => v.name.charAt(0) + v.name.slice(1).toLowerCase();

/** Everything done (or one column's share of it) in one table, costliest first. */
function DoneDetail({ view, areas, onArea }: { view: ViewDef; areas: Area[]; onArea: (key: string) => void }) {
  const rows = viewItems(areas, view).sort((x, y) => (y.item.cost ?? 0) - (x.item.cost ?? 0));
  const spent = rows.reduce((s, r) => s + (r.item.cost ?? 0), 0);
  const free = rows.filter((r) => r.item.cost === 0).length;
  return (
    <>
      <div className="d-title">
        <span className="d-name proj-name">{viewTitle(view)}</span>
        <span className="d-amt">{money(spent)}</span>
      </div>
      <div className="d-sub">
        <span className="d-alloc" style={{ color: 'var(--green)' }}>
          {rows.length} DONE{free ? ` · ${free} FREE` : ''}
        </span>
      </div>
      <div className="todo-table" role="table">
        <div className="todo-row head" role="row">
          <span role="columnheader">ITEM</span>
          <span role="columnheader">AREA</span>
          <span role="columnheader" className="todo-cost">
            COST
          </span>
        </div>
        {rows.map(({ item, area }, n) => (
          <div key={n} className="todo-row" role="row">
            <span className="todo-item" role="cell">
              {item.text}
            </span>
            <span role="cell">
              <button className="todo-area" onClick={() => onArea(area.key)}>
                {area.name}
              </button>
            </span>
            <span className="todo-cost" role="cell">
              {item.cost === 0 ? 'FREE' : money(item.cost ?? 0)}
            </span>
          </div>
        ))}
      </div>
      {rows.length === 0 && <div className="module-note">Nothing done here yet.</div>}
    </>
  );
}

/** What's left to do, or what's optional, across the house in one table. */
function TodoDetail({ view, areas, onArea }: { view: ViewDef; areas: Area[]; onArea: (key: string) => void }) {
  const open = viewItems(areas, view);
  return (
    <>
      <div className="d-title">
        <span className="d-name proj-name">{viewTitle(view)}</span>
        <span className="d-amt">{open.length}</span>
      </div>
      <div className="d-sub">
        <span className="d-alloc" style={{ color: 'var(--amber)' }}>
          ACROSS THE HOUSE
        </span>
      </div>
      <div className="todo-table todo-two" role="table">
        <div className="todo-row head" role="row">
          <span role="columnheader">ITEM</span>
          <span role="columnheader">AREA</span>
        </div>
        {open.map(({ item, area }, n) => (
          <div key={n} className="todo-row" role="row">
            <span className="todo-item" role="cell">
              {item.text}
            </span>
            <span role="cell">
              <button className="todo-area" onClick={() => onArea(area.key)}>
                {area.name}
              </button>
            </span>
          </div>
        ))}
      </div>
      {open.length === 0 && <div className="module-note">Nothing here.</div>}
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
