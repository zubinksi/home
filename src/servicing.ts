// THE SERVICING SCHEDULE. The house's recurring upkeep: how often each job
// comes round, and when we last did it. Jobs are logged as done from the page,
// into the "Servicing log" tab of the projects sheet; the page works out from
// the latest date when each is next due.

import { isoDay } from './model';

export type Area = 'HVAC' | 'CLEANING' | 'EXTERIOR' | 'KITCHEN' | 'LAUNDRY' | 'PLUMBING' | 'SAFETY' | 'HARDWARE';

/** The page's four groups, by where in the house the work is. */
export const SERVICE_GROUPS: { key: string; name: string; areas: Area[] }[] = [
  { key: 'heating', name: 'HEATING & COOLING', areas: ['HVAC'] },
  { key: 'outside', name: 'OUTSIDE', areas: ['EXTERIOR'] },
  { key: 'kitchen', name: 'KITCHEN & LAUNDRY', areas: ['KITCHEN', 'LAUNDRY'] },
  { key: 'house', name: 'AROUND THE HOUSE', areas: ['CLEANING', 'PLUMBING', 'SAFETY', 'HARDWARE'] },
];
export const groupOf = (t: ServiceTask) => SERVICE_GROUPS.find((g) => g.areas.includes(t.area))!;

export interface ServiceTask {
  id: string;
  name: string;
  area: Area;
  /** comes round every this many days after it was last done */
  every?: number;
  /** or: due by the first of these months each year (1 = January), e.g. before summer and before winter */
  byMonths?: number[];
  /** how it's said on the page, e.g. "EVERY 90 DAYS" */
  cadence: string;
  /** what to do, in a line or two */
  how: string;
}

export const serviceTasks: ServiceTask[] = [
  {
    id: 'hvac-filters',
    name: 'Change the HVAC filters',
    area: 'HVAC',
    every: 90,
    cadence: 'EVERY 90 DAYS',
    how: 'Note the size printed on the filter edge and keep a spare. Arrow on the frame points toward the blower.',
  },
  {
    id: 'hvac-service',
    name: 'HVAC tune-up',
    area: 'HVAC',
    byMonths: [5, 10],
    cadence: 'BEFORE SUMMER AND WINTER',
    how: 'Book the service in April and September, before the rush. Ask them to check refrigerant, the burners and the condensate line.',
  },
  {
    id: 'hvac-dampers',
    name: 'Set the dampers for the season',
    area: 'HVAC',
    byMonths: [5, 11],
    cadence: 'MAY AND NOVEMBER',
    how: 'Summer: open the upstairs dampers, close down the basement. Winter: the reverse, since heat rises. Ask the tech to label each damper at the tune-up.',
  },
  {
    id: 'carpets',
    name: 'Carpet and upholstery cleaning',
    area: 'CLEANING',
    every: 365,
    cadence: 'ONCE A YEAR',
    how: 'The same service as on move-in. Spring is easiest, so everything dries with the windows open.',
  },
  {
    id: 'gutters',
    name: 'Clear the gutters and downspouts',
    area: 'EXTERIOR',
    byMonths: [4, 12],
    cadence: 'SPRING AND AFTER LEAF FALL',
    how: 'Run a hose down each downspout to check it drains. The front one clogged before.',
  },
  {
    id: 'roof-check',
    name: 'Look over the roof',
    area: 'EXTERIOR',
    byMonths: [4],
    cadence: 'EACH SPRING',
    how: 'From the ground or a ladder after winter: the chimney flashing, any loose screws on the metal panels, and debris in the valleys.',
  },
  {
    id: 'pest',
    name: 'Bug control spray',
    area: 'EXTERIOR',
    every: 75,
    cadence: 'EVERY 60–90 DAYS',
    how: 'Perimeter, foundation and the basement. More often in summer.',
  },
  {
    id: 'dishwasher',
    name: 'Clean the dishwasher',
    area: 'KITCHEN',
    every: 30,
    cadence: 'EVERY MONTH',
    how: 'Pull and rinse the filter at the bottom, then run it empty and hot with a cleaning tablet.',
  },
  {
    id: 'disposal',
    name: 'Clean the garbage disposal',
    area: 'KITCHEN',
    every: 365,
    cadence: 'ONCE A YEAR',
    how: 'Ice and coarse salt, then citrus peels. Wipe under the splash guard.',
  },
  {
    id: 'dryer-duct',
    name: 'Clean the dryer duct',
    area: 'LAUNDRY',
    every: 365,
    cadence: 'ONCE A YEAR',
    how: 'From the back of the dryer to the outside vent flap. A clogged duct is a fire risk, not just slow drying.',
  },
  {
    id: 'water-heater',
    name: 'Drain the water heater',
    area: 'PLUMBING',
    every: 365,
    cadence: 'ONCE A YEAR',
    how: 'Power or gas to pilot first, then flush from the drain valve until it runs clear. Clears sediment and keeps it efficient.',
  },
  {
    id: 'detectors',
    name: 'Test smoke and CO detectors',
    area: 'SAFETY',
    byMonths: [3, 11],
    cadence: 'AT EACH CLOCK CHANGE',
    how: 'Press test on every one; replace batteries in the fall. Detectors themselves go after ten years.',
  },
  {
    id: 'hinges',
    name: 'Oil the door hinges and brackets',
    area: 'HARDWARE',
    every: 365,
    cadence: 'ONCE A YEAR',
    how: 'A drop of light oil or silicone on each hinge pin and the garage door brackets; wipe off the excess.',
  },
];

