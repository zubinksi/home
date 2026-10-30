// Vercel function: GET /api/service-log — the servicing log tab's CSV;
// POST /api/service-log { id, job, date, note? } — adds a row to it.
import { getServiceLog, logService } from './_lib/servicing.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const [status, body] = await getServiceLog(req.query.fresh === '1');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(status).json(body);
  }
  if (req.method === 'POST') {
    const [status, body] = await logService(req.body, {
      url: process.env.SERVICE_LOG_SCRIPT_URL,
      token: process.env.SERVICE_LOG_TOKEN,
    });
    return res.status(status).json(body);
  }
  res.status(405).json({ message: 'GET or POST only' });
}
