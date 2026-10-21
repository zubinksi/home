// Reads the live "Home Projects & Vendors" sheet as CSV, shared by the Vercel
// function (api/projects.js) and the local dev server (server/projects.ts).
// Requires the sheet to be shared "Anyone with the link can view".

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
