// Vercel function: POST /api/ask. Only answers when ANTHROPIC_API_KEY is set in
// the Vercel project; otherwise the page falls back to a key saved in the browser.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { answerRequest } from './_lib/ask.js';

// bundled with the function via "includeFiles" in vercel.json
const POLICY = readFileSync(join(process.cwd(), 'policy', 'investment-policy.md'), 'utf8');
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'POST only' });
  const [status, body] = await answerRequest(client, POLICY, req.body);
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
