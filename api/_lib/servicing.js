// The servicing log: the "Servicing log" tab of the "Home Projects & Vendors"
// sheet, shared by the Vercel function (api/service-log.js) and the local dev
// server (server/servicing.ts).
//
// Reading needs only the sheet's "Anyone with the link can view" sharing.
// Writing goes through the Apps Script bound to the sheet (./script.js), since
// only its owner can write to it.

import { callScript } from './script.js';

const SHEET_ID = '1R_doMt_LPphYMpvX98ruz6jFJzynsiBUEeJUb039G1I';
export const SERVICE_LOG_GID = 731905;
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SERVICE_LOG_GID}`;

const CACHE_MS = 60_000;
let cache = null;

/**
 * Returns [status, body].
 * @returns {Promise<[number, object]>}
 */
export async function getServiceLog(fresh = false) {
  if (cache && !fresh && Date.now() - cache.at < CACHE_MS) return [200, { csv: cache.csv, fetchedAt: cache.at }];
  try {
    const r = await fetch(CSV_URL, { redirect: 'follow' });
    const text = await r.text();
    // a private sheet answers with Google's sign-in page, not CSV
    if (!r.ok || /<html/i.test(text.slice(0, 500))) {
      return [502, { error: 'sheet', message: r.ok ? 'The sheet isn’t shared by link.' : `Google returned ${r.status}.` }];
    }
    cache = { at: Date.now(), csv: text };
    return [200, { csv: text, fetchedAt: cache.at }];
  } catch (err) {
    console.error('[service-log]', err);
    return [502, { error: 'network', message: 'Couldn’t reach Google Sheets.' }];
  }
}

const DAY = 86_400_000;

/**
 * Adds a row to the log: { id, job, date: 'YYYY-MM-DD', note? }.
 * @param {unknown} input
 * @param {{ url?: string, token?: string }} config
 * @returns {Promise<[number, object]>}
 */
export async function logService(input, config) {
  const { id, job, date, note = '' } = /** @type {any} */ (input ?? {});
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(id)) return [400, { message: 'Which job?' }];
  if (typeof job !== 'string' || !job.trim() || job.length > 120) return [400, { message: 'Which job?' }];
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return [400, { message: 'That date doesn’t look right.' }];
  }
  // a day's slack for time zones; nothing logged ahead of time, nor from long ago
  const t = Date.parse(date);
  if (t > Date.now() + DAY || t < Date.now() - 3 * 365 * DAY) return [400, { message: 'That date doesn’t look right.' }];
  if (typeof note !== 'string' || note.length > 200) return [400, { message: 'The note is too long.' }];

  const [status, body] = await callScript(config, { id, job: job.trim(), date, note: note.trim() });
  if (status === 200) cache = null; // the next read sees the new row
  return [status, body];
}
