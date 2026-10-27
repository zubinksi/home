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
          {!s.runway && <Cards kv={s.kv} />}
        </>
      )}
      {s.asset && <Periods periods={assetPeriods(market, s.asset)} />}
      {s.key === 'ZEC' && <ZecBtc history={market.zecBtc} />}
      {s.runway ? <FortressBars r={s.runway} /> : s.module && <ModuleView m={s.module} />}
      <Policy lines={s.policy} />
    </>
  );
}

/**
 * The Fortress: months of expenses covered against the 18-month austerity
 * line and the 30-month target; where the cash sits (T-bills or idle) and what
 * it earns; then the sales waiting to refill it.
 */
function FortressBars({ r }: { r: NonNullable<Sleeve['runway']> }) {
  const invested = Math.max(0, r.balance - r.idle);
  const tilde = r.idleKnown ? '' : '~';

  // refills waiting: each sale's after-tax proceeds go to the Fortress until it's
  // back at 30 months, then on to Diversified (§2); listed until it's full again,
  // plus the first that would go on to Diversified
  let gap = Math.max(0, r.target - r.balance);
  const refills: { label: string; net: number; months: number }[] = [];
  for (const x of r.refills) {
    const net = x.gross * (1 - r.tax);
    const toFortress = Math.min(net, gap);
    gap -= toFortress;
    refills.push({ label: x.label, net, months: toFortress / r.burn });
    if (toFortress <= 0) break;
  }

  const covered = r.balance / r.burn;
  const target = r.target / r.burn;
  const floor = r.floor / r.burn;
  const MAX = 36;
  const m = (v: number) => `${(Math.min(Math.max(v, 0), MAX) / MAX) * 100}%`;

  return (
    <>
      {/* one bar: months covered, split into what's earning and what's idle, with
          expected Evergreen hatched beyond, against austerity and the target */}
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

      {/* where the cash sits, and what it earns */}
      <div className="refills cash-split">
        <div className="label">WHERE IT SITS</div>
        <div className="refill">
          <span>IN T-BILLS · {Math.round((invested / (r.balance || 1)) * 100)}%</span>
          <span>
            {tilde}
            {money(invested)}
          </span>
          <span>
            EARNING {money(invested * r.yield)} / YR AT {(r.yield * 100).toFixed(1)}%
          </span>
        </div>
        <div className="refill">
          <span>IDLE CASH · {Math.round((r.idle / (r.balance || 1)) * 100)}%</span>
          <span>
            {tilde}
            {money(r.idle)}
          </span>
          <span>{r.idle > 0 ? <b className="warn">+{money(r.idle * r.yield)} / YR IF MOVED</b> : 'NONE'}</span>
        </div>
      </div>

      {refills.length > 0 && (
        <div className="refills">
          <div className="label">REFILLS WAITING · AFTER TAX</div>
          {refills.map((x) => (
            <div key={x.label} className={`refill ${x.months <= 0 ? 'past' : ''}`}>
              <span>{x.label}</span>
              <span>+{money(x.net)}</span>
              <span className={x.months > 0 ? 'gain' : undefined}>{x.months > 0 ? `+${x.months.toFixed(1)} MO` : 'TO DIVERSIFIED'}</span>
            </div>
          ))}
        </div>
      )}
    </>
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
  const fmt = (v: number) => v.toFixed(3);
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
