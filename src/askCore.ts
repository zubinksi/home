// The "Ask the Policy" call for the in-browser fallback (src/Ask.tsx), used when
// the site's server has no key. The call itself lives in api/_lib/ask.js.

import type Anthropic from '@anthropic-ai/sdk';
import { askClaude, describeError } from '../api/_lib/ask.js';

export type Turn = { who: 'you' | 'policy'; text: string };
export { describeError };

export function askPolicy(client: Anthropic, policy: string, question: string, history: Turn[], state: string): Promise<string> {
  return askClaude(client, { policy, state, question, history });
}
