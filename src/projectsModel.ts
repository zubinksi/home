// Turns the Projects tab of the "Home Projects & Vendors" sheet into areas and items.
//
// Sheet conventions this relies on (keep them when editing the sheet):
//  - Groups are separated by a blank row. A group's first row is its heading,
//    "Area: condition note" (the note is optional).
//  - Item rows: A = item, B = moving / maintenance cost, C = furnishing cost.
//    Any cost (including "FREE") means the item is done.
//  - "Optional:" before an item marks it optional; "Closed:" marks it dropped.
//  - The totals rows at the bottom are ignored; the page adds things up itself.

export type Section = 'house' | 'rooms';

export interface ProjectItem {
  text: string;
  cost: number | null; // null = not done yet
  costLabel: string; // as written in the sheet, e.g. "$1,200" or "FREE"
  kind: 'maintenance' | 'furnishing' | null; // which column the cost is in
  done: boolean;
  optional: boolean;
  closed: boolean;
}

export interface Area {
  key: string;
  name: string;
  note: string;
  section: Section;
  items: ProjectItem[];
}

const TOTAL_ROWS = /^(moving\s*&\s*maintenance|furniture\s*&\s*decor|total)$/i;
// areas about the building itself rather than a room
const HOUSE_AREAS = /^(moving|roof|plumbing|maint|testing|walls|windows|patio|yard|exterior|hvac|electrical)/i;

/** Minimal RFC 4180 CSV reader (quoted fields, doubled quotes, embedded newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseCost(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^free$/i.test(s)) return 0;
  const n = Number(s.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function parseProjects(rows: string[][]): Area[] {
  const cell = (r: string[], i: number) => (r[i] ?? '').trim();
  const start = rows.findIndex((r) => /^item\s*\/\s*space/i.test(cell(r, 0)));
  const areas: Area[] = [];
  let current: Area | null = null;
  const used = new Set<string>();

  for (const r of rows.slice(start + 1)) {
    const a = cell(r, 0);
    const b = cell(r, 1);
    const c = cell(r, 2);
    if (TOTAL_ROWS.test(a)) break;
    if (!a && !b && !c) {
      current = null; // blank row ends the group
      continue;
    }
    if (!current) {
      // heading row: "Name: note"
      const i = a.indexOf(':');
      const name = (i >= 0 ? a.slice(0, i) : a).replace(/\s+/g, ' ').trim();
      let key = slug(name) || 'area';
      while (used.has(key)) key += '-2';
      used.add(key);
      current = {
        key,
        name,
        note: i >= 0 ? a.slice(i + 1).replace(/\s+/g, ' ').trim() : '',
        section: HOUSE_AREAS.test(name) ? 'house' : 'rooms',
        items: [],
      };
      areas.push(current);
      if (!b && !c) continue;
      // a heading that carries a cost is also an item; fall through
    }
    const optional = /^optional\s*:/i.test(a);
    const closed = /^closed\s*:/i.test(a);
    const text = a.replace(/^(optional|closed)\s*:\s*/i, '').replace(/\s+/g, ' ').trim();
    const costB = parseCost(b);
    const costC = parseCost(c);
    const cost = costB ?? costC;
    current.items.push({
      text: text.charAt(0).toUpperCase() + text.slice(1),
      cost,
      costLabel: (costB !== null ? b : c).trim(),
      kind: costB !== null ? 'maintenance' : costC !== null ? 'furnishing' : null,
      done: cost !== null,
      optional,
      closed,
    });
  }
  return areas.filter((x) => x.items.length > 0);
}

// ── summaries ──────────────────────────────────────────────────────────────

export function areaStats(area: Area, showOptional = true) {
  const counted = area.items.filter((i) => !i.closed && (showOptional || !i.optional || i.done));
  const done = counted.filter((i) => i.done);
  return {
    total: counted.length,
    done: done.length,
    open: counted.length - done.length,
    spent: done.reduce((s, i) => s + (i.cost ?? 0), 0),
  };
}

export function totals(areas: Area[]) {
  const items = areas.flatMap((a) => a.items).filter((i) => !i.closed);
  const done = items.filter((i) => i.done);
  const open = items.filter((i) => !i.done);
  const sum = (xs: ProjectItem[]) => xs.reduce((s, i) => s + (i.cost ?? 0), 0);
  return {
    items: items.length,
    done: done.length,
    spent: sum(done),
    maintenance: sum(done.filter((i) => i.kind === 'maintenance')),
    furnishing: sum(done.filter((i) => i.kind === 'furnishing')),
    openNeeded: open.filter((i) => !i.optional).length,
    openOptional: open.filter((i) => i.optional).length,
  };
}
