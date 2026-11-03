// Which open items are done, kept in the "Open items" tab of the projects sheet
// so a tick shows on every device. Each tick or untick is saved through the
// sheet's script (/api/open-items); the page reads the tab back when it loads,
// and keeps a copy on the device so the list shows at once.

import { useCallback, useEffect, useState } from 'react';
import type { Item } from './model';
import { parseCsv } from './projectsModel';
import { PROJECTS_SHEET_ID } from './projectsSource';

const KEY = 'browns.done.v2';
const OLD_KEY = 'browns.done.v1'; // ticks from before, on this device only
/** The tab, read straight from Google (when there's no server). */
const DIRECT_URL = `https://docs.google.com/spreadsheets/d/${PROJECTS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Open items')}&headers=1`;

function cached(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
function cache(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* private mode: the sheet still has it */
  }
}

/** The tab's rows (When, Item ID, Item, Done), the latest for each item winning. */
function readLog(csv: string): string[] | null {
  const rows = parseCsv(csv);
  const head = (rows[0] ?? []).map((c) => c.trim().toLowerCase());
  // Google answers with the first tab if there's no "Open items" yet
  if (head[1] !== 'item id' || head[3] !== 'done') return rows.length <= 1 && !head[0] ? [] : null;
  const state = new Map<string, boolean>();
  for (const r of rows.slice(1)) if (r[1]?.trim()) state.set(r[1].trim(), r[3]?.trim().toUpperCase() === 'TRUE');
  return [...state].filter(([, d]) => d).map(([id]) => id);
}

async function load(): Promise<string[] | null> {
  try {
    const res = await fetch('/api/open-items');
    if ((res.headers.get('content-type') ?? '').includes('json')) {
      const data = await res.json();
      if (res.ok && typeof data?.csv === 'string') return readLog(data.csv);
    }
  } catch {
    /* no server: try Google directly */
  }
  try {
    const res = await fetch(DIRECT_URL);
    const text = await res.text();
    return res.ok && !/<html/i.test(text.slice(0, 500)) ? readLog(text) : null;
  } catch {
    return null;
  }
}

async function save(item: Item, done: boolean): Promise<string | null> {
  try {
    const res = await fetch('/api/open-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, text: item.text, done }),
    });
    const data = (res.headers.get('content-type') ?? '').includes('json') ? await res.json() : null;
    return res.ok && data?.ok ? null : (data?.message ?? 'Couldn’t save it to the sheet.');
  } catch {
    return 'Couldn’t reach the server.';
  }
}

/** Ticks from the old, position-based list on this device, as today's item ids. */
function oldTicks(items: Item[]): string[] {
  try {
    const old: string[] = JSON.parse(localStorage.getItem(OLD_KEY) ?? '[]');
    return items.filter((i) => i.oldId && old.includes(i.oldId)).map((i) => i.id);
  } catch {
    return [];
  }
}

/** The done items, shared across devices, and a way to tick or untick one. */
export function useDoneItems(items: Item[]) {
  const [done, setDone] = useState<string[]>(cached);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const fromSheet = await load();
      if (!live || fromSheet === null) return;
      setDone(fromSheet);
      cache(fromSheet);
      // ticks this device made before they were shared go up to the sheet once
      const carry = oldTicks(items).filter((id) => !fromSheet.includes(id));
      if (!carry.length) {
        try {
          localStorage.removeItem(OLD_KEY);
        } catch {
          /* fine */
        }
        return;
      }
      for (const id of carry) {
        const it = items.find((i) => i.id === id)!;
        if ((await save(it, true)) !== null) return; // try again next visit
        if (!live) return;
        setDone((d) => (d.includes(id) ? d : [...d, id]));
      }
      try {
        localStorage.removeItem(OLD_KEY);
      } catch {
        /* fine */
      }
    })();
    return () => {
      live = false;
    };
    // the items' ids are stable, so this runs once, when the page loads
  }, []);

  const toggle = useCallback(async (item: Item, to: boolean) => {
    setProblem(null);
    const apply = (on: boolean) =>
      setDone((d) => {
        const next = on ? [...d.filter((x) => x !== item.id), item.id] : d.filter((x) => x !== item.id);
        cache(next);
        return next;
      });
    apply(to);
    const failed = await save(item, to);
    if (failed) {
      apply(!to);
      setProblem(failed);
    }
  }, []);

  return { done, toggle, problem };
}
