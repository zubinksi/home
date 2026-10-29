// Live prices for HYPE, ZEC, AAPL and the Equities positions, and the daily
// value of the liquid portfolio.
//
//  - HYPE and ZEC come from CoinGecko, which browsers may call directly.
//  - AAPL and the Equities stocks come from Yahoo Finance through this site's
//    server (/api/stock); Yahoo doesn't allow browsers to call it directly.
// Anything that can't be fetched falls back to the latest review's price.

import { useEffect, useMemo, useRef, useState } from 'react';
import { equitiesSince, holdings, reviews } from './data';
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
  /** HYPE in USD, daily, a year back (the HYPE chart, and HYPE / LIT) */
  hypeLong?: History;
  /** daily closes for each Equities position, by ticker */
  stockHistories?: Record<string, History>;
  /** daily series for the HYPE and ZEC comparison charts, a year back (charted weekly) */
  comparisons?: Comparisons;
  comparisonsAt?: number;
}

export interface Comparisons {
  /** Lighter's LIT in USD */
  lit?: History;
  /** ZEC priced in BTC */
  zecBtc?: History;
  /** HYPE's market cap */
  hypeCap?: History;
  /** the whole crypto market's cap, approximated as the top coins' caps summed */
  totalCap?: History;
  /** each stand-in coin's market cap, kept as they arrive so the total can build up over visits */
  caps?: Record<string, History>;
  /** when each series above was last fetched */
  fetchedAt?: Record<string, number>;
}

/** CoinGecko id for Lighter's token. */
const LIGHTER_ID = 'lighter';
/**
 * CoinGecko's free API has no history of the total crypto market cap, so the
 * six largest coins stand in for it (together most of the market).
 */
const TOTAL_PROXY = ['bitcoin', 'ethereum', 'tether', 'ripple', 'binancecoin', 'solana'];
const COMPARISONS_EVERY = 6 * 3_600_000;
/** CoinGecko's free tier allows about five calls a minute, shared with the live quotes */
const COMPARISON_GAP = 13_000;
/** if a round comes back incomplete, try again this much later */
const COMPARISONS_RETRY = 10 * 60_000;
// a year: as far back as CoinGecko's free tier goes, for a weekly chart with a 20-week average
const COMPARISON_DAYS = 365;

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

/** A coin's daily market caps from CoinGecko, in USD, over `days` days. */
async function dailyCaps(id: string, days: number): Promise<History> {
  const data = await json(`${COINGECKO}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`);
  const byDay = new Map<string, number>();
  for (const [ms, cap] of (data?.market_caps ?? []) as [number, number][]) byDay.set(isoDay(new Date(ms)), cap);
  return [...byDay.entries()].sort();
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The comparison charts' series. CoinGecko's free tier allows only a few calls
 * a minute, so these go one at a time with a pause between, a few times a day.
 */
async function fetchComparisons(have: Comparisons, put: (c: Comparisons) => void): Promise<boolean> {
  // one call, then a pause; refused for going too fast (or a blip), wait a minute and try once more
  const one = async <T,>(f: () => Promise<T>) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const v = await f();
        await pause(COMPARISON_GAP);
        return v;
      } catch (e) {
        if (e instanceof Error && e.message === 'HTTP 404') return undefined; // no such coin: retrying won't help
        await pause(60_000);
      }
    }
    return undefined;
  };
  // only what's missing or older than six hours is fetched, so an interrupted
  // round picks up where it left off next time
  const fetchedAt = { ...(have.fetchedAt ?? {}) };
  const due = (key: string) => !fetchedAt[key] || Date.now() - fetchedAt[key] > COMPARISONS_EVERY;
  const got = (key: string, h?: History) => {
    if (h?.length) fetchedAt[key] = Date.now();
    return h;
  };

  // each series shows as soon as it arrives, the surest first
  if (due('zecBtc')) put({ zecBtc: got('zecBtc', await one(() => dailyCloses('zcash', 'btc', COMPARISON_DAYS))), fetchedAt });
  if (due('lit')) {
    let lit = await one(() => dailyCloses(LIGHTER_ID, 'usd', COMPARISON_DAYS));
    if (!lit?.length) {
      // in case CoinGecko files Lighter under another id: look LIT up by name
      const found = await one(() => json(`${COINGECKO}/search?query=lighter`));
      const id = (found?.coins ?? []).find((c: { symbol?: string }) => c.symbol?.toUpperCase() === 'LIT')?.id;
      if (id && id !== LIGHTER_ID) lit = await one(() => dailyCloses(id, 'usd', COMPARISON_DAYS));
    }
    put({ lit: got('lit', lit), fetchedAt });
  }
  if (due('hypeCap')) put({ hypeCap: got('hypeCap', await one(() => dailyCaps('hyperliquid', COMPARISON_DAYS))), fetchedAt });

  const caps = { ...(have.caps ?? {}) };
  for (const id of TOTAL_PROXY) {
    if (!due(`cap:${id}`) && caps[id]) continue;
    const h = got(`cap:${id}`, await one(() => dailyCaps(id, COMPARISON_DAYS)));
    if (h?.length) caps[id] = h;
    put({ caps: { ...caps }, totalCap: sumCaps(caps), fetchedAt });
  }
  const keys = ['zecBtc', 'lit', 'hypeCap', ...TOTAL_PROXY.map((id) => `cap:${id}`)];
  return keys.every((k) => !due(k));
}

