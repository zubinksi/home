// Vercel function: GET /api/projects — the live sheet's CSV;
// POST /api/projects — a change to it (a quote, an item done, a new item).
import { changeProjects, getProjects } from './_lib/projects.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const [status, body] = await changeProjects(req.body, {
      url: process.env.SERVICE_LOG_SCRIPT_URL,
      token: process.env.SERVICE_LOG_TOKEN,
    });
    return res.status(status).json(body);
  }
  if (req.method !== 'GET') return res.status(405).json({ message: 'GET or POST only' });
  const [status, body] = await getProjects(req.query.fresh === '1');
  res.setHeader('Cache-Control', status === 200 ? 's-maxage=60, stale-while-revalidate=300' : 'no-store');
  res.status(status).json(body);
}
