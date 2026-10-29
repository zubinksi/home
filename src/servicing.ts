// THE SERVICING SCHEDULE. The house's recurring upkeep: how often each job
// comes round, and when we last did it. When something's done, add its date to
// `serviceLog` below (YYYY-MM-DD) and the page works out when it's next due.

import { isoDay } from './model';

export type Area = 'HVAC' | 'CLEANING' | 'EXTERIOR' | 'KITCHEN' | 'LAUNDRY' | 'PLUMBING' | 'SAFETY' | 'HARDWARE';

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
    byMonths: [5, 10],
    cadence: 'SPRING AND FALL',
    how: 'Summer: open the upstairs dampers, close down the basement. Winter: the reverse, since heat rises. Ask the tech to label each damper at the tune-up.',
  },
  {
    id: 'deep-clean',
    name: 'Deep clean',
    area: 'CLEANING',
    every: 60,
    cadence: 'EVERY 60 DAYS',
    how: 'Baseboards, vents, inside the oven and fridge, behind the appliances, and the mudroom.',
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
    id: 'pressure-wash',
    name: 'Pressure wash the house and patio',
    area: 'EXTERIOR',
    byMonths: [4, 10],
    cadence: 'SPRING AND FALL',
    how: 'Siding, walks and the patio. Low pressure near windows and the new roof’s trim.',
  },
  {
    id: 'gutters',
    name: 'Clear the gutters and downspouts',
    area: 'EXTERIOR',
    byMonths: [4, 11],
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

/** When each job was last done (YYYY-MM-DD). Add a line when one's done. */
export const serviceLog: Record<string, string> = {};

const DAY = 86_400_000;
const at = (iso: string) => new Date(iso + 'T00:00:00');

/** The next due date for a task, or null if it's on an interval and was never logged. */
export function nextDue(t: ServiceTask, today = new Date()): Date | null {
  const last = serviceLog[t.id];
  if (t.every) return last ? new Date(at(last).getTime() + t.every * DAY) : null;
  // the first window after it was last done; never logged, a window in the last
  // six weeks still counts as due, since we can't say it was done
  const from = last ? at(last) : new Date(today.getTime() - 45 * DAY);
  for (let y = from.getFullYear(); y <= from.getFullYear() + 1; y++)
    for (const m of [...(t.byMonths ?? [])].sort((a, b) => a - b)) {
      const d = new Date(y, m - 1, 1);
      if (d > from) return d;
    }
  return null;
}

export type ServiceStatus = 'overdue' | 'soon' | 'later' | 'unlogged';

/** Where a task stands today: overdue, due within a month, later, or never logged. */
export function serviceStatus(t: ServiceTask, today = new Date()) {
  const due = nextDue(t, today);
  if (!due) return { status: 'unlogged' as ServiceStatus, due, days: null };
  const days = Math.round((due.getTime() - at(isoDay(today)).getTime()) / DAY);
  return { status: (days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'later') as ServiceStatus, due, days };
}
