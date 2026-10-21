// Vercel function: GET /api/stock?symbol=AAPL&range=3mo
import { getStock } from './_lib/stock.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'GET only' });
  const [status, body] = await getStock(req.query.symbol, req.query.range);
  res.setHeader('Cache-Control', status === 200 ? 's-maxage=60, stale-while-revalidate=300' : 'no-store');
  res.status(status).json(body);
}
