// Local copy of the Vercel function api/projects.js, for `npm run dev` / `preview`.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { changeProjects, getProjects } from '../api/_lib/projects.js';
import { send } from './send';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function projectsPlugin(config: { url?: string; token?: string }): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/projects')) return next();
    if (req.method === 'POST') {
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return send(res, 400, { error: 'bad-json', message: 'Bad request.' });
      }
      const [status, out] = await changeProjects(body, config);
      return send(res, status, out);
    }
    if (req.method !== 'GET') return next();
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