/** The stand-in coins' caps added up, on the days every one of them has; none until all are in. */
function sumCaps(caps: Record<string, History>): History | undefined {
  if (!TOTAL_PROXY.every((id) => caps[id]?.length)) return undefined;
  const sum = new Map<string, number>();
  const count = new Map<string, number>();
  for (const id of TOTAL_PROXY)
    for (const [d, v] of caps[id]) {
      sum.set(d, (sum.get(d) ?? 0) + v);
      count.set(d, (count.get(d) ?? 0) + 1);
    }
  return [...sum.entries()].filter(([d]) => count.get(d) === TOTAL_PROXY.length).sort();
}

/** A daily series as weekly closes: each week's last day (weeks start Monday). */
export function weekly(h?: History): History | undefined {
  if (!h?.length) return undefined;
  const out: History = [];
  let week = '';
  for (const [d, v] of h) {
    const day = new Date(d + 'T00:00:00');
    const monday = new Date(day);
    monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    const key = isoDay(monday);
    if (key === week) out[out.length - 1] = [d, v];
    else out.push([d, v]);
    week = key;
  }
  return out;
}

/** a ÷ b day by day, on the days both have. */
export function ratio(a?: History, b?: History): History | undefined {
  if (!a?.length || !b?.length) return undefined;
  const bs = new Map(b);
  const out: History = [];
  for (const [d, v] of a) {
    const w = bs.get(d);
    if (w) out.push([d, v / w]);
  }
  return out.length ? out : undefined;
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

/** The Equities positions' value on a day: today's shares at that day's closes (today at live prices). */
function equitiesOn(day: string, today: string, live: LivePrices, histories: Record<string, History> = {}) {
  return holdings.equities.positions.reduce((t, p) => {
    const price = day === today && live.stocks?.[p.ticker] ? live.stocks[p.ticker].price : priceOn(histories[p.ticker], day, p.price);
    return t + p.shares * price;
  }, 0);
}

/**
 * What each Equities position cost, by ticker: its shares at the close on the
 * purchase date (or the first close after it). Only used where data.ts has no
 * actual cost.
 */
export function purchaseCosts(histories: Record<string, History> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of holdings.equities.positions) {
    const first = histories[p.ticker]?.find(([d]) => d >= equitiesSince);
    if (first) out[p.ticker] = p.shares * first[1];
  }
  return out;
}

/**
 * The Equities positions' daily value since they were bought: each trading
 * day's close, then today at live prices.
 */
export function buildEquitiesSeries(live: LivePrices, histories: Record<string, History> = {}): Series | null {
  const today = isoDay(new Date());
  const days = new Set<string>();
  for (const h of Object.values(histories)) for (const [d] of h) if (d >= equitiesSince && d < today) days.add(d);
  if (!days.size) return null;
  days.add(today);
  return [...days].sort().map((date) => ({ date, total: equitiesOn(date, today, live, histories) }));
}

/**
 * Today's holdings valued at each day's prices, from the first review to today.
 * Cash and Diversified are held at their current amounts; Equities at the
 * review's figure until the positions were bought, then at market.
 */
