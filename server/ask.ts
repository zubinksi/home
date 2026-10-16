// "Ask the Policy" endpoint. Runs inside the Vite dev / preview server so the
// API key stays on this machine and never reaches the browser.

import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import type { Plugin } from 'vite';
import { stateForPrompt } from '../src/model';

const POLICY = readFileSync(new URL('../policy/investment-policy.md', import.meta.url), 'utf8');

const INSTRUCTIONS = `You answer questions for Yitz and Genesha about their household investment policy statement.

Answer in 2–4 plain sentences. Quote the governing policy line (in quotation marks) and name the sleeve it governs. Use the current state below when the question depends on numbers. If the policy does not cover the question, say so plainly and suggest raising it at the annual review rather than inventing a rule. Never suggest changing the rules during a downturn. You are not giving tax or legal advice; where the policy defers to the CPA, say so. No markdown headings or bullet lists.`;

type Turn = { who: 'you' | 'policy'; text: string };

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

export function askPolicy(apiKey: string | undefined): Plugin {
  const client = apiKey ? new Anthropic({ apiKey }) : null;

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url !== '/api/ask' || req.method !== 'POST') return next();
    if (!client) return send(res, 503, { error: 'no-key' });

    try {
      const { question, history = [] } = JSON.parse(await readBody(req)) as { question: string; history?: Turn[] };
      if (!question?.trim()) return send(res, 400, { error: 'empty' });

      const messages: Anthropic.Beta.BetaMessageParam[] = history
        .slice(-6)
        .map((t) => ({ role: t.who === 'you' ? ('user' as const) : ('assistant' as const), content: t.text }));
      messages.push({ role: 'user', content: question });

      const response = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 4000,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [
          { type: 'text', text: INSTRUCTIONS },
          { type: 'text', text: `<policy>\n${POLICY}\n</policy>`, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `<current_state>\n${stateForPrompt()}\n</current_state>` },
        ],
        messages,
      });

      if (response.stop_reason === 'refusal') return send(res, 200, { answer: 'I can’t answer that one. Try rephrasing it as a question about the policy.' });
      const answer = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      send(res, 200, { answer });
    } catch (err) {
      console.error('[ask]', err);
      send(res, 502, { error: 'upstream' });
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
