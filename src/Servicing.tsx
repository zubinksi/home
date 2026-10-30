import { useRef, useState } from 'react';
import { MobileNav } from './MobileNav';
import { PagedSidebar } from './Nav';
import { dayMon, isoDay } from './model';
import { serviceLog, serviceStatus, serviceTasks, type Area, type ServiceStatus, type ServiceTask } from './servicing';
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

/** The detail key for the whole schedule, the page's default. */
const ALL_KEY = 'all';

type Row = { t: ServiceTask } & ReturnType<typeof serviceStatus>;

const AREAS: Area[] = ['HVAC', 'CLEANING', 'EXTERIOR', 'KITCHEN', 'LAUNDRY', 'PLUMBING', 'SAFETY', 'HARDWARE'];
const areaKey = (a: Area) => a.toLowerCase();

/**
 * The house's recurring upkeep: a list of areas on the left (as Investments
 * and Projects have), the whole schedule or one area's jobs on the right.
 */
export function Servicing(props: {
  narrow: boolean;
  sub: string | null;
  openSub: (k: string) => void;
  replaceSub: (k: string) => void;
  closeSub: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const today = new Date();
  const rows: Row[] = serviceTasks
    .map((t) => ({ t, ...serviceStatus(t, today) }))
    .sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
  const areas = AREAS.filter((a) => rows.some((r) => r.t.area === a));
  const sequence = areas.map(areaKey);

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
  const active = areas.find((a) => areaKey(a) === drill.selKey) ?? null;
  const count = (list: Row[], s: ServiceStatus) => list.filter((r) => r.status === s).length;

  // an area's line in the list: how many jobs, and the most pressing state among them
  const areaRow = (a: Area) => {
    const list = rows.filter((r) => r.t.area === a);
    const late = count(list, 'overdue');
    const soon = count(list, 'soon');
    const note = late ? `${late} LATE` : soon ? `${soon} DUE` : '';
    return (
      <button key={a} className={`side-row svc-row ${!props.narrow && active === a ? 'is-sel' : ''}`} onClick={() => drill.select(areaKey(a))}>
        <span className="side-caret" aria-hidden />
        <span className="side-name">{a}</span>
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
                {count(rows, 'overdue')} OVERDUE · {count(rows, 'soon')} DUE THIS MONTH
              </div>
              <div className="side-rule" />
              <div className="label side-section">THE JOBS</div>
              {areas.map(areaRow)}
            </PagedSidebar>
          )}

          {drill.showDetail && (
            <div key={drill.detailKey} className={`detail ${drill.detailClass}`} {...drill.touchHandlers}>
              {props.narrow && <MobileNav onBack={drill.back} />}
              <ServiceDetail title={active ?? 'Servicing'} rows={active ? rows.filter((r) => r.t.area === active) : rows} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/** A list of jobs grouped by where they stand, soonest first; tap a job for how to do it. */
function ServiceDetail({ title, rows }: { title: string; rows: Row[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const count = (s: ServiceStatus) => rows.filter((r) => r.status === s).length;

  const when = (r: Row) => {
    if (!r.due || r.days == null) return 'LOG IT';
    const date = dayMon(isoDay(r.due));
    if (r.days < 0) return `${date} · ${-r.days} DAYS LATE`;
    if (r.days === 0) return `${date} · TODAY`;
    if (r.days <= 30) return `${date} · IN ${r.days} DAYS`;
    return date;
  };

  return (
    <>
      <div className="d-title">
        <span className={`d-name proj-name ${title === 'Servicing' ? 'page-name' : ''}`}>{title}</span>
        <span className="d-amt">{rows.length}</span>
      </div>
      <div className="d-sub">
        <span className="d-alloc" style={{ color: count('overdue') ? 'var(--red)' : count('soon') ? 'var(--amber)' : 'var(--green)' }}>
          {count('overdue')} OVERDUE · {count('soon')} DUE THIS MONTH
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
            <div className="svc-list">
              {list.map((r) => {
                const isOpen = open === r.t.id;
                const last = serviceLog[r.t.id];
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
