// The "Ask the Policy" call, shared by the Vercel function (api/ask.js), the
// local dev server (server/ask.ts) and the in-browser fallback (src/askCore.ts).

import Anthropic from '@anthropic-ai/sdk';

const INSTRUCTIONS = `You answer questions for Yitz and Genesha about their household investment policy statement.

Answer in 2–4 plain sentences. Quote the governing policy line (in quotation marks) and name the sleeve it governs. Use the current state below when the question depends on numbers. If the policy does not cover the question, say so plainly and suggest raising it at the annual review rather than inventing a rule. Never suggest changing the rules during a downturn. You are not giving tax or legal advice; where the policy defers to the CPA, say so. No markdown headings or bullet lists.`;

/**
 * @param {Anthropic} client
 * @param {{ policy: string, state: string, question: string, history: { who: 'you' | 'policy', text: string }[] }} input
 * @returns {Promise<string>}
 */
export async function askClaude(client, { policy, state, question, history }) {
  const messages = history.slice(-6).map((t) => ({ role: t.who === 'you' ? 'user' : 'assistant', content: t.text }));
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
      { type: 'text', text: `<current_state>\n${state}\n</current_state>` },
    ],
    messages,
  });

  if (response.stop_reason === 'refusal') return 'I can’t answer that one. Try rephrasing it as a question about the policy.';
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/** A short, human-readable reason for a failed call. */
export function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'The API key was rejected (401). Check the key and try again.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'This API key doesn’t have access to the model (403).';
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited (429). Wait a moment and ask again.';
  if (err instanceof Anthropic.BadRequestError) return `The request was rejected (400): ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return 'Couldn’t connect to the Anthropic API. Check the network connection.';
  if (err instanceof Anthropic.APIError) return `The Anthropic API returned an error (${err.status ?? '?'}): ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

/**
 * Validates a POST body from the page and answers it. Returns [status, body].
 * @param {Anthropic | null} client
 * @param {string} policy
 * @param {unknown} body
 * @returns {Promise<[number, object]>}
 */
export async function answerRequest(client, policy, body) {
  if (!client) return [503, { error: 'no-key' }];
  const { question, history, state } = /** @type {any} */ (body ?? {});
  if (typeof question !== 'string' || !question.trim()) return [400, { error: 'empty', message: 'Ask a question first.' }];
  // keep requests household-sized
  if (question.length > 2000 || (typeof state === 'string' && state.length > 10_000)) {
    return [400, { error: 'too-long', message: 'That question is too long.' }];
  }
  const turns = Array.isArray(history)
    ? history.filter((t) => t && typeof t.text === 'string' && (t.who === 'you' || t.who === 'policy')).map((t) => ({ who: t.who, text: t.text.slice(0, 4000) }))
    : [];
  try {
    return [200, { answer: await askClaude(client, { policy, state: typeof state === 'string' ? state : '', question, history: turns }) }];
  } catch (err) {
    console.error('[ask]', err);
    return [502, { error: 'upstream', message: describeError(err) }];
  }
}
