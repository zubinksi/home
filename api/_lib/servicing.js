// The servicing log: the "Servicing log" tab of the "Home Projects & Vendors"
// sheet, shared by the Vercel function (api/service-log.js) and the local dev
// server (server/servicing.ts).
//
// Reading needs only the sheet's "Anyone with the link can view" sharing.
// Writing goes through a small Apps Script bound to the sheet (see
// scripts/servicing-log.gs and the README), since only its owner can write to
// it: set SERVICE_LOG_SCRIPT_URL to the script's web app URL and
// SERVICE_LOG_TOKEN to the token saved in the script's properties.

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

  if (!config.url || !config.token) {
    return [501, { error: 'not-set-up', message: 'Logging isn’t set up yet: the sheet’s script isn’t connected.' }];
  }
  try {
    // Apps Script answers a POST with a redirect to its result, which fetch follows
    const r = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ token: config.token, id, job: job.trim(), date, note: note.trim() }),
      redirect: 'follow',
    });
    const text = await r.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* not JSON: the script isn't deployed for anyone to call, or errored */
    }
    if (!r.ok || !body?.ok) {
      return [502, { error: 'script', message: body?.message ?? 'The sheet’s script didn’t accept it.' }];
    }
    cache = null; // the next read sees the new row
    return [200, { ok: true }];
  } catch (err) {
    console.error('[service-log]', err);
    return [502, { error: 'network', message: 'Couldn’t reach the sheet’s script.' }];
  }
}
