// "Projects" endpoint: reads the live Google Sheet on this machine and hands
// the browser its CSV. Browsers can't read the sheet directly (no CORS), so the
// dev / preview server does it. Requires the sheet to be shared "Anyone with
// the link can view".

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { PROJECTS_SHEET_CSV_URL } from '../src/projectsSource';

const CACHE_MS = 60_000;
let cache: { at: number; csv: string } | null = null;

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function projectsPlugin(): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/projects') || req.method !== 'GET') return next();
    const fresh = req.url.includes('fresh=1');
    if (cache && !fresh && Date.now() - cache.at < CACHE_MS) return send(res, 200, { csv: cache.csv, fetchedAt: cache.at });
    try {
      const r = await fetch(PROJECTS_SHEET_CSV_URL, { redirect: 'follow' });
      const text = await r.text();
      // a private sheet answers with Google's sign-in page, not CSV
      if (!r.ok || /<html/i.test(text.slice(0, 500))) {
        return send(res, 502, { error: 'sheet', message: r.ok ? 'The sheet isn’t shared by link.' : `Google returned ${r.status}.` });
      }
      cache = { at: Date.now(), csv: text };
      send(res, 200, { csv: text, fetchedAt: cache.at });
    } catch (err) {
      console.error('[projects]', err);
      send(res, 502, { error: 'network', message: 'Couldn’t reach Google Sheets.' });
    }
  };

  return {
    name: 'projects-sheet',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
