// The "Ask the Policy" call, shared by the local server (server/ask.ts) and the
// in-browser fallback (src/Ask.tsx) used when no server endpoint is available.

import Anthropic from '@anthropic-ai/sdk';
import { stateForPrompt } from './model';

export type Turn = { who: 'you' | 'policy'; text: string };

const INSTRUCTIONS = `You answer questions for Yitz and Genesha about their household investment policy statement.

Answer in 2–4 plain sentences. Quote the governing policy line (in quotation marks) and name the sleeve it governs. Use the current state below when the question depends on numbers. If the policy does not cover the question, say so plainly and suggest raising it at the annual review rather than inventing a rule. Never suggest changing the rules during a downturn. You are not giving tax or legal advice; where the policy defers to the CPA, say so. No markdown headings or bullet lists.`;

export async function askPolicy(client: Anthropic, policy: string, question: string, history: Turn[]): Promise<string> {
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
      { type: 'text', text: `<policy>\n${policy}\n</policy>`, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `<current_state>\n${stateForPrompt()}\n</current_state>` },
    ],
    messages,
  });

  if (response.stop_reason === 'refusal') return 'I can’t answer that one. Try rephrasing it as a question about the policy.';
  return response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/** A short, human-readable reason for a failed call. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'The API key was rejected (401). Check the key and try again.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'This API key doesn’t have access to the model (403).';
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited (429). Wait a moment and ask again.';
  if (err instanceof Anthropic.BadRequestError) return `The request was rejected (400): ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return 'Couldn’t connect to the Anthropic API. Check the network connection.';
  if (err instanceof Anthropic.APIError) return `The Anthropic API returned an error (${err.status ?? '?'}): ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
