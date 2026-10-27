// Live prices for HYPE, ZEC and AAPL, and the daily value of the liquid portfolio.
//
//  - HYPE and ZEC come from CoinGecko, which browsers may call directly.
//  - AAPL comes from Yahoo Finance through this site's server (/api/stock);
//    Yahoo doesn't allow browsers to call it directly.
// Anything that can't be fetched falls back to the latest review's price.

import { useEffect, useMemo, useState } from 'react';
import { holdings, reviews } from './data';
import { isoDay, type Asset, type LivePrices, type Quote, type Series } from './model';

const COINGECKO = 'https://api.coingecko.com/api/v3';
const COIN_IDS: Record<'hype' | 'zec', string> = { hype: 'hyperliquid', zec: 'zcash' };
const CACHE_KEY = 'browns.market.v1';
const QUOTE_EVERY = 60_000;
const HISTORY_EVERY = 30 * 60_000;

type History = [string, number][]; // [YYYY-MM-DD, close]
type Histories = Partial<Record<Asset, History>>;

export interface MarketState {
  live: LivePrices;
  histories: Histories;
  problems: Partial<Record<Asset, string>>;
  at: number | null; // last successful quote refresh
  /** ZEC priced in BTC, daily, for the ZEC sleeve's ratio chart (a little over 100 days, for the 20-day average) */
  zecBtc?: History;
  /** HYPE in USD, daily, about 300 days, for the HYPE chart's 100-day average */
  hypeLong?: History;
}

const firstDay = reviews[0].date;
const daysSince = (iso: string) => Math.max(1, Math.ceil((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86_400_000) + 1);

// ── fetchers ───────────────────────────────────────────────────────────────

async function json(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!(res.headers.get('content-type') ?? '').includes('json')) throw new Error('not json');
  return res.json();
}

async function cryptoQuotes(): Promise<LivePrices> {
  const ids = Object.values(COIN_IDS).join(',');
  const data = await json(`${COINGECKO}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`);
  const out: LivePrices = {};
  for (const [asset, id] of Object.entries(COIN_IDS) as ['hype' | 'zec', string][]) {
    const q = data?.[id];
    if (typeof q?.usd !== 'number') continue;
    out[asset] = {
      price: q.usd,
      change: typeof q.usd_24h_change === 'number' ? q.usd_24h_change / 100 : undefined,
      at: (q.last_updated_at ?? Date.now() / 1000) * 1000,
      source: 'CoinGecko',
    };
  }
  return out;
}

async function cryptoHistory(asset: 'hype' | 'zec'): Promise<History> {
  const data = await json(
    `${COINGECKO}/coins/${COIN_IDS[asset]}/market_chart?vs_currency=usd&days=${Math.min(365, daysSince(firstDay))}&interval=daily`,
  );
  const byDay = new Map<string, number>();
  for (const [ms, price] of (data?.prices ?? []) as [number, number][]) byDay.set(isoDay(new Date(ms)), price);
  return [...byDay.entries()].sort();
}

/** A coin's daily closes from CoinGecko, in any currency, over `days` days. */
async function dailyCloses(id: string, vs: string, days: number): Promise<History> {
  const data = await json(`${COINGECKO}/coins/${id}/market_chart?vs_currency=${vs}&days=${days}&interval=daily`);
  const byDay = new Map<string, number>();
  for (const [ms, price] of (data?.prices ?? []) as [number, number][]) byDay.set(isoDay(new Date(ms)), price);
  return [...byDay.entries()].sort();
}

/** AAPL via this site's server. Returns the quote and daily closes. */
async function stock(symbol: string): Promise<{ quote: Quote; history: History }> {
  const days = daysSince(firstDay);
  const range = days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 180 ? '6mo' : '1y';
  let res: Response;
  try {
    res = await fetch(`/api/stock?symbol=${symbol}&range=${range}`);
  } catch {
    throw new Error('needs the site’s server');
  }
  // no JSON means this site isn't running its server (e.g. a static copy)
  if (!(res.headers.get('content-type') ?? '').includes('json')) throw new Error('needs the site’s server');
  const data = await res.json();
  if (!res.ok || typeof data?.price !== 'number') throw new Error(data?.message ?? 'no price');
  const history: History = (data.points ?? []).map((p: [number, number]) => [isoDay(new Date(p[0])), p[1]] as [string, number]);
  return {
    quote: {
      price: data.price,
      change: typeof data.previousClose === 'number' && data.previousClose > 0 ? data.price / data.previousClose - 1 : undefined,
      at: data.at ?? Date.now(),
      source: 'Yahoo Finance',
    },
    history,
  };
}

