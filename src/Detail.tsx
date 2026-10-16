import { Chart } from './Chart';
import {
  compact,
  money,
  monYY,
  num,
  pct,
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
  return (
    <div className="policy">
      <div className="label">POLICY</div>
      {lines.map((l, i) => (
        <p key={i} className="policy-line">
          <span className="sect">§</span>
          {l}
        </p>
      ))}
    </div>
  );
}

function OpenLink({ n, name, onOpen }: { n: number; name?: string; onOpen: () => void }) {
  if (n === 0) return <div className="open-link none">NOTHING OPEN{name ? ` ON ${name}` : ''}. THE POLICY STANDS AS WRITTEN.</div>;
  return (
    <button className="open-link" onClick={onOpen}>
      {n} OPEN ITEM{n === 1 ? '' : 'S'}
      {name ? ` ON ${name}` : ''} — OPEN THE LIST ↑
    </button>
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
                NEXT RUNG ${m.rungs[m.next].price} · +{Math.round(toNext * 100)}% FROM ${m.price}
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

export function Detail({ sleeve: s, openCount, onOpenList }: { sleeve: Sleeve; openCount: number; onOpenList: () => void }) {
  return (
    <>
      <div className="d-title">
        <span className="d-name">{s.name}</span>
        <span className="d-amt">${compact(s.amount)}</span>
      </div>
      <div className="d-sub">
        <span className="d-role">{s.roleTitle}</span>
        <span className="d-alloc" style={{ color: STATUS_COLOR[s.status] }}>
          {s.alloc}
        </span>
      </div>
      <Cards kv={s.kv} />
      {s.module && <ModuleView m={s.module} />}
      <Policy lines={s.policy} />
      <OpenLink n={openCount} name={s.name} onOpen={onOpenList} />
    </>
  );
}

export function TotalDetail({ model, openCount, onOpenList }: { model: Model; openCount: number; onOpenList: () => void }) {
  const values = model.history.map((h) => h.total);
  const lo = Math.min(...values, model.total);
  const hi = Math.max(...values, model.total);
  const offPolicy = model.sleeves.filter((s) => s.status === 'amber' || s.status === 'red');
  return (
    <>
      <div className="d-title">
        <span className="d-name">TOTAL</span>
        <span className="d-amt">${compact(model.total)}</span>
      </div>
      <div className="d-sub">
        <span className="d-role">Liquid assets across six sleeves · Evergreen not counted</span>
        <span className="d-alloc" style={{ color: STATUS_COLOR[offPolicy.length ? 'amber' : 'green'] }}>
          {offPolicy.length ? `${offPolicy.length} SLEEVES TO WATCH` : 'ALL IN POLICY'}
        </span>
      </div>
      <Cards kv={model.totalCards} />
      <div className="module">
        <div className="module-head">
          <span className="label">QUARTERLY SNAPSHOTS</span>
          <span className="label">
            {compact(lo)} — {compact(hi)}
          </span>
        </div>
        <Chart points={[...model.history, { date: 'now', total: model.total }]} />
      </div>
      <div className="module">
        <div className="label">ALLOCATION</div>
        <div className="alloc">
          {model.sleeves.map((s) => (
            <div key={s.key} className="alloc-row">
              <span>{s.name}</span>
              <span className="alloc-bar">
                <span style={{ width: `${s.pct * 100}%` }} />
              </span>
              <span>{pct(s.pct)}</span>
              <span style={{ color: STATUS_COLOR[s.status] }}>{s.alloc}</span>
            </div>
          ))}
        </div>
      </div>
      <OpenLink n={openCount} onOpen={onOpenList} />
    </>
  );
}
