// Which open items are done: the "Open items" tab of the "Home Projects &
// Vendors" sheet, shared by the Vercel function (api/open-items.js) and the
// local dev server (server/items.ts). The tab is a log, one row per tick or
// untick (When, Item ID, Item, Done); the latest row for an item wins. The
// sheet's script makes the tab the first time something is ticked.

import { callScript } from './script.js';

const SHEET_ID = '1R_doMt_LPphYMpvX98ruz6jFJzynsiBUEeJUb039G1I';
// by name, since the script makes the tab; Google answers with the first tab
// if there's none by that name, so the reader checks the header
export const OPEN_ITEMS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Open items')}&headers=1`;

/**
 * Returns [status, body].
 * @returns {Promise<[number, object]>}
 */
export async function getOpenItems() {
  try {
    const r = await fetch(OPEN_ITEMS_CSV_URL, { redirect: 'follow' });
    const text = await r.text();
    // a private sheet answers with Google's sign-in page, not CSV
    if (!r.ok || /<html/i.test(text.slice(0, 500))) {
      return [502, { error: 'sheet', message: r.ok ? 'The sheet isn’t shared by link.' : `Google returned ${r.status}.` }];
    }
    return [200, { csv: text, fetchedAt: Date.now() }];
  } catch (err) {
    console.error('[open-items]', err);
    return [502, { error: 'network', message: 'Couldn’t reach Google Sheets.' }];
  }
}

/**
 * Ticks or unticks an item: { id, text, done }.
 * @param {unknown} input
 * @param {{ url?: string, token?: string }} config
 * @returns {Promise<[number, object]>}
 */
export async function setOpenItem(input, config) {
  const { id, text, done } = /** @type {any} */ (input ?? {});
  if (typeof id !== 'string' || !/^[A-Za-z0-9:@._-]{1,120}$/.test(id)) return [400, { message: 'Which item?' }];
  if (typeof text !== 'string' || !text.trim() || text.length > 400) return [400, { message: 'Which item?' }];
  if (typeof done !== 'boolean') return [400, { message: 'Bad request.' }];
  return callScript(config, { kind: 'item', id, text: text.trim(), done });
}
