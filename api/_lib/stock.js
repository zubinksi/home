// Stock quotes from Yahoo Finance, shared by the Vercel function (api/stock.js)
// and the local dev server (server/stock.ts). Yahoo doesn't allow browsers to
// call it, so a server fetches on the page's behalf. No API key needed.

const CACHE_MS = 60_000;
const cache = new Map();

/** Quote + daily closes from Yahoo's chart response. */
export function readYahoo(data) {
  const r = data?.chart?.result?.[0];
  const price = r?.meta?.regularMarketPrice;
  if (!r || typeof price !== 'number') throw new Error(data?.chart?.error?.description ?? 'No price in response');
  const ts = r.timestamp ?? [];
  const closes = r.indicators?.quote?.[0]?.close ?? [];
  const points = ts.map((t, i) => [t * 1000, closes[i]]).filter((p) => p[1] != null);
  // previous session's close: the last daily close before today's session
  const at = (r.meta?.regularMarketTime ?? Date.now() / 1000) * 1000;
  const sessionDay = new Date(at).toDateString();
  const before = points.filter((p) => new Date(p[0]).toDateString() !== sessionDay);
  const previousClose = before.length ? before[before.length - 1][1] : r.meta?.previousClose;
  return { price, previousClose, at, points };
}

/**
 * Returns [status, body] for a symbol and range from the query string.
 * @returns {Promise<[number, object]>}
 */
export async function getStock(symbolParam, rangeParam) {
  const symbol = String(symbolParam ?? '').toUpperCase();
  const range = String(rangeParam ?? '3mo');
  if (!/^[A-Z.]{1,8}$/.test(symbol) || !/^(1mo|3mo|6mo|1y)$/.test(range)) return [400, { message: 'Bad symbol or range' }];

  const key = `${symbol}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return [200, hit.body];
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (household-site)' },
    });
    if (!r.ok) return [502, { message: `Yahoo returned ${r.status}` }];
    const body = readYahoo(await r.json());
    cache.set(key, { at: Date.now(), body });
    return [200, body];
  } catch (err) {
    console.error('[stock]', err);
    return [502, { message: 'Couldn’t reach Yahoo Finance' }];
  }
}