/** Each job's latest date (YYYY-MM-DD), by job id. */
export type ServiceLog = Record<string, string>;

/** A row of the log: one job done on one day. */
export interface LogEntry {
  date: string;
  id: string;
  job: string;
  note: string;
}

/**
 * A saved copy of the log, used until the sheet's tab loads (and if it can't).
 * The sheet is the record now: log jobs from the page, not here.
 */
export const serviceLog: ServiceLog = {
  // done in August 2026 (the day wasn't noted; mid-month stands in)
  'hvac-service': '2026-08-15',
  carpets: '2026-08-15',
  'dryer-duct': '2026-08-15',
  // done October 29
  'hvac-filters': '2026-10-29',
  pest: '2026-10-29',
  detectors: '2026-10-29',
};

const DAY = 86_400_000;
const at = (iso: string) => new Date(iso + 'T00:00:00');

/** The next due date for a task, or null if it's on an interval and was never logged. */
export function nextDue(t: ServiceTask, today = new Date(), log: ServiceLog = serviceLog): Date | null {
  const last = log[t.id];
  if (t.every) return last ? new Date(at(last).getTime() + t.every * DAY) : null;
  // the first window it hasn't covered: done up to two months ahead counts (a
  // tune-up booked in August covers October). Never logged, a window in the
  // last six weeks still counts as due, since we can't say it was done
  const from = last ? at(last) : new Date(today.getTime() - 45 * DAY);
  const ahead = last ? 60 * DAY : 0;
  for (let y = from.getFullYear(); y <= from.getFullYear() + 1; y++)
    for (const m of [...(t.byMonths ?? [])].sort((a, b) => a - b)) {
      const d = new Date(y, m - 1, 1);
      if (d.getTime() > from.getTime() + ahead) return d;
    }
  return null;
}

export type ServiceStatus = 'overdue' | 'soon' | 'later' | 'unlogged';

/** Where a task stands today: overdue, due within a month, later, or never logged. */
export function serviceStatus(t: ServiceTask, today = new Date(), log: ServiceLog = serviceLog) {
  const due = nextDue(t, today, log);
  if (!due) return { status: 'unlogged' as ServiceStatus, due, days: null };
  const days = Math.round((due.getTime() - at(isoDay(today)).getTime()) / DAY);
  return { status: (days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'later') as ServiceStatus, due, days };
}

/** "8/15/2026" or "2026-08-15" → "2026-08-15"; anything else → null. */
function toIso(cell: string) {
  const v = cell.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  return us ? `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}` : null;
}

/** The sheet's rows (Done on, Job, Job ID, Note), skipping the header and anything unreadable. */
export function parseServiceLog(rows: string[][]): LogEntry[] {
  const ids = new Set(serviceTasks.map((t) => t.id));
  return rows
    .map(([date = '', job = '', id = '', note = '']) => ({ date: toIso(date), job: job.trim(), id: id.trim(), note: note.trim() }))
    .filter((e): e is LogEntry => !!e.date && ids.has(e.id));
}

/** The saved copy as log rows, for before the sheet arrives. */
export const savedEntries: LogEntry[] = Object.entries(serviceLog).map(([id, date]) => ({
  date,
  id,
  job: serviceTasks.find((t) => t.id === id)?.name ?? id,
  note: '',
}));

/** Each job's latest date across the rows. */
export function latestByJob(entries: LogEntry[]): ServiceLog {
  const out: ServiceLog = {};
  for (const e of entries) if (!out[e.id] || e.date > out[e.id]) out[e.id] = e.date;
  return out;
}

/** When a job comes due in the twelve months from the start of this month. */
export function dueInYear(t: ServiceTask, log: ServiceLog, today = new Date()): Date[] {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear() + 1, today.getMonth(), 1);
  const first = nextDue(t, today, log);
  if (!first) return [];
  const out: Date[] = [];
  if (t.every) {
    for (let d = first; d < end; d = new Date(d.getTime() + t.every * DAY)) if (d >= start) out.push(d);
  } else {
    for (let y = first.getFullYear(); y <= first.getFullYear() + 1; y++)
      for (const m of t.byMonths ?? []) {
        const d = new Date(y, m - 1, 1);
        if (d >= first && d >= start && d < end) out.push(d);
      }
  }
  // an overdue job shows in this month, when it's to be done
  if (first < start) out.unshift(start);
  return out.sort((a, b) => a.getTime() - b.getTime());
}
