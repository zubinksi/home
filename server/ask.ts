// Local copy of the Vercel function api/ask.js, for `npm run dev` / `preview`.
// The API key comes from .env.local and never reaches the browser.

import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import type { Plugin } from 'vite';
import { answerRequest } from '../api/_lib/ask.js';
import { send } from './send';

const POLICY = readFileSync(new URL('../policy/investment-policy.md', import.meta.url), 'utf8');

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function askPolicyPlugin(apiKey: string | undefined): Plugin {
  const client = apiKey ? new Anthropic({ apiKey }) : null;

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url !== '/api/ask' || req.method !== 'POST') return next();
    let body: unknown;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, { error: 'bad-json', message: 'Bad request.' });
    }
    const [status, out] = await answerRequest(client, POLICY, body);
    send(res, status, out);
  };

  return {
    name: 'ask-policy',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