export function buildSeries(histories: Histories, live: LivePrices, stockHistories?: Record<string, History>): Series | null {
  if (!histories.hype && !histories.zec && !histories.aapl) return null;
  const fixed = holdings.fortress.value + holdings.diversified.voo + holdings.diversified.vxus + holdings.diversified.avuv;
  const today = isoDay(new Date());
  const out: Series = [];
  for (let d = new Date(firstDay + 'T00:00:00'); isoDay(d) <= today; d.setDate(d.getDate() + 1)) {
    const day = isoDay(d);
    const isToday = day === today;
    const px = (a: Asset) => (isToday && live[a] ? live[a]!.price : priceOn(histories[a], day, reviewPrice(a, day)));
    out.push({
      date: day,
      total:
        holdings.hype.tokens * px('hype') +
        holdings.zec.tokens * px('zec') +
        holdings.aapl.shares * px('aapl') +
        (day < equitiesSince ? reviews[0].equities : equitiesOn(day, today, live, stockHistories)) +
        fixed,
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
  // the latest state, for the slow comparison fetch to see what it already has
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    let alive = true;
    const merge = (fn: (s: MarketState) => MarketState) => alive && setState((s) => fn(s));

    const tickers = holdings.equities.positions.map((p) => p.ticker);
    const refreshQuotes = async () => {
      const [crypto, aapl, ...stocks] = await Promise.allSettled([cryptoQuotes(), stock('AAPL'), ...tickers.map((t) => stock(t))]);
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
        // each Equities stock keeps its last good quote and closes if a refresh fails
        const liveStocks = { ...(live.stocks ?? {}) };
        const stockHistories = { ...(s.stockHistories ?? {}) };
        stocks.forEach((r, i) => {
          if (r.status !== 'fulfilled') return;
          liveStocks[tickers[i]] = r.value.quote;
          if (r.value.history.length) stockHistories[tickers[i]] = r.value.history;
        });
        live.stocks = liveStocks;
        const ok = crypto.status === 'fulfilled' || aapl.status === 'fulfilled';
        return { ...s, live, histories, stockHistories, problems, at: ok ? Date.now() : s.at };
      });
    };

    const refreshHistory = async () => {
      const [h, z, hl] = await Promise.allSettled([cryptoHistory('hype'), cryptoHistory('zec'), dailyCloses('hyperliquid', 'usd', 365)]);
      merge((s) => ({
        ...s,
        ...(hl.status === 'fulfilled' && hl.value.length ? { hypeLong: hl.value } : {}),
        histories: {
          ...s.histories,
          ...(h.status === 'fulfilled' && h.value.length ? { hype: h.value } : {}),
          ...(z.status === 'fulfilled' && z.value.length ? { zec: z.value } : {}),
        },
      }));
    };

    let retry: ReturnType<typeof setTimeout> | undefined;
    const refreshComparisons = async () => {
      clearTimeout(retry);
      const have = latest.current.comparisons ?? {};
      const put = (c: Comparisons) =>
        merge((s) => ({
          ...s,
          // keep what we had for anything this round couldn't fetch
          comparisons: {
            ...s.comparisons,
            ...Object.fromEntries(Object.entries(c).filter(([, v]) => v != null && (!Array.isArray(v) || v.length))),
          },
        }));
      const complete = await fetchComparisons(have, put);
      // only a full set counts as fresh; otherwise come back for the rest soon
      if (complete) merge((s) => ({ ...s, comparisonsAt: Date.now() }));
      else if (alive) retry = setTimeout(refreshComparisons, COMPARISONS_RETRY);
    };

    refreshQuotes();
    refreshHistory();
    // the comparison series change slowly; skip the fetch if the saved copy is recent
    // (after the live quotes and histories have had their turn at CoinGecko)
    const c = state.comparisons;
    const fresh = state.comparisonsAt && Date.now() - state.comparisonsAt < COMPARISONS_EVERY && c?.zecBtc && c.lit && c.totalCap;
    const firstComparisons = setTimeout(refreshComparisons, fresh ? COMPARISONS_EVERY - (Date.now() - state.comparisonsAt!) : 15_000);
    const q = setInterval(refreshQuotes, QUOTE_EVERY);
    const hst = setInterval(refreshHistory, HISTORY_EVERY);
    const cmp = setInterval(refreshComparisons, COMPARISONS_EVERY);
    return () => {
      alive = false;
      clearInterval(q);
      clearInterval(hst);
      clearInterval(cmp);
      clearTimeout(firstComparisons);
      clearTimeout(retry);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(state));
    } catch {
      /* private mode: no cache */
    }
  }, [state]);

  const series = useMemo(
    () => buildSeries(state.histories, state.live, state.stockHistories),
    [state.histories, state.live, state.stockHistories],
  );
  return { ...state, series };
}
