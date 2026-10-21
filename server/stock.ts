// Stock quotes for the Investments page. Yahoo Finance doesn't allow browsers
// to call it, so this server fetches on the page's behalf. No API key needed.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; body: unknown }>();

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

interface YahooChart {
  chart?: {
    result?: {
      meta?: { regularMarketPrice?: number; regularMarketTime?: number; previousClose?: number; chartPreviousClose?: number };
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

/** Quote + daily closes from Yahoo's chart response. Exported for tests. */
export function readYahoo(data: YahooChart) {
  const r = data.chart?.result?.[0];
  const price = r?.meta?.regularMarketPrice;
  if (!r || typeof price !== 'number') throw new Error(data.chart?.error?.description ?? 'No price in response');
  const ts = r.timestamp ?? [];
  const closes = r.indicators?.quote?.[0]?.close ?? [];
  const points = ts.map((t, i) => [t * 1000, closes[i]] as [number, number | null]).filter((p): p is [number, number] => p[1] != null);
  // previous session's close: the last daily close before today's session
  const at = (r.meta?.regularMarketTime ?? Date.now() / 1000) * 1000;
  const sessionDay = new Date(at).toDateString();
  const before = points.filter((p) => new Date(p[0]).toDateString() !== sessionDay);
  const previousClose = before.length ? before[before.length - 1][1] : r.meta?.previousClose;
  return { price, previousClose, at, points };
}

export function stockPlugin(): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/stock') || req.method !== 'GET') return next();
    const url = new URL(req.url, 'http://local');
    const symbol = (url.searchParams.get('symbol') ?? '').toUpperCase();
    const range = url.searchParams.get('range') ?? '3mo';
    if (!/^[A-Z.]{1,8}$/.test(symbol) || !/^(1mo|3mo|6mo|1y)$/.test(range)) return send(res, 400, { message: 'Bad symbol or range' });

    const key = `${symbol}:${range}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return send(res, 200, hit.body);
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (household-site)' },
      });
      if (!r.ok) return send(res, 502, { message: `Yahoo returned ${r.status}` });
      const body = readYahoo((await r.json()) as YahooChart);
      cache.set(key, { at: Date.now(), body });
      send(res, 200, body);
    } catch (err) {
      console.error('[stock]', err);
      send(res, 502, { message: 'Couldn’t reach Yahoo Finance' });
    }
  };
  return {
    name: 'stock-quotes',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
