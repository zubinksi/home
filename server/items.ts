// Local copy of the Vercel function api/open-items.js, for `npm run dev` / `preview`.
// The script's URL and token come from .env.local and never reach the browser.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { getOpenItems, setOpenItem } from '../api/_lib/items.js';
import { send } from './send';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function openItemsPlugin(config: { url?: string; token?: string }): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/open-items')) return next();
    if (req.method === 'GET') {
      const [status, body] = await getOpenItems();
      return send(res, status, body);
    }
    if (req.method !== 'POST') return next();
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, { error: 'bad-json', message: 'Bad request.' });
    }
    const [status, out] = await setOpenItem(body, config);
    send(res, status, out);
  };
  return {
    name: 'open-items',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
