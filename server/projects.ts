// Local copy of the Vercel function api/projects.js, for `npm run dev` / `preview`.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { getProjects } from '../api/_lib/projects.js';
import { send } from './send';

export function projectsPlugin(): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/projects') || req.method !== 'GET') return next();
    const [status, body] = await getProjects(req.url.includes('fresh=1'));
    send(res, status, body);
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
