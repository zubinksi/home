// Reads the live "Home Projects & Vendors" sheet as CSV, shared by the Vercel
// function (api/projects.js) and the local dev server (server/projects.ts).
// Requires the sheet to be shared "Anyone with the link can view". Changes
// (a quote, an item done, a new item) go through the sheet's script.

import { callScript } from './script.js';

const SHEET_ID = '1R_doMt_LPphYMpvX98ruz6jFJzynsiBUEeJUb039G1I';
export const PROJECTS_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

const CACHE_MS = 60_000;
let cache = null;

/**
 * Returns [status, body].
 * @returns {Promise<[number, object]>}
 */
export async function getProjects(fresh = false) {
  if (cache && !fresh && Date.now() - cache.at < CACHE_MS) return [200, { csv: cache.csv, fetchedAt: cache.at }];
  try {
    const r = await fetch(PROJECTS_SHEET_CSV_URL, { redirect: 'follow' });
    const text = await r.text();
    // a private sheet answers with Google's sign-in page, not CSV
    if (!r.ok || /<html/i.test(text.slice(0, 500))) {
      return [502, { error: 'sheet', message: r.ok ? 'The sheet isn’t shared by link.' : `Google returned ${r.status}.` }];
    }
    cache = { at: Date.now(), csv: text };
    return [200, { csv: text, fetchedAt: cache.at }];
  } catch (err) {
    console.error('[projects]', err);
    return [502, { error: 'network', message: 'Couldn’t reach Google Sheets.' }];
  }
}

const text = (v, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const row = (v) => Number.isInteger(v) && v >= 4 && v <= 5000;
const amount = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10_000_000;

/**
 * Changes the Projects tab. One of:
 *   { action: 'quote', row, raw, quote }               a quote for a to-do (null clears it)
 *   { action: 'done', row, raw, kind, cost }            done: the cost in its column (0 = free)
 *   { action: 'add', afterRow, afterRaw, text, optional, quote? }   a new item at the end of an area
 * `raw` / `afterRaw` is column A as the page read it; the script checks the row
 * still holds it before writing, so a sheet edited meanwhile can't be written
 * into the wrong row.
 * @param {unknown} input
 * @param {{ url?: string, token?: string }} config
 * @returns {Promise<[number, object]>}
 */
export async function changeProjects(input, config) {
  const b = /** @type {any} */ (input ?? {});
  let payload;
  if (b.action === 'quote' && row(b.row) && text(b.raw) && (b.quote === null || amount(b.quote))) {
    payload = { kind: 'project', action: 'quote', row: b.row, raw: b.raw, quote: b.quote };
  } else if (b.action === 'done' && row(b.row) && text(b.raw) && (b.kind === 'maintenance' || b.kind === 'furnishing') && amount(b.cost)) {
    payload = { kind: 'project', action: 'done', row: b.row, raw: b.raw, column: b.kind === 'maintenance' ? 2 : 3, cost: b.cost };
  } else if (b.action === 'add' && row(b.afterRow) && text(b.afterRaw) && text(b.text, 160) && (b.quote == null || amount(b.quote))) {
    payload = { kind: 'project', action: 'add', afterRow: b.afterRow, afterRaw: b.afterRaw, text: b.text.trim(), optional: !!b.optional, quote: b.quote ?? null };
  } else {
    return [400, { message: 'That change doesn’t look right.' }];
  }
  const [status, body] = await callScript(config, payload);
  if (status === 200) cache = null; // the next read sees the change
  return [status, body];
}
