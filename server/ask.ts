// "Ask the Policy" endpoint. Runs inside the Vite dev / preview server so the
// API key stays on this machine and never reaches the browser.

import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import type { Plugin } from 'vite';
import { askPolicy, describeError, type Turn } from '../src/askCore';

const POLICY = readFileSync(new URL('../policy/investment-policy.md', import.meta.url), 'utf8');

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function askPolicyPlugin(apiKey: string | undefined): Plugin {
  const client = apiKey ? new Anthropic({ apiKey }) : null;

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url !== '/api/ask' || req.method !== 'POST') return next();
    if (!client) return send(res, 503, { error: 'no-key' });

    try {
      const { question, history = [] } = JSON.parse(await readBody(req)) as { question: string; history?: Turn[] };
      if (!question?.trim()) return send(res, 400, { error: 'empty', message: 'Ask a question first.' });
      send(res, 200, { answer: await askPolicy(client, POLICY, question, history) });
    } catch (err) {
      console.error('[ask]', err);
      send(res, 502, { error: 'upstream', message: describeError(err) });
    }
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
