// Vercel function: GET /api/projects — the live sheet's CSV.
import { getProjects } from './_lib/projects.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'GET only' });
  const [status, body] = await getProjects(req.query.fresh === '1');
  res.setHeader('Cache-Control', status === 200 ? 's-maxage=60, stale-while-revalidate=300' : 'no-store');
  res.status(status).json(body);
}
