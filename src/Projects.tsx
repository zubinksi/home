import { useEffect, useMemo, useRef, useState } from 'react';
import snapshotCsv from './assets/projects-snapshot.csv?raw';
import { MobileNav } from './MobileNav';
import { compact } from './model';
import { areaStats, parseCsv, parseProjects, totals, type Area, type ProjectItem } from './projectsModel';
import { PROJECTS_SHEET_DIRECT_URL, PROJECTS_SHEET_URL } from './projectsSource';
import { useDrill } from './useDrill';

const OPTIONAL_KEY = 'browns.projects.optional.v1';
const money = (n: number) => `$${compact(n)}`;

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

function loadOptional() {
  try {
    return localStorage.getItem(OPTIONAL_KEY) !== '0';
  } catch {
    return true;
  }
}

export function Projects(props: {
  narrow: boolean;
  sub: string | null;
  openSub: (k: string) => void;
  replaceSub: (k: string) => void;
  closeSub: () => void;
}) {
  const { areas, source } = useProjects();
  const [showOptional, setShowOptional] = useState(loadOptional);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(OPTIONAL_KEY, showOptional ? '1' : '0');
    } catch {
      /* fine */
    }
  }, [showOptional]);

  const sequence = ['all', ...areas.map((a) => a.key)];
  const drill = useDrill({
    narrow: props.narrow,
    sub: props.sub,
    keys: sequence,
    sequence,
    defaultKey: 'all',
    openSub: props.openSub,
    replaceSub: props.replaceSub,
    closeSub: props.closeSub,
    panelRef,
  });

  const t = totals(areas);
  const area = areas.find((a) => a.key === drill.selKey) ?? null;
  const house = areas.filter((a) => a.section === 'house');
  const rooms = areas.filter((a) => a.section === 'rooms');
  const counted = showOptional ? t.items : t.items - t.openOptional;

  const row = (a: Area) => {
    const s = areaStats(a, showOptional);
    return (
      <button
        key={a.key}
        className={`side-row proj-row ${!props.narrow && drill.selKey === a.key ? 'is-sel' : ''}`}
        onClick={() => drill.select(a.key)}
      >
        <span className="side-caret">&gt;</span>
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
            <nav className={`sidebar ${drill.listClass}`}>
              <button
                className={`side-row total ${!props.narrow && drill.selKey === 'all' ? 'is-sel' : ''}`}
                onClick={() => drill.select('all')}
              >
                <span className="side-caret">&gt;</span>
                <span className="side-name">ALL PROJECTS</span>
                <span />
                <span className="side-amt">{compact(t.spent)}</span>
              </button>
              <div className="side-sub">
                {t.done} OF {counted} DONE · {t.openNeeded} TO DO
              </div>
              <div className="side-rule" />

              <div className="label side-section">THE HOUSE</div>
              {house.map(row)}
              <div className="label side-section">THE ROOMS</div>
              {rooms.map(row)}

              <div className="proj-foot">
                <button className="proj-toggle" onClick={() => setShowOptional(!showOptional)} aria-pressed={showOptional}>
                  OPTIONAL · <span className={showOptional ? 'on' : ''}>{showOptional ? 'SHOWN' : 'HIDDEN'}</span>
                </button>
                <div className={`proj-source ${source.kind}`}>
                  {source.kind === 'live' &&
                    `LIVE FROM THE SHEET · ${new Date(source.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase()}`}
                  {source.kind === 'saved' && 'LOADING THE SHEET…'}
                  {source.kind === 'error' && `SAVED COPY · ${source.message.toUpperCase()}`}
                </div>
                {source.kind === 'error' && <div className="proj-hint">{source.hint}</div>}
                <a className="proj-sheet" href={PROJECTS_SHEET_URL} target="_blank" rel="noreferrer">
                  OPEN THE SHEET <span aria-hidden>↗</span>
                </a>
              </div>
            </nav>
          )}

          {drill.showDetail && (
            <div key={drill.detailKey} className={`detail ${drill.detailClass}`} {...drill.touchHandlers}>
              {props.narrow && <MobileNav onBack={drill.back} position={drill.position} onStep={drill.step} />}
              {area ? (
                <AreaDetail area={area} showOptional={showOptional} />
              ) : (
                <Overview areas={areas} showOptional={showOptional} onOpen={drill.select} />
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Overview({ areas, showOptional, onOpen }: { areas: Area[]; showOptional: boolean; onOpen: (k: string) => void }) {
  const t = totals(areas);
  const counted = showOptional ? t.items : t.items - t.openOptional;
  const bySpend = areas
    .map((a) => ({ a, spent: areaStats(a).spent }))
    .filter((x) => x.spent > 0)
    .sort((x, y) => y.spent - x.spent);
  const max = bySpend[0]?.spent || 1;
  return (
    <>
      <div className="d-title">
        <span className="d-name">ALL PROJECTS</span>
        <span className="d-amt">{money(t.spent)}</span>
      </div>
      <div className="d-sub">
        <span className="d-alloc" style={{ color: 'var(--amber)' }}>
          {t.openNeeded} TO DO{showOptional && t.openOptional ? ` · ${t.openOptional} OPTIONAL` : ''}
        </span>
      </div>
      <div className="cards" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="card">
          <div className="label">SPENT</div>
          <div className="card-v">{money(t.spent)}</div>
          <div className="card-d">
            {money(t.maintenance)} MAINT · {money(t.furnishing)} FURNISHING
          </div>
        </div>
        <div className="card">
          <div className="label">DONE</div>
          <div className="card-v">
            {t.done} / {counted}
          </div>
          <div className="card-d" style={{ color: 'var(--green)' }}>
            {Math.round((t.done / Math.max(1, counted)) * 100)}% COMPLETE
          </div>
        </div>
        <div className="card">
          <div className="label">TO DO</div>
          <div className="card-v">{t.openNeeded}</div>
          <div className="card-d">{showOptional ? `+ ${t.openOptional} OPTIONAL` : 'OPTIONAL HIDDEN'}</div>
        </div>
      </div>

      <div className="module">
        <div className="module-head">
          <span className="label">WHERE THE MONEY WENT</span>
          <span className="label">BY AREA</span>
        </div>
        <div className="spend">
          {bySpend.map(({ a, spent }) => (
            <button key={a.key} className="spend-row" onClick={() => onOpen(a.key)}>
              <span className="spend-name">{a.name}</span>
              <span className="spend-bar">
                <span style={{ width: `${(spent / max) * 100}%` }} />
              </span>
              <span className="spend-amt">{money(spent)}</span>
            </button>
          ))}
        </div>
      </div>
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

function AreaDetail({ area, showOptional }: { area: Area; showOptional: boolean }) {
  const s = areaStats(area, showOptional);
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
          {complete ? 'ALL DONE' : `${s.done} OF ${s.total} DONE`} · {area.section === 'house' ? 'THE HOUSE' : 'THE ROOMS'}
        </span>
      </div>
      {area.note && <p className="proj-note">{area.note}</p>}
      {group('TO DO', todo)}
      {showOptional && group('OPTIONAL', optional)}
      {group('DONE', done, s.spent ? `SPENT ${money(s.spent)}` : undefined)}
      {group('CLOSED', closed)}
      {todo.length === 0 && (!showOptional || optional.length === 0) && done.length === 0 && (
        <div className="module-note">Nothing listed here yet.</div>
      )}
    </>
  );
}
