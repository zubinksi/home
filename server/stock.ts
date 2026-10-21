// Local copy of the Vercel function api/stock.js, for `npm run dev` / `preview`.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { getStock } from '../api/_lib/stock.js';
import { send } from './send';

export function stockPlugin(): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/stock') || req.method !== 'GET') return next();
    const url = new URL(req.url, 'http://local');
    const [status, body] = await getStock(url.searchParams.get('symbol'), url.searchParams.get('range'));
    send(res, status, body);
  };
  return {
    name: 'stock-quotes',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
