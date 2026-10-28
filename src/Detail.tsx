import { useMemo, useState, type ReactNode } from 'react';
import { Chart } from './Chart';
import type { MarketState } from './prices';
import {
  compact,
  longDate,
  money,
  monYY,
  num,
  periodChanges,
  isoDay,
  priceFmt,
  RULES,
  STATUS_COLOR,
  type buildSleeves,
  type KV,
  type Module,
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

function ModuleView({ m }: { m: Module }) {
  switch (m.kind) {
    case 'ladder': {
      const toNext = m.next >= 0 ? m.rungs[m.next].price / m.price - 1 : 0;
      return (
        <div className="module">
          <div className="module-head">
            <span className="label">SKIM LADDER</span>
            <span className="label">${(m.total / 1e6).toFixed(3)}M PRE-TAX</span>
          </div>
          <div className="ladder">
            <div className="ladder-row head">
              <span />
              <span>PRICE</span>
              <span>TOKENS</span>
              <span>PROCEEDS</span>
            </div>
            {m.rungs.map((r, i) => {
              const mark = i < m.sold ? '✓' : i === m.next ? '▲' : '○';
              const cls = i < m.sold ? 'sold' : i === m.next ? 'next' : '';
              return (
                <div key={r.price} className={`ladder-row ${cls}`}>
                  <span className="mark">{mark}</span>
                  <span>${r.price}</span>
                  <span>{num(r.tokens)}</span>
                  <span>{money(r.price * r.tokens)}</span>
                </div>
              );
            })}
          </div>
          <div className="module-foot">
            {m.next >= 0 ? (
              <span>
                NEXT RUNG ${m.rungs[m.next].price} · +{Math.round(toNext * 100)}% FROM {priceFmt(m.price)}
              </span>
            ) : (
              <span>ALL RUNGS FILLED</span>
            )}
            <span>KEEP {num(m.keep)} FOREVER</span>
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
  return (
    <>
      <div className="d-title">
        <span className="d-name">{s.name}</span>
        <span className="d-amt">${compact(s.amount)}</span>
      </div>
      {s.position ? (
        // held assets: what we hold at what price, and how it's done
        <div className="d-pos">
          <span>{s.position.holding}</span>
          {s.position.gain && <span style={{ color: STATUS_COLOR[s.position.gain.color] }}>{s.position.gain.text}</span>}
        </div>
      ) : (
        <>
          {/* the Fortress's coverage is already the first bar below */}
          {!s.runway && (
            <>
              <div className="d-sub">
                <span className="d-alloc" style={{ color: STATUS_COLOR[s.status] }}>
                  {s.alloc}
                </span>
              </div>
              <Cards kv={s.kv} />
            </>
          )}
        </>
      )}
      {s.asset && <Periods periods={assetPeriods(market, s.asset)} />}
      {s.key === 'ZEC' && <ZecCharts market={market} />}
      {s.key === 'HYPE' && (
        <PriceChart title="HYPE" history={market.hypeLong} show={180} levels={levels} fmt={priceFmt} axisFmt={dollarAxis} />
      )}
      {s.runway ? <FortressBars r={s.runway} /> : s.module && <ModuleView m={s.module} />}
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

/** A daily price line for the last `show` days, with any fixed price levels across it. */
function PriceChart({
  title,
  history,
  show,
  levels = [],
  fmt,
  axisFmt,
  heading,
}: {
  title: string;
  /** shown in place of the title at the top left, e.g. a switch between charts */
  heading?: ReactNode;
  history?: [string, number][];
  show: number;
  /** fixed price levels drawn across the chart, e.g. the sell rungs */
  levels?: { price: number; next?: boolean }[];
  fmt: (v: number) => string;
  /** shorter form for the y axis */
  axisFmt: (v: number) => string;
}) {
  const [scrub, setScrub] = useState<number>(-1);
  const { points, overlays } = useMemo(() => {
    const h = history ?? [];
    const from = Math.max(0, h.length - show);
    return {
      points: h.slice(from).map(([date, total]) => ({ date, total })),
      overlays: [
        ...levels.map((l) => ({
          values: h.slice(from).map(() => l.price),
          color: l.next ? '--accent' : '--muted',
          dashed: true,
          level: true,
        })),
      ],
    };
  }, [history, show, levels]);
  if (points.length < 2) {
    return (
      <div className="module">
        <div className="module-head">
          <span className="label">{title}</span>
        </div>
        <div className="module-note">The {title} price history isn’t available right now.</div>
      </div>
    );
  }
  const i = scrub >= 0 ? scrub : points.length - 1;
  return (
    <div className="module">
      <div className="module-head">
        {scrub >= 0 ? <span className="label">{longDate(new Date(points[i].date + 'T00:00:00'))}</span> : (heading ?? <span className="label">{title}</span>)}
        <span className="label zecbtc-now">
          <b>{fmt(points[i].total)}</b>
        </span>
      </div>
      <Chart points={points} overlays={overlays} onScrub={(_, at) => setScrub(at)} yFormat={axisFmt} />
      <div className="runway-key">
        <span>
          <i className="key-earning" /> {title}
        </span>
        {levels.length > 0 && (
          <span>
            <i className="key-level" /> SELL RUNGS
          </span>
        )}
      </div>
    </div>
  );
}

/** ZEC in dollars (the default) or against bitcoin, with a switch between them. */
function ZecCharts({ market }: { market: MarketState }) {
  const [vs, setVs] = useState<'usd' | 'btc'>('usd');
  const heading = (
    <span className="label chart-switch" role="group" aria-label="Chart">
      <button className={vs === 'usd' ? 'on' : ''} aria-pressed={vs === 'usd'} onClick={() => setVs('usd')}>
        ZEC
      </button>
      <button className={vs === 'btc' ? 'on' : ''} aria-pressed={vs === 'btc'} onClick={() => setVs('btc')}>
        ZEC / BTC
      </button>
    </span>
  );
  return vs === 'usd' ? (
    <PriceChart key="usd" title="ZEC" heading={heading} history={market.histories.zec} show={90} fmt={priceFmt} axisFmt={dollarAxis} />
  ) : (
    <PriceChart key="btc" title="ZEC / BTC" heading={heading} history={market.zecBtc} show={90} fmt={btcFmt} axisFmt={btcAxis} />
  );
}
// stable formatters (the chart redraws when they change)
const btcFmt = (v: number) => `${v.toFixed(3)} BTC`;
const btcAxis = (v: number) => `${+v.toFixed(4)}`;
const dollarAxis = (v: number) => `$${+v.toFixed(2)}`;
const moneyAxis = (v: number) => (v >= 1e6 ? `$${+(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3)}K`);

/** The next few unsold sell rungs, as price levels for the HYPE chart. */
function rungLevels(s: Sleeve) {
  if (s.module?.kind !== 'ladder') return [];
  const { rungs, sold, next } = s.module;
  return rungs.slice(sold, sold + 3).map((r, i) => ({ price: r.price, next: sold + i === next }));
}

/** Change in the line over 1D / 1W / 1M / 3M. */
function Periods({ periods }: { periods: Model['periods'] }) {
  return (
    <div className="periods">
      {periods.map((p) => (
        <div key={p.label} className="period" title={p.change === null ? 'The chart doesn’t reach back that far yet' : undefined}>
          <span className="label">{p.label}</span>
          <span className="period-v" style={p.change === null ? undefined : { color: STATUS_COLOR[p.change >= 0 ? 'green' : 'red'] }}>
            {p.change === null ? '—' : `${p.change >= 0 ? '+' : '−'}${(Math.abs(p.change) * 100).toFixed(1)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TotalDetail({ model }: { model: Model }) {
  const [scrub, setScrub] = useState<{ date: string; total: number } | null>(null);
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
        {/* while scrubbing, the day's value appears here */}
        <div className="module-head chart-head">
          {scrub && (
            <span className="label chart-readout">
              {longDate(new Date(scrub.date + 'T00:00:00'))} · <b>${Math.round(scrub.total).toLocaleString()}</b>
            </span>
          )}
        </div>
        <Chart points={model.history} onScrub={setScrub} yFormat={moneyAxis} />
        <Periods periods={model.periods} />
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
