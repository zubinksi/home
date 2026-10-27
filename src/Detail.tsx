import { useMemo, useState } from 'react';
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
          <div className="d-sub">
            <span className="d-alloc" style={{ color: STATUS_COLOR[s.status] }}>
              {s.alloc}
            </span>
          </div>
          {s.runway ? <Runway r={s.runway} /> : <Cards kv={s.kv} />}
        </>
      )}
      {s.asset && <Periods periods={assetPeriods(market, s.asset)} />}
      {s.key === 'ZEC' && <ZecBtc history={market.zecBtc} />}
      {s.module && <ModuleView m={s.module} />}
      <Policy lines={s.policy} />
    </>
  );
}

/**
 * The Fortress runway: today's balance drawn down by monthly spending, with and
 * without T-bill yield, against the 30-month target and the 18-month austerity
 * line. Where a line meets zero is how long the Fortress lasts on its own.
 */
function Runway({ r }: { r: NonNullable<Sleeve['runway']> }) {
  const [withEvergreen, setWithEvergreen] = useState(false);
  const MONTHS = withEvergreen ? 60 : 36;
  const monthly = (b: number) => Math.max(0, b - r.idle) * (r.yield / 12); // idle cash earns nothing

  // balances by month; they may go below zero, and drawing stops where they cross
  const plain: number[] = [];
  const earning: number[] = [];
  let b = r.balance;
  for (let m = 0; m <= MONTHS; m++) {
    plain.push(r.balance - r.burn * m);
    earning.push(b);
    b = b + monthly(b) - r.burn;
  }
  // with Evergreen: a quarter of the year's distributions lands every third month
  const steps: [number, number][] = [];
  let e = r.balance;
  let outEvergreen: number | null = null;
  for (let m = 0; m <= MONTHS && outEvergreen == null; m++) {
    steps.push([m, e]);
    if (m && m % 3 === 0) {
      e += r.evergreen / 4;
      steps.push([m, e]);
    }
    const next = e + monthly(e) - r.burn;
    if (next <= 0 && m < MONTHS) outEvergreen = m + e / (e - next);
    e = next;
  }

  /** Months until a line reaches zero, between whole months; null if it doesn't within the chart. */
  const lasts = (series: number[]) => {
    const i = series.findIndex((v) => v <= 0);
    if (i < 1) return null;
    const prev = series[i - 1];
    return i - 1 + prev / (prev - series[i]);
  };
  const outPlain = r.balance / r.burn;
  const outEarning = lasts(earning);
  const top = Math.max(r.balance, r.target, ...steps.map(([, v]) => v)) * 1.12;
  const X = (m: number) => (m / MONTHS) * 100;
  const Y = (v: number) => (1 - Math.max(0, v) / top) * 100;
  const path = (series: number[], out: number | null) => {
    const pts: string[] = [];
    for (let m = 0; m < series.length; m++) {
      if (out != null && m > out) {
        pts.push(`L${X(out)},${Y(0)}`);
        break;
      }
      pts.push(`${m ? 'L' : 'M'}${X(m)},${Y(series[m])}`);
    }
    return pts.join(' ');
  };
  const stepPath =
    steps.map(([m, v], i) => `${i ? 'L' : 'M'}${X(m)},${Y(v)}`).join(' ') + (outEvergreen != null ? ` L${X(outEvergreen)},${Y(0)}` : '');
  const when = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + Math.floor(months));
    return `${monYY(isoDay(d)).replace(' ', ' ’')}`;
  };
  const ticks = Array.from({ length: MONTHS / 12 }, (_, i) => (i + 1) * 12);

  // refills waiting: each sale's after-tax proceeds go to the Fortress until it's
  // back at 30 months, then on to Diversified (§2)
  let gap = Math.max(0, r.target - r.balance);
  // listed until the Fortress is full again, plus the first that would go on to Diversified
  const refills: { label: string; net: number; months: number; full: boolean }[] = [];
  for (const x of r.refills) {
    const net = x.gross * (1 - r.tax);
    const toFortress = Math.min(net, gap);
    gap -= toFortress;
    refills.push({ label: x.label, net, months: toFortress / r.burn, full: toFortress > 0 && gap <= 0 });
    if (toFortress <= 0) break;
  }

  return (
    <div className="module runway">
      <div className="module-head">
        <span className="label">BURN {money(r.burn)} / MO</span>
        <span className="label">
          LASTS {outPlain.toFixed(1)}
          {outEarning != null && <>–{outEarning.toFixed(1)}</>} MO
          {withEvergreen && <> · {outEvergreen != null ? outEvergreen.toFixed(0) : `${MONTHS}+`} WITH EVERGREEN</>}
        </span>
      </div>
      <div className="runway-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path className="runway-area" d={`${path(earning, outEarning)} L${X(outEarning ?? MONTHS)},100 L0,100 Z`} />
          <line className="runway-target" x1="0" x2="100" y1={Y(r.target)} y2={Y(r.target)} />
          <line className="runway-floor" x1="0" x2="100" y1={Y(r.floor)} y2={Y(r.floor)} />
          {withEvergreen && <path className="runway-evergreen" d={stepPath} />}
          <path className="runway-plain" d={path(plain, outPlain)} />
          <path className="runway-earning" d={path(earning, outEarning)} />
        </svg>
        <span className="runway-tag" style={{ top: `${Y(r.target)}%` }}>
          30 MO TARGET
        </span>
        <span className="runway-tag floor" style={{ top: `${Y(r.floor)}%` }}>
          18 MO AUSTERITY
        </span>
        <span className="runway-now" style={{ top: `${Y(r.balance)}%` }}>
          {money(r.balance)}
        </span>
      </div>
      <div className="chart-axis">
        <span>NOW</span>
        {ticks.map((t) => (
          <span key={t}>{when(t)}</span>
        ))}
      </div>
      <div className="runway-key">
        <span>
          <i className="key-earning" /> IN T-BILLS AT {(r.yield * 100).toFixed(1)}%
        </span>
        <span>
          <i className="key-plain" /> AS CASH
        </span>
        <button className={`runway-toggle ${withEvergreen ? 'on' : ''}`} onClick={() => setWithEvergreen(!withEvergreen)} aria-pressed={withEvergreen}>
          <i className="key-evergreen" /> {withEvergreen ? '✓' : '+'} EVERGREEN {money(r.evergreen)} / YR · EXPECTED
        </button>
      </div>

      {refills.length > 0 && (
        <div className="refills">
          <div className="label">REFILLS WAITING · AFTER 30% TAX</div>
          {refills.map((x) => (
            <div key={x.label} className={`refill ${x.months <= 0 ? 'past' : ''}`}>
              <span>{x.label}</span>
              <span>+{money(x.net)}</span>
              <span>
                {x.months > 0 ? `+${x.months.toFixed(1)} MO` : 'TO DIVERSIFIED'}
                {x.full && <b> · BACK TO 30</b>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ZEC priced in bitcoin over the last 90 days, with its 20-day moving average:
 * is ZEC gaining or losing ground against crypto as a whole?
 */
function ZecBtc({ history }: { history?: [string, number][] }) {
  const [scrub, setScrub] = useState<number>(-1);
  const SHOW = 90;
  const AVG = 20;
  const { points, avg } = useMemo(() => {
    const h = history ?? [];
    const ma = h.map((_, i) => (i + 1 >= AVG ? h.slice(i + 1 - AVG, i + 1).reduce((t, [, v]) => t + v, 0) / AVG : null));
    const from = Math.max(0, h.length - SHOW);
    return {
      points: h.slice(from).map(([date, total]) => ({ date, total })),
      avg: ma.slice(from),
    };
  }, [history]);
  if (points.length < 2) {
    return (
      <div className="module">
        <div className="module-head">
          <span className="label">ZEC / BTC · DAILY</span>
        </div>
        <div className="module-note">The ZEC / BTC price isn’t available right now.</div>
      </div>
    );
  }
  const fmt = (v: number) => v.toPrecision(4);
  const i = scrub >= 0 ? scrub : points.length - 1;
  const now = points[i].total;
  const ma = avg[i];
  const vsAvg = ma ? now / ma - 1 : null;
  return (
    <div className="module">
      <div className="module-head">
        <span className="label">
          {scrub >= 0 ? longDate(new Date(points[i].date + 'T00:00:00')) : 'ZEC / BTC · DAILY'}
        </span>
        <span className="label zecbtc-now">
          <b>{fmt(now)} BTC</b>
          {vsAvg != null && (
            <span style={{ color: STATUS_COLOR[vsAvg >= 0 ? 'green' : 'red'] }}>
              {' · '}
              {(Math.abs(vsAvg) * 100).toFixed(1)}% {vsAvg >= 0 ? 'ABOVE' : 'BELOW'} 20D
            </span>
          )}
        </span>
      </div>
      <Chart points={points} overlay={avg} onScrub={(_, at) => setScrub(at)} />
      <div className="runway-key">
        <span>
          <i className="key-earning" /> ZEC IN BTC
        </span>
        <span>
          <i className="key-avg" /> 20-DAY AVERAGE
        </span>
      </div>
    </div>
  );
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
        <Chart points={model.history} onScrub={setScrub} />
        <Periods periods={model.periods} />
      </div>
      <div className="cards cards-two">
        {model.totalCards.map((c) => (
          <div key={c.k} className="card">
            <div className="label">{c.k}</div>
            <div className="card-v">{c.v}</div>
            {c.d && <div className="card-d">{c.d}</div>}
          </div>
        ))}
        {/* a simplified Fortress gauge: months covered against the 30-month target */}
        <div className="card">
          <div className="label">MONTHS COVERED</div>
          <div className="card-v">
            {Math.floor(months)} <span className="card-of">OF {RULES.fortressTargetMonths}</span>
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
