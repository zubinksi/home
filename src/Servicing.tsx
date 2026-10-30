import { useEffect, useMemo, useRef, useState } from 'react';
import { MobileNav } from './MobileNav';
import { PagedSidebar } from './Nav';
import { dayMon, isoDay, titleName } from './model';
import { parseCsv } from './projectsModel';
import { PROJECTS_SHEET_ID } from './projectsSource';
import {
  dueInYear,
  groupOf,
  latestByJob,
  parseServiceLog,
  savedEntries,
  SERVICE_GROUPS,
  serviceStatus,
  serviceTasks,
  type LogEntry,
  type ServiceLog,
  type ServiceStatus,
  type ServiceTask,
} from './servicing';
import { useDrill } from './useDrill';

const GROUPS: { status: ServiceStatus; label: string }[] = [
  { status: 'overdue', label: 'OVERDUE' },
  { status: 'soon', label: 'DUE THIS MONTH' },
  { status: 'later', label: 'LATER' },
  { status: 'unlogged', label: 'NOT LOGGED YET' },
];

const STATUS_COLOR: Record<ServiceStatus, string> = {
  overdue: 'var(--red)',
  soon: 'var(--amber)',
  later: 'var(--muted)',
  unlogged: 'var(--muted)',
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** The detail key for the summary, the page's default. */
const ALL_KEY = 'all';

/** The log tab, read straight from Google (when there's no server). */
const LOG_DIRECT_URL = `https://docs.google.com/spreadsheets/d/${PROJECTS_SHEET_ID}/gviz/tq?tqx=out:csv&gid=731905&headers=0`;

type Row = { t: ServiceTask } & ReturnType<typeof serviceStatus>;
type LogJob = (t: ServiceTask, date: string) => Promise<string | null>;

/**
 * The log: starts from the saved copy, swaps in the sheet's tab when it
 * arrives, and adds a row (on the sheet, then here) when a job's logged.
 */
function useServiceLog() {
  const [entries, setEntries] = useState<LogEntry[]>(savedEntries);
  useEffect(() => {
    let cancelled = false;
    const read = async (url: string, server: boolean) => {
      try {
        const res = await fetch(url);
        if (server) {
          if (!(res.headers.get('content-type') ?? '').includes('json')) return null;
          const data = await res.json();
          return res.ok && typeof data?.csv === 'string' ? (data.csv as string) : null;
        }
        const text = await res.text();
        return res.ok && !/<html/i.test(text.slice(0, 500)) ? text : null;
      } catch {
        return null;
      }
    };
    (async () => {
      const csv = (await read('/api/service-log', true)) ?? (await read(LOG_DIRECT_URL, false));
      if (csv != null && !cancelled) setEntries(parseServiceLog(parseCsv(csv)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logJob: LogJob = async (t, date) => {
    try {
      const res = await fetch('/api/service-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, job: t.name, date }),
      });
      const data = (res.headers.get('content-type') ?? '').includes('json') ? await res.json() : null;
      if (!res.ok || !data?.ok) return data?.message ?? 'Couldn’t save it to the sheet.';
      setEntries((e) => [...e, { date, id: t.id, job: t.name, note: '' }]);
      return null;
    } catch {
      return 'Couldn’t reach the server.';
    }
  };
  return { entries, logJob };
}

/**
 * The house's recurring upkeep: four groups on the left; on the right, a
 * summary of what's next and the year ahead, or one group's jobs.
 */
export function Servicing(props: {
  narrow: boolean;
  sub: string | null;
  openSub: (k: string) => void;
  replaceSub: (k: string) => void;
  closeSub: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const { entries, logJob } = useServiceLog();
  const log = useMemo(() => latestByJob(entries), [entries]);
  const today = new Date();
  const rows: Row[] = serviceTasks
    .map((t) => ({ t, ...serviceStatus(t, today, log) }))
    .sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
  const sequence = SERVICE_GROUPS.map((g) => g.key);

  const drill = useDrill({
    narrow: props.narrow,
    sub: props.sub,
    keys: [ALL_KEY, ...sequence],
    sequence,
    defaultKey: ALL_KEY,
    openSub: props.openSub,
    replaceSub: props.replaceSub,
    closeSub: props.closeSub,
    panelRef,
  });
  const active = SERVICE_GROUPS.find((g) => g.key === drill.selKey) ?? null;
  const count = (list: Row[], s: ServiceStatus) => list.filter((r) => r.status === s).length;
  const inGroup = (key: string) => rows.filter((r) => groupOf(r.t).key === key);

  // a group's line in the list: how many jobs, and the most pressing state among them
  const groupRow = (g: (typeof SERVICE_GROUPS)[number]) => {
    const list = inGroup(g.key);
    const late = count(list, 'overdue');
    const soon = count(list, 'soon');
    const note = late ? `${late} LATE` : soon ? `${soon} DUE` : '';
    return (
      <button key={g.key} className={`side-row svc-row ${!props.narrow && active === g ? 'is-sel' : ''}`} onClick={() => drill.select(g.key)}>
        <span className="side-caret" aria-hidden />
        <span className="side-name">{g.name}</span>
        <span className="svc-row-note" style={{ color: late ? 'var(--red)' : 'var(--amber)' }}>
          {note}
        </span>
        <span className="side-amt">{list.length}</span>
      </button>
    );
  };

  return (
    <main className="body">
      <section className="slab sleeves" ref={panelRef}>
        <div className={`sleeves-grid ${drill.gridClass}`}>
          {drill.showList && (
            <PagedSidebar className={`sidebar ${drill.listClass}`} tab="servicing">
              <button className={`side-row total ${!props.narrow && !active ? 'is-sel' : ''}`} onClick={() => drill.select(ALL_KEY)}>
                <span className="side-caret" aria-hidden />
                <span className="side-name page-name">Servicing</span>
                <span />
                <span className="side-amt">{rows.length}</span>
              </button>
              <div className="side-sub">
                {standing(count(rows, 'overdue'), count(rows, 'soon'))}
              </div>
              <div className="side-rule" />
              <div className="label side-section">THE JOBS</div>
              {SERVICE_GROUPS.map(groupRow)}
            </PagedSidebar>
          )}

          {drill.showDetail && (
            <div key={drill.detailKey} className={`detail ${drill.detailClass}`} {...drill.touchHandlers}>
              {props.narrow && <MobileNav onBack={drill.back} />}
              {active ? (
                <ServiceDetail title={titleName(active.name)} rows={inGroup(active.key)} log={log} logJob={logJob} />
              ) : (
                <ServiceSummary rows={rows} log={log} entries={entries} logJob={logJob} />
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/** The status line: only what there is ("2 OVERDUE · 1 DUE THIS MONTH"), or that nothing's due. */
function standing(overdue: number, soon: number) {
  const parts = [overdue && `${overdue} OVERDUE`, soon && `${soon} DUE THIS MONTH`].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'NOTHING DUE THIS MONTH';
}

/** When a job's next due, as a row shows it. */
function when(r: Row) {
  if (!r.due || r.days == null) return 'LOG IT';
  const date = dayMon(isoDay(r.due));
  if (r.days < 0) return `${date} · ${-r.days} DAYS LATE`;
  if (r.days === 0) return `${date} · TODAY`;
  if (r.days <= 30) return `${date} · IN ${r.days} DAYS`;
  return date;
}

/** Which job is open, shared across a page's lists so a job stays open as logging moves it. */
type Open = { open: string | null; setOpen: (id: string | null) => void };

/** A list of jobs; tap one for how to do it, and to log it done. */
function JobList({ rows, log, logJob, open, setOpen }: { rows: Row[]; log: ServiceLog; logJob: LogJob } & Open) {
  return (
    <div className="svc-list">
      {rows.map((r) => {
        const isOpen = open === r.t.id;
        const last = log[r.t.id];
        return (
          <div key={r.t.id} className={`svc ${isOpen ? 'is-open' : ''}`}>
            <button className="svc-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.t.id)}>
              <span className="svc-name">
                {r.t.name}
                <span className="svc-area">{r.t.area}</span>
              </span>
              <span className="svc-when">
                <span style={{ color: STATUS_COLOR[r.status] }}>{when(r)}</span>
                <span className="svc-cadence">{r.t.cadence}</span>
              </span>
            </button>
            {isOpen && (
              <div className="svc-body">
                <p>{r.t.how}</p>
                <span className="label">{last ? `LAST DONE ${dayMon(last)}` : 'NOT LOGGED YET'}</span>
                <LogForm task={r.t} logJob={logJob} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Log a job as done: today by default, or the day it was done. */
function LogForm({ task, logJob }: { task: ServiceTask; logJob: LogJob }) {
  const todayIso = isoDay(new Date());
  const [date, setDate] = useState(todayIso);
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'done' } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const save = async () => {
    setState({ kind: 'saving' });
    const problem = await logJob(task, date);
    setState(problem ? { kind: 'error', message: problem } : { kind: 'done' });
  };
  return (
    <div className="svc-log">
      <input
        className="svc-log-date"
        type="date"
        value={date}
        max={todayIso}
        aria-label="Done on"
        onChange={(e) => {
          setDate(e.target.value);
          setState({ kind: 'idle' });
        }}
      />
      <button className="svc-log-btn" disabled={!date || state.kind === 'saving' || state.kind === 'done'} onClick={save}>
        {state.kind === 'saving' ? 'SAVING…' : state.kind === 'done' ? `LOGGED ${dayMon(date)}` : 'LOG AS DONE'}
      </button>
      {state.kind === 'error' && <span className="svc-log-error">{state.message}</span>}
    </div>
  );
}

/** One group's jobs, by where they stand, soonest first. */
function ServiceDetail({ title, rows, log, logJob }: { title: string; rows: Row[]; log: ServiceLog; logJob: LogJob }) {
  const [open, setOpen] = useState<string | null>(null);
  const count = (s: ServiceStatus) => rows.filter((r) => r.status === s).length;
  return (
    <>
      <div className="d-title">
        <span className="d-name proj-name">{title}</span>
        <span className="d-amt">{rows.length}</span>
      </div>
      <div className="d-sub">
        <span className="d-alloc" style={{ color: count('overdue') ? 'var(--red)' : count('soon') ? 'var(--amber)' : 'var(--green)' }}>
          {standing(count('overdue'), count('soon'))}
        </span>
      </div>

      {GROUPS.map(({ status, label }) => {
        const list = rows.filter((r) => r.status === status);
        if (!list.length) return null;
        return (
          <div key={status} className="module">
            <div className="module-head">
              <span className="label">
                {label} · {list.length}
              </span>
            </div>
            <JobList rows={list} log={log} logJob={logJob} open={open} setOpen={setOpen} />
          </div>
        );
      })}
    </>
  );
}

/** The whole schedule at a glance: what's next, the year ahead, what needs a first date, what was done lately. */
function ServiceSummary({ rows, log, entries, logJob }: { rows: Row[]; log: ServiceLog; entries: LogEntry[]; logJob: LogJob }) {
  const today = new Date();
  const count = (s: ServiceStatus) => rows.filter((r) => r.status === s).length;
  const next = rows.filter((r) => r.due).slice(0, 3);
  const unlogged = rows.filter((r) => r.status === 'unlogged');
  const recent = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);

  // the twelve months from this one, and what comes due in each
  const months = Array.from({ length: 12 }, (_, i) => new Date(today.getFullYear(), today.getMonth() + i, 1));
  const byMonth = months.map((m) =>
    rows
      .flatMap((r) => dueInYear(r.t, log, today).map((d) => ({ r, d })))
      .filter(({ d }) => d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth())
      .sort((a, b) => a.d.getTime() - b.d.getTime()),
  );
  const most = Math.max(1, ...byMonth.map((l) => l.length));
  // no month open at first (Next up already says what's soonest); tap one to see its jobs
  const [month, setMonth] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <div className="d-title">
        <span className="d-name proj-name page-name">Servicing</span>
        <span className="d-amt">{rows.length}</span>
      </div>
      <div className="d-sub">
        <span className="d-alloc" style={{ color: count('overdue') ? 'var(--red)' : count('soon') ? 'var(--amber)' : 'var(--green)' }}>
          {standing(count('overdue'), count('soon'))}
        </span>
      </div>

      <div className="module">
        <div className="module-head">
          <span className="label">NEXT UP</span>
        </div>
        <JobList rows={next} log={log} logJob={logJob} open={open} setOpen={setOpen} />
      </div>

      <div className="module">
        <div className="module-head">
          <span className="label">THE YEAR AHEAD</span>
        </div>
        <div className="svc-year" role="tablist">
          {months.map((m, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={month === i}
              className={`svc-month ${month === i ? 'is-sel' : ''}`}
              onClick={() => setMonth(month === i ? null : i)}
            >
              <span className="svc-month-bar">
                <span style={{ height: `${(byMonth[i].length / most) * 100}%` }} />
              </span>
              <span className="svc-month-name">{MONTHS[m.getMonth()].slice(0, 1)}</span>
              <span className="svc-month-count">{byMonth[i].length || ''}</span>
            </button>
          ))}
        </div>
        {month != null && (
          <div className="svc-month-list">
            <span className="label">
              {MONTHS[months[month].getMonth()]} {months[month].getFullYear()} · {byMonth[month].length ? `${byMonth[month].length} DUE` : 'NOTHING DUE'}
            </span>
            {byMonth[month].map(({ r, d }) => (
              <div key={r.t.id + d.getTime()} className="svc-month-row">
                <span className="svc-name">
                  {r.t.name}
                  <span className="svc-area">{groupOf(r.t).name}</span>
                </span>
                <span className="svc-when">{dayMon(isoDay(d))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {unlogged.length > 0 && (
        <div className="module">
          <div className="module-head">
            <span className="label">NEEDS A FIRST DATE · {unlogged.length}</span>
          </div>
          <JobList rows={unlogged} log={log} logJob={logJob} open={open} setOpen={setOpen} />
        </div>
      )}

      {recent.length > 0 && (
        <div className="module">
          <div className="module-head">
            <span className="label">RECENTLY DONE</span>
          </div>
          <div className="svc-list">
            {recent.map((e, i) => (
              <div key={i} className="svc-month-row">
                <span className="svc-name">{serviceTasks.find((t) => t.id === e.id)?.name ?? e.job}</span>
                <span className="svc-when">{dayMon(e.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
