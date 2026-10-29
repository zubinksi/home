import { useMemo, useState, useSyncExternalStore } from 'react';
import { Chart } from './Chart';
import { buildEquitiesSeries, ratio, weekly, type MarketState } from './prices';
import {
  compact,
  longDate,
  money,
  monYY,
  num,
  pct,
  periodChanges,
  isoDay,
  priceFmt,
  RULES,
  STATUS_COLOR,
  type buildSleeves,
  type KV,
  type Module,
  type Series,
  type Sleeve,
} from './model';

type Model = ReturnType<typeof buildSleeves>;

function Cards({ kv }: { kv: KV[] }) {
  if (!kv.length) return null;
  return (
    <div className="cards" style={{ gridTemplateColumns: `repeat(${kv.length}, minmax(0, 1fr))` }}>
      {kv.map((c) => (
        <div key={c.k} className="card">
          <div className="label">{c.k}</div>
          <div className="card-v">{c.v}</div>
          {c.d && (
            <div className="card-d" style={c.dc ? { color: STATUS_COLOR[c.dc] } : undefined}>
              {c.d}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Policy({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="policy">
      <button className={`policy-toggle ${open ? 'is-open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="sect">§</span>
        <span>POLICY</span>
        <span className="policy-count">{lines.length}</span>
        <span className={`caret ${open ? '' : 'closed'}`} aria-hidden />
      </button>
      {open && (
        <div className="policy-lines">
          {lines.map((l, i) => (
            <p key={i} className="policy-line">
              <span className="sect">§</span>
              {l}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

type PositionRow = Extract<Module, { kind: 'positions' }>['rows'][number];

/** Each Equities position on one line; tapping it opens its thesis and sell-if line. */
function Positions({ rows, market }: { rows: PositionRow[]; market: MarketState }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="module">
      <div className="module-head">
        <span className="label">
          {rows.length} POSITION{rows.length === 1 ? '' : 'S'}
        </span>
        <span className="label">MAX {pct(RULES.maxPosition)} OF LIQUID EACH</span>
      </div>
      <div className="eq-list">
        {rows.map((p) => {
          const isOpen = open === p.ticker;
          const missing = !p.thesis;
          return (
            <div key={p.ticker} className={`eq-pos ${isOpen ? 'is-open' : ''}`}>
              <button className="eq-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.ticker)}>
                <span className="eq-ticker">
                  {p.ticker}
                  <span className="eq-shares">{num(p.shares)} SH</span>
                </span>
                <span className="eq-name">
                  {p.name}
                  {missing && <span className="eq-flag" title="Thesis not written yet" />}
                </span>
                <span className="eq-amt">{money(p.value)}</span>
                <span className="eq-share" style={p.overMax ? { color: STATUS_COLOR.red } : undefined}>
                  {pct(p.share, 1)}
                </span>
                <span className="eq-caret" aria-hidden />
              </button>
              {isOpen && (
                <div className="eq-body">
                  {/* the stock's own moves, quieter than the sleeve's boxes */}
                  <Periods periods={stockPeriods(market, p.ticker)} value={p.value} soft />
                  <div className="eq-field">
                    <span className="label">THESIS</span>
                    {p.thesis ? <p>{p.thesis}</p> : <p className="eq-missing">Not written yet.</p>}
                  </div>
                  {/* shown once written */}
                  {p.sellIf && (
                    <div className="eq-field">
                      <span className="label">SELL IF</span>
                      <p>{p.sellIf}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModuleView({ m, market }: { m: Module; market: MarketState }) {
  switch (m.kind) {
    case 'ladder': {
      // the whole stack before any rung sold, and what's left after each rung
      const soldSoFar = m.rungs.slice(0, m.sold).reduce((t, r) => t + r.tokens, 0);
      const stack = m.held + soldSoFar;
      let left = stack;
      const rows = m.rungs.map((r) => ({ ...r, after: (left -= r.tokens) }));
      return (
        <div className="module">
          <div className="module-head">
            <span className="label">SKIM LADDER</span>
          </div>
          <div className="ladder">
            <div className="ladder-row head">
              <span />
              <span>PRICE</span>
              <span>SELL</span>
              <span>% SOLD</span>
              <span>HELD</span>
              <span>PROCEEDS</span>
            </div>
            {/* where we stand today, before any of the rungs below */}
            <div className="ladder-row now">
              <span className="mark">●</span>
              <span>{priceFmt(m.price)}</span>
              <span>—</span>
              <span>—</span>
              <span>{num(m.held)}</span>
              <span>—</span>
            </div>
            {rows.map((r, i) => {
              const mark = i < m.sold ? '✓' : i === m.next ? '▲' : '○';
              const cls = i < m.sold ? 'sold' : i === m.next ? 'next' : '';
              return (
                <div key={r.price} className={`ladder-row ${cls}`}>
                  <span className="mark">{mark}</span>
                  <span>${r.price}</span>
                  <span>{num(r.tokens)}</span>
                  <span>{((r.tokens / stack) * 100).toFixed(1)}%</span>
                  <span>{num(r.after)}</span>
                  <span>{money(r.price * r.tokens)}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case 'gauge': {
      const at = (v: number) => `${(Math.min(v, m.max) / m.max) * 100}%`;
      return (
        <div className="module">
          <div className="label">MONTHS OF EXPENSES COVERED</div>
          <div className="gauge-big">
            <span className="gauge-now">{Math.floor(m.now)}</span>
            <span className="label">OF {m.target} TARGET</span>
          </div>
          <div className="gauge">
            <div className="gauge-track">
              <div className="gauge-fill" style={{ width: at(m.now) }} />
              <div className="gauge-tick floor" style={{ left: at(m.floor) }} />
              <div className="gauge-tick target" style={{ left: at(m.target) }} />
            </div>
            <div className="gauge-labels">
              <span style={{ left: '0%' }}>0</span>
              <span className="floor" style={{ left: at(m.floor) }}>
                {m.floor} AUSTERITY
              </span>
              <span style={{ left: at(m.target) }}>{m.target} TARGET</span>
              <span style={{ left: '100%' }}>{m.max}</span>
            </div>
          </div>
        </div>
      );
    }
    case 'plan':
      return (
        <div className="module">
          <div className="module-head">
            <span className="label">FUNDING PLAN</span>
            <span className="label">
              GOAL {money(m.goal)} BY {monYY(m.goalDate)}
            </span>
          </div>
          <div className="plan">
            {m.rows.map((r) => (
              <div key={r.source} className="plan-row">
                <span className="plan-src">{r.source}</span>
                <span className="plan-amt">{r.amount}</span>
                <span className="plan-when">{r.when}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 'positions':
      return <Positions rows={m.rows} market={market} />;
    case 'tranches': {
      // the stack before any sale, and what's left after each
      const stack = m.held + m.sales.reduce((t, x) => t + x.tokens, 0);
      let left = stack;
      const sold = m.sales.map((x) => ({ ...x, after: (left -= x.tokens) }));
      return (
        <div className="module">
          <div className="module-head">
            <span className="label">TRANCHES</span>
          </div>
          <div className="ladder">
            <div className="ladder-row head">
              <span />
              <span>PRICE</span>
              <span>SELL</span>
              <span>% SOLD</span>
              <span>HELD</span>
              <span>PROCEEDS</span>
            </div>
            {/* where we stand today, then each sale, newest first */}
            <div className="ladder-row now">
              <span className="mark">●</span>
              <span>{priceFmt(m.price)}</span>
              <span>—</span>
              <span>—</span>
              <span>{num(m.held)}</span>
              <span>—</span>
            </div>
            {[...sold].reverse().map((x) => (
              <div key={x.date + x.price} className="ladder-row done" title={`Sold ${longDate(new Date(x.date + 'T00:00:00'))}`}>
                <span className="mark">✓</span>
                <span>{priceFmt(x.price)}</span>
                <span>{num(x.tokens)}</span>
                <span>{((x.tokens / stack) * 100).toFixed(1)}%</span>
                <span>{num(x.after)}</span>
                <span>{money(x.price * x.tokens)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'tax':
      return (
        <div className="module">
          <div className="label">TAX IF UNWOUND</div>
          <div className="tax">
            {m.rows.map((r) => (
              <div key={r.k} className="tax-row">
                <span>{r.k}</span>
                <span style={r.color && r.v !== '—' ? { color: STATUS_COLOR[r.color] } : undefined}>{r.v}</span>
              </div>
            ))}
          </div>
          {m.note && <div className="module-note">{m.note}</div>}
        </div>
      );
  }
}

/** 1D / 1W / 1M / 3M for one asset's price, from the market history plus today's live price. */
/** A stock's own 1D / 1W / 1M / 3M, from its daily closes and live price. */
function stockPeriods(market: MarketState, ticker: string) {
  const history = market.stockHistories?.[ticker];
  if (!history?.length) return periodChanges([]);
  const today = isoDay(new Date());
  const points = history.filter(([d]) => d < today).map(([date, total]) => ({ date, total }));
  points.push({ date: today, total: market.live.stocks?.[ticker]?.price ?? history[history.length - 1][1] });
  return periodChanges(points, false);
}

function assetPeriods(market: MarketState, asset: NonNullable<Sleeve['asset']>) {
  const history = market.histories[asset];
  if (!history?.length) return periodChanges([]);
  const today = isoDay(new Date());
  const points = history.filter(([d]) => d < today).map(([date, total]) => ({ date, total }));
  const live = market.live[asset]?.price ?? history[history.length - 1][1];
  points.push({ date: today, total: live });
  return periodChanges(points);
}

export function Detail({ sleeve: s, market }: { sleeve: Sleeve; market: MarketState }) {
  const levels = useMemo(() => rungLevels(s), [s]);
  // the comparison charts are weekly, with a 20-week EMA as on TradingView's 1W chart
  const hypeLit = useMemo(() => weeklyWithAverage(ratio(market.hypeLong, market.comparisons?.lit)), [market.hypeLong, market.comparisons?.lit]);
  const hypeTotal = useMemo(
    () => weeklyWithAverage(ratio(market.comparisons?.hypeCap, market.comparisons?.totalCap)),
    [market.comparisons?.hypeCap, market.comparisons?.totalCap],
  );
  const zecBtcW = useMemo(() => weeklyWithAverage(market.comparisons?.zecBtc), [market.comparisons?.zecBtc]);
  const charted = s.key === 'HYPE' || s.key === 'ZEC';
  // HYPE and ZEC can switch their chart to a comparison
  const views = s.key === 'HYPE' ? HYPE_VIEWS : ZEC_VIEWS;
  const [view, setView] = useState('USD');
  // the Equities positions together, daily since they were bought
  const equities = useMemo(
    () => (s.key === 'EQUITIES' ? buildEquitiesSeries(market.live, market.stockHistories) : null),
    [s.key, market.live, market.stockHistories],
  );
  return (
    <>
      <div className="d-title">
        <span className="d-name">{s.name}</span>
        <span className="d-amt">${compact(s.amount)}</span>
      </div>
      {s.position ? (
        // held assets: what we hold at what price, and how it's done (for HYPE
        // and ZEC the holding is in the table and the price on the chart)
        <div className="d-pos">
          {/* Equities keeps its share of liquid on the left; HYPE and ZEC show the holding elsewhere */}
          {s.key === 'EQUITIES' ? (
            <span className="d-alloc" style={{ color: STATUS_COLOR[s.status] }}>
              {s.alloc}
            </span>
          ) : (
            charted ? (
              <ChartToggle options={views} value={view} onChange={setView} />
            ) : (
              <span>{s.position.holding}</span>
            )
          )}
          {s.position.gain && <span style={{ color: STATUS_COLOR[s.position.gain.color] }}>{s.position.gain.text}</span>}
        </div>
      ) : (
        <>
          {/* the Fortress's coverage is already the first bar below */}
          {!s.runway && (
            <>
              {/* Diversified's goal is already the funding plan's heading */}
              {s.key !== 'DIVERSIFIED' && (
                <div className="d-sub">
                  <span className="d-alloc" style={{ color: STATUS_COLOR[s.status] }}>
                    {s.alloc}
                  </span>
                </div>
              )}
              <Cards kv={s.kv} />
            </>
          )}
        </>
      )}
      {/* returns sit under the chart where there is one, as on the Total page */}
      {s.asset && !charted && <Periods periods={assetPeriods(market, s.asset)} value={s.amount} />}
      {s.key === 'ZEC' &&
        (view === 'BTC' ? (
          <PriceChart title="ZEC / BTC" history={zecBtcW.history} average={zecBtcW.average} show={WEEKS} fmt={btcFmt} axisFmt={btcAxis} />
        ) : (
          <PriceChart title="ZEC" history={market.histories.zec} show={90} fmt={priceFmt} axisFmt={dollarAxis} />
        ))}
      {s.key === 'HYPE' &&
        (view === 'LIT' ? (
          <PriceChart title="HYPE / LIT" history={hypeLit.history} average={hypeLit.average} show={WEEKS} fmt={ratioFmt} axisFmt={ratioAxis} />
        ) : view === 'TOTAL' ? (
          <PriceChart title="HYPE / TOTAL" history={hypeTotal.history} average={hypeTotal.average} show={WEEKS} fmt={shareFmt} axisFmt={shareAxis} />
        ) : (
          <PriceChart title="HYPE" history={market.hypeLong} show={180} levels={levels} fmt={priceFmt} axisFmt={dollarAxis} />
        ))}
      {s.asset && charted && <Periods periods={assetPeriods(market, s.asset)} value={s.amount} />}
      {s.key === 'EQUITIES' && <EquitiesChart series={equities} />}
      {s.runway ? <FortressBars r={s.runway} /> : s.module && <ModuleView m={s.module} market={market} />}
      <Policy lines={s.policy} />
    </>
  );
}

/**
 * The Fortress: months of expenses covered against the 18-month austerity
 * line and the 30-month target; where the cash sits (T-bills or idle) and what
 * it earns; then the next sales that would refill it, in months of bills.
 */
function FortressBars({ r }: { r: NonNullable<Sleeve['runway']> }) {
  const invested = Math.max(0, r.balance - r.idle);
  const share = r.balance ? invested / r.balance : 0;
  const tilde = r.idleKnown ? '' : '~';

  // refills waiting: the next few sales, after tax, and how many months of the
  // Fortress each would add on its own
  const refills = r.refills.slice(0, 3).map((x) => {
    const net = x.gross * (1 - r.tax);
    return { label: x.label, net, months: net / r.burn };
  });

  const covered = r.months;
  const target = r.target / r.burn;
  const floor = r.floor / r.burn;
  const MAX = 36;
  const m = (v: number) => `${(Math.min(Math.max(v, 0), MAX) / MAX) * 100}%`;

  return (
    <>
      {/* months covered, against austerity and the target */}
      <div className="module">
        <div className="label">MONTHS OF EXPENSES COVERED</div>
        <div className="gauge-big">
          <span className="gauge-now">{covered.toFixed(1)}</span>
          <span className="label">OF {Math.round(target)} TARGET</span>
        </div>
        <div className="gauge">
          <div className="gauge-track">
            <div className="gauge-fill" style={{ width: m(covered) }} />
            <div className="gauge-tick floor" style={{ left: m(floor) }} />
            <div className="gauge-tick target" style={{ left: m(target) }} />
          </div>
          <div className="gauge-labels">
            <span style={{ left: '0%' }}>0</span>
            <span className="floor" style={{ left: m(floor) }}>
              {Math.round(floor)} AUSTERITY
            </span>
            <span style={{ left: m(target) }}>{Math.round(target)} TARGET</span>
            <span style={{ left: '100%' }}>{MAX}</span>
          </div>
        </div>
      </div>

      {/* where the cash sits, and what it earns: one line per place, the bar
          showing its share; the rate and what moving idle cash would add sit in
          the heading */}
      <div className="refills cash-split">
        <div className="module-head">
          <span className="label">WHERE IT SITS · {(r.yield * 100).toFixed(1)}%</span>
        </div>
        <div className="refill">
          <span>T-BILLS</span>
          <span className="split-bar">
            <span style={{ width: `${share * 100}%` }} />
          </span>
          <span>
            {tilde}
            {money(invested)}
          </span>
          <span className="gain">{money(invested * r.yield)} / YR</span>
        </div>
        <div className="refill">
          <span>IDLE</span>
          <span className="split-bar idle">
            <span style={{ width: `${(1 - share) * 100}%` }} />
          </span>
          <span>
            {tilde}
            {money(r.idle)}
          </span>
          <span className="warn">$0 / YR</span>
        </div>
      </div>

      {refills.length > 0 && (
        <div className="refills">
          <div className="label">REFILLS WAITING · AFTER TAX</div>
          {refills.map((x) => (
            <div key={x.label} className="refill">
              <span>{x.label}</span>
              <span>+{money(x.net)}</span>
              <span className="gain">+{x.months.toFixed(1)} MO</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// a stable empty default: a fresh [] each render would redraw the chart on every scrub
const NO_LEVELS: { price: number; next?: boolean }[] = [];
/** the comparison charts: a year of weekly closes */
const WEEKS = 53;

/**
 * A daily series as weekly closes, with TradingView's "EMA 20" on the weekly
 * chart: an exponential average of the last 20 weekly closes (started from
 * their simple average).
 */
function weeklyWithAverage(daily?: [string, number][]) {
  if (!daily?.length) return { history: undefined, average: [] as (number | null)[] };
  const history = weekly(daily)!;
  return { history, average: ema(history.map(([, v]) => v), 20) };
}

/** Exponential moving average over n points, seeded with the first n points' simple average. */
function ema(values: number[], n: number) {
  const k = 2 / (n + 1);
  let prev: number | null = null;
  return values.map((v, i) => {
    if (i < n - 1) return null;
    prev = prev == null ? values.slice(0, n).reduce((a, b) => a + b, 0) / n : v * k + prev * (1 - k);
    return prev;
  });
}

const HYPE_VIEWS = ['USD', 'LIT', 'TOTAL'];
const ZEC_VIEWS = ['USD', 'BTC'];

/** A small segmented switch: the choice sits raised in a soft recessed pill, and slides. */
function ChartToggle({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const at = Math.max(0, options.indexOf(value));
  return (
    <span className="seg" role="group" aria-label="Chart" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <span className="seg-thumb" style={{ width: `calc((100% - 0.25rem) / ${options.length})`, transform: `translateX(${at * 100}%)` }} aria-hidden />
      {options.map((o) => (
        <button key={o} className={o === value ? 'on' : ''} aria-pressed={o === value} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </span>
  );
}

/** A daily price line for the last `show` days, with any fixed price levels across it. */
function PriceChart({
  title,
  history,
  show,
  levels = NO_LEVELS,
  average,
  fmt,
  axisFmt,
}: {
  title: string;
  history?: [string, number][];
  show: number;
  /** the weekly EMA 20, one value per point of `history` (null until 20 weeks are in) */
  average?: (number | null)[];
  /** fixed price levels drawn across the chart, e.g. the sell rungs */
  levels?: { price: number; next?: boolean }[];
  fmt: (v: number) => string;
  /** shorter form for the y axis */
  axisFmt: (v: number) => string;
}) {
  const { points, overlays } = useMemo(() => {
    const h = history ?? [];
    const from = Math.max(0, h.length - show);
    return {
      points: h.slice(from).map(([date, total]) => ({ date, total })),
      overlays: [
        ...(average ? [{ values: average.slice(from), color: '--accent' }] : []),
        ...levels.map((l) => ({
          values: h.slice(from).map(() => l.price),
          color: l.next ? '--accent' : '--muted',
          dashed: true,
          level: true,
        })),
      ],
    };
  }, [history, show, levels, average]);
  if (points.length < 2) {
    return (
      <div className="module chart-empty">
        <div className="module-note">
          {average !== undefined
            ? `The ${title} chart is still loading. The first time, it takes a few minutes to gather.`
            : `The ${title} price history isn’t available right now.`}
        </div>
      </div>
    );
  }
  // no title or price above: the page names the asset, and the latest price sits at the line's end
  return (
    <div className="module">
      <Chart
        points={points}
        overlays={overlays}
        yFormat={axisFmt}
        format={fmt}
        endLabel
        // the key sits inside the chart, so every chart is the same height and switching doesn't shift the page
        corner={
          average && (
            <span className="ma-key">
              <i /> EMA 20W
            </span>
          )
        }
      />
    </div>
  );
}

/** The Equities positions' combined value since they were bought, with its returns beneath. */
function EquitiesChart({ series }: { series: Series | null }) {
  const history = useMemo(() => (series ?? []).map((p) => [p.date, p.total] as [string, number]), [series]);
  return (
    <>
      <PriceChart title="Equities" history={history} show={history.length} fmt={fullMoney} axisFmt={kAxis} />
      {/* no partial 3M figure: a dash until the positions have three months behind them */}
      <Periods periods={periodChanges(series ?? [], false)} value={series?.[series.length - 1]?.total ?? 0} />
    </>
  );
}

// stable formatters (the chart redraws when they change)
const btcFmt = (v: number) => `${v.toFixed(4)} BTC`;
const btcAxis = (v: number) => `${+v.toFixed(4)}`;
const ratioFmt = (v: number) => v.toFixed(2);
const ratioAxis = (v: number) => `${+v.toFixed(2)}`;
const shareFmt = (v: number) => `${(v * 100).toFixed(3)}%`;
const shareAxis = (v: number) => `${+(v * 100).toFixed(2)}%`;
const dollarAxis = (v: number) => `$${+v.toFixed(2)}`;
const kAxis = (v: number) => `$${+(v / 1e3).toFixed(1)}K`;
const fullMoney = (v: number) => `$${Math.round(v).toLocaleString()}`;
const moneyAxis = (v: number) => (v >= 1e6 ? `$${+(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3)}K`);

/** The next few unsold sell rungs, as price levels for the HYPE chart. */
function rungLevels(s: Sleeve) {
  if (s.module?.kind !== 'ladder') return [];
  const { rungs, sold, next } = s.module;
  return rungs.slice(sold, sold + 3).map((r, i) => ({ price: r.price, next: sold + i === next }));
}

/** Change in the line over 1D / 1W / 1M / 3M. */
// returns read as % or $ — one choice for every row, remembered on this device
const RETURNS_KEY = 'browns.returns.v1';
const returnsListeners = new Set<() => void>();
function readReturnsMode(): 'pct' | 'usd' {
  try {
    return localStorage.getItem(RETURNS_KEY) === 'usd' ? 'usd' : 'pct';
  } catch {
    return 'pct';
  }
}
let returnsMode = readReturnsMode();
function useReturnsMode() {
  const mode = useSyncExternalStore(
    (fn) => {
      returnsListeners.add(fn);
      return () => returnsListeners.delete(fn);
    },
    () => returnsMode,
  );
  const toggle = () => {
    returnsMode = returnsMode === 'pct' ? 'usd' : 'pct';
    try {
      localStorage.setItem(RETURNS_KEY, returnsMode);
    } catch {
      /* private mode: lasts until reload */
    }
    returnsListeners.forEach((fn) => fn());
  };
  return [mode, toggle] as const;
}

/**
 * 1D / 1W / 1M / 3M returns. Tapping the row switches every row between
 * percent and dollars; `value` is what the holding is worth now, so a change
 * of c means value × c / (1 + c) gained.
 */
function Periods({ periods, value, soft = false }: { periods: Model['periods']; value: number; soft?: boolean }) {
  const [mode, toggle] = useReturnsMode();
  const show = (c: number) => {
    const sign = c >= 0 ? '+' : '−';
    return mode === 'usd' ? `${sign}${money(Math.abs((value * c) / (1 + c)))}` : `${sign}${(Math.abs(c) * 100).toFixed(1)}%`;
  };
  return (
    <button
      className={`periods ${soft ? 'is-soft' : ''}`}
      onClick={toggle}
      aria-label={mode === 'usd' ? 'Returns in dollars. Show percent' : 'Returns in percent. Show dollars'}
    >
      {periods.map((p) => (
        <span key={p.label} className="period" title={p.change === null ? 'The chart doesn’t reach back that far yet' : undefined}>
          <span className="label">{p.label}</span>
          <span className="period-v" style={p.change === null ? undefined : { color: STATUS_COLOR[p.change >= 0 ? 'green' : 'red'] }}>
            {p.change === null ? '—' : show(p.change)}
          </span>
        </span>
      ))}
    </button>
  );
}

export function TotalDetail({ model }: { model: Model }) {
  // the same coverage figure as the Fortress page
  const months = model.fortressMonths;
  const scale = (m: number) => `${(Math.min(m, RULES.gaugeMax) / RULES.gaugeMax) * 100}%`;
  return (
    <>
      <div className="d-title">
        <span className="d-name">TOTAL</span>
        <span className="d-amt">${compact(model.total)}</span>
      </div>
      <div className="module">
        <Chart points={model.history} yFormat={moneyAxis} format={fullMoney} />
        <Periods periods={model.periods} value={model.total} />
      </div>
      <div className="cards cards-two">
        {model.totalCards.map((c) => (
          <div key={c.k} className="card">
            <div className="label">{c.k}</div>
            <div className="card-v" style={c.vc ? { color: STATUS_COLOR[c.vc] } : undefined}>
              {c.v}
            </div>
            {c.d && <div className="card-d">{c.d}</div>}
          </div>
        ))}
        {/* a simplified Fortress gauge: months covered against the 30-month target */}
        <div className="card">
          <div className="label">MONTHS COVERED</div>
          <div className="card-v">
            {months.toFixed(1)} <span className="card-of">OF {RULES.fortressTargetMonths}</span>
          </div>
          <div className="mini-gauge" title={`Austerity below ${RULES.austerityMonths} months`}>
            <span className="mini-fill" style={{ width: scale(months) }} />
            <span className="mini-tick floor" style={{ left: scale(RULES.austerityMonths) }} />
            <span className="mini-tick" style={{ left: scale(RULES.fortressTargetMonths) }} />
          </div>
        </div>
      </div>
    </>
  );
}
