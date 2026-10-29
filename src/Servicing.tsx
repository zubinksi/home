import { useState } from 'react';
import { dayMon, isoDay } from './model';
import { serviceLog, serviceStatus, serviceTasks, type ServiceStatus } from './servicing';

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

/** The house's recurring upkeep, soonest first; tap a job for how to do it. */
export function Servicing() {
  const [open, setOpen] = useState<string | null>(null);
  const today = new Date();
  const rows = serviceTasks
    .map((t) => ({ t, ...serviceStatus(t, today) }))
    .sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
  const count = (s: ServiceStatus) => rows.filter((r) => r.status === s).length;

  const when = (r: (typeof rows)[number]) => {
    if (!r.due || r.days == null) return 'LOG IT';
    const date = dayMon(isoDay(r.due));
    if (r.days < 0) return `${date} · ${-r.days} DAYS LATE`;
    if (r.days === 0) return `${date} · TODAY`;
    if (r.days <= 30) return `${date} · IN ${r.days} DAYS`;
    return date;
  };

  return (
    <main className="body">
      <section className="slab service-slab">
        <div className="detail">
          <div className="d-title">
            <span className="d-name proj-name">SERVICING</span>
            <span className="d-amt">{serviceTasks.length}</span>
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
        </div>
      </section>
    </main>
  );
}
