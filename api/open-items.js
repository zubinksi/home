// Vercel function: GET /api/open-items — the "Open items" tab's CSV;
// POST /api/open-items { id, text, done } — ticks or unticks an item.
import { getOpenItems, setOpenItem } from './_lib/items.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const [status, body] = await getOpenItems();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(status).json(body);
  }
  if (req.method === 'POST') {
    const [status, body] = await setOpenItem(req.body, {
      url: process.env.SERVICE_LOG_SCRIPT_URL,
      token: process.env.SERVICE_LOG_TOKEN,
    });
    return res.status(status).json(body);
  }
  res.status(405).json({ message: 'GET or POST only' });
}