// ── the daily portfolio line ───────────────────────────────────────────────

/** Price of an asset on a day: that day's close, else the most recent before it. */
function priceOn(history: History | undefined, day: string, fallback: number) {
  if (!history?.length) return fallback;
  let p = history[0][1];
  for (const [d, v] of history) {
    if (d > day) break;
    p = v;
  }
  return p;
}

/** Review price in effect on a day (used when an asset has no market history). */
function reviewPrice(asset: Asset, day: string) {
  let r = reviews[0];
  for (const x of reviews) if (x.date <= day) r = x;
  return asset === 'hype' ? r.hype.price : asset === 'zec' ? r.zec.price : r.aapl.price;
}

/**
 * Today's holdings valued at each day's prices, from the first review to today.
 * Cash, equities and Diversified are held at their current amounts.
 */
export function buildSeries(histories: Histories, live: LivePrices): Series | null {
  if (!histories.hype && !histories.zec && !histories.aapl) return null;
  const fixed =
    holdings.fortress.value + holdings.equities.value + holdings.diversified.voo + holdings.diversified.vxus + holdings.diversified.avuv;
  const today = isoDay(new Date());
  const out: Series = [];
  for (let d = new Date(firstDay + 'T00:00:00'); isoDay(d) <= today; d.setDate(d.getDate() + 1)) {
    const day = isoDay(d);
    const isToday = day === today;
    const px = (a: Asset) => (isToday && live[a] ? live[a]!.price : priceOn(histories[a], day, reviewPrice(a, day)));
    out.push({
      date: day,
      total: holdings.hype.tokens * px('hype') + holdings.zec.tokens * px('zec') + holdings.aapl.shares * px('aapl') + fixed,
    });
  }
  return out;
}

// ── hook ───────────────────────────────────────────────────────────────────

function loadCache(): MarketState {
  const empty: MarketState = { live: {}, histories: {}, problems: {}, at: null };
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return empty;
    const c = JSON.parse(raw) as MarketState;
    // a cache older than 12 hours isn't worth showing as "live"
    return c.at && Date.now() - c.at < 12 * 3_600_000 ? { ...c, problems: {} } : empty;
  } catch {
    return empty;
  }
}

export function useMarket() {
  const [state, setState] = useState<MarketState>(loadCache);

  useEffect(() => {
    let alive = true;
    const merge = (fn: (s: MarketState) => MarketState) => alive && setState((s) => fn(s));

    const refreshQuotes = async () => {
      const [crypto, aapl] = await Promise.allSettled([cryptoQuotes(), stock('AAPL')]);
      merge((s) => {
        const live = { ...s.live };
        const problems = { ...s.problems };
        if (crypto.status === 'fulfilled') {
          Object.assign(live, crypto.value);
          delete problems.hype;
          delete problems.zec;
        } else problems.hype = problems.zec = 'CoinGecko unreachable';
        const histories = { ...s.histories };
        if (aapl.status === 'fulfilled') {
          live.aapl = aapl.value.quote;
          if (aapl.value.history.length) histories.aapl = aapl.value.history;
          delete problems.aapl;
        } else problems.aapl = aapl.reason instanceof Error ? aapl.reason.message : 'unavailable';
        const ok = crypto.status === 'fulfilled' || aapl.status === 'fulfilled';
        return { ...s, live, histories, problems, at: ok ? Date.now() : s.at };
      });
    };

    const refreshHistory = async () => {
      const [h, z, zb, hl] = await Promise.allSettled([
        cryptoHistory('hype'),
        cryptoHistory('zec'),
        dailyCloses('zcash', 'btc', 120),
        dailyCloses('hyperliquid', 'usd', 300),
      ]);
      merge((s) => ({
        ...s,
        ...(hl.status === 'fulfilled' && hl.value.length ? { hypeLong: hl.value } : {}),
        ...(zb.status === 'fulfilled' && zb.value.length ? { zecBtc: zb.value } : {}),
        histories: {
          ...s.histories,
          ...(h.status === 'fulfilled' && h.value.length ? { hype: h.value } : {}),
          ...(z.status === 'fulfilled' && z.value.length ? { zec: z.value } : {}),
        },
      }));
    };

    refreshQuotes();
    refreshHistory();
    const q = setInterval(refreshQuotes, QUOTE_EVERY);
    const hst = setInterval(refreshHistory, HISTORY_EVERY);
    return () => {
      alive = false;
      clearInterval(q);
      clearInterval(hst);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(state));
    } catch {
      /* private mode: no cache */
    }
  }, [state]);

  const series = useMemo(() => buildSeries(state.histories, state.live), [state.histories, state.live]);
  return { ...state, series };
}
