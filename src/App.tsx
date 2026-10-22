import { useEffect, useMemo, useRef, useState } from 'react';
import { Ask, type ChatTurn } from './Ask';
import { Detail, TotalDetail } from './Detail';
import { ErrorBoundary } from './ErrorBoundary';
import { LockButton } from './Gate';
import { NavBar, useNarrow, useRoute } from './Nav';
import { MobileNav } from './MobileNav';
import { Projects } from './Projects';
import { useMarket } from './prices';
import { useDrill } from './useDrill';
import { LightSwitch } from './LightSwitch';
import { buildItems, buildSleeves, compact, longDate, pct, PORTFOLIO_RULES, STATUS_COLOR, WHEN_RANK, type Item } from './model';

const SEL_TOTAL = -1;
const SEL_ASK = -2;
const DONE_KEY = 'browns.done.v1';

function loadDone(): string[] {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function App() {
  const market = useMarket();
  const model = useMemo(() => buildSleeves(market.live, market.series), [market.live, market.series]);
  const allItems = useMemo(() => buildItems(market.live), [market.live]);

  const { route, goTab, openSub, replaceSub, closeSub } = useRoute();
  const tab = route.tab;
  const narrow = useNarrow();
  const [itemsOpen, setItemsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [done, setDone] = useState<string[]>(loadDone);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const sleevesRef = useRef<HTMLElement>(null);

  // ── phones: the list is the home view; a row opens its detail as its own page
  const subOf = (i: number) => (i === SEL_TOTAL ? 'total' : i === SEL_ASK ? 'ask' : model.sleeves[i].key.toLowerCase());
  const selOf = (key: string) => {
    if (key === 'total') return SEL_TOTAL;
    if (key === 'ask') return SEL_ASK;
    return model.sleeves.findIndex((s) => s.key.toLowerCase() === key);
  };
  // next / previous run through TOTAL and the sleeves (Ask is separate)
  const sequence = ['total', ...model.sleeves.map((s) => s.key.toLowerCase())];
  const drill = useDrill({
    narrow,
    sub: tab === 'investments' ? route.sub : null,
    keys: [...sequence, 'ask'],
    sequence,
    defaultKey: 'total',
    openSub,
    replaceSub,
    closeSub,
    panelRef: sleevesRef,
  });
  const sel = selOf(drill.selKey);
  const select = (i: number) => drill.select(subOf(i));

  useEffect(() => {
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(done));
    } catch {
      /* private mode: state just won't persist */
    }
  }, [done]);

  const open = allItems.filter((i) => !done.includes(i.id)).sort((a, b) => WHEN_RANK[a.when] - WHEN_RANK[b.when]);
  const closed = allItems.filter((i) => done.includes(i.id));

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);


  const policyFor = (item: Item) =>
    item.sleeve === 'POLICY' ? PORTFOLIO_RULES : model.sleeves.find((s) => s.key === item.sleeve)!.policy;

  const selected = sel >= 0 ? model.sleeves[sel] : null;

  return (
    <>
      <header className="masthead">
        <div className="mast-inner">
          <div>
            <div className="mast-title">THE HOUSEHOLD</div>
            <div className="mast-line2">
              <span className="mast-of">of</span>
              <span className="mast-title">THE BROWNS</span>
            </div>
          </div>
          <div className="mast-right">
            <div className="mast-title mast-date">{longDate(new Date())}</div>
            <div className="mast-controls">
              <LightSwitch />
              <LockButton />
            </div>
          </div>
        </div>
      </header>
      <div className="doc">
      {tab === 'projects' && (
        <Projects narrow={narrow} sub={route.sub} openSub={openSub} replaceSub={replaceSub} closeSub={closeSub} />
      )}
      {tab === 'investments' && (
      <main className="body">
        {/* ── Open items ─────────────────────────────────────────────── */}
        <section className={`slab items ${itemsOpen ? 'is-open' : ''}`}>
          <button className="items-head" onClick={() => setItemsOpen(!itemsOpen)} aria-expanded={itemsOpen}>
            <span className={`caret ${itemsOpen ? '' : 'closed'}`} aria-hidden />
            <span>{open.length} OPEN ITEMS</span>
          </button>

          {itemsOpen && (
            <div className="items-body">
              {open.length === 0 && <div className="items-empty">NOTHING OPEN. THE POLICY STANDS AS WRITTEN UNTIL THE Q1 REVIEW.</div>}

              {open.map((item) => {
                const isExp = expanded.includes(item.id);
                const sleeve = model.sleeves.find((s) => s.key === item.sleeve);
                return (
                  <div key={item.id} className={`item ${isExp ? 'is-expanded' : ''}`}>
                    <div className="item-row" onClick={() => setExpanded(toggle(expanded, item.id))}>
                      <button
                        className="check"
                        aria-label="Mark done"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDone([...done, item.id]);
                          setExpanded(expanded.filter((x) => x !== item.id));
                        }}
                      />
                      <span className="item-text">{item.text}</span>
                      <span className="item-sleeve">{item.sleeve}</span>
                      <span className={`tag tag-${item.when.replace(' ', '-')}`}>{item.when}</span>
                      <span className={`caret small ${isExp ? '' : 'closed'}`} aria-hidden />
                    </div>
                    {isExp && (
                      <div className="item-why">
                        <div className="label">WHY THIS IS ON THE LIST</div>
                        {policyFor(item).map((line, i) => (
                          <p key={i} className="policy-line">
                            <span className="sect">§</span>
                            {line}
                          </p>
                        ))}
                        {sleeve && (
                          <div className="item-foot">
                            <span>SLEEVE VALUE ${compact(sleeve.amount)}</span>
                            <span style={{ color: STATUS_COLOR[sleeve.status] }}>{sleeve.alloc}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {closed.length > 0 && (
                <div className="closed-list">
                  <div className="label closed-label">[{closed.length}] RECENTLY CLOSED · CLICK TO REOPEN</div>
                  {closed.map((item) => (
                    <div key={item.id} className="item is-closed">
                      <div className="item-row" onClick={() => setDone(done.filter((x) => x !== item.id))}>
                        <span className="tick">✓</span>
                        <span className="item-text">{item.text}</span>
                        <span className="item-sleeve">{item.sleeve}</span>
                        <span className="tag tag-done">done</span>
                        <span />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Sleeves ────────────────────────────────────────────────── */}
        <section className="slab sleeves" ref={sleevesRef}>
          <div className={`sleeves-grid ${drill.gridClass}`}>
            {drill.showList && (
            <nav className={`sidebar ${drill.listClass}`}>
              <button className={`side-row total ${!narrow && sel === SEL_TOTAL ? 'is-sel' : ''}`} onClick={() => select(SEL_TOTAL)}>
                <span className="side-caret">&gt;</span>
                <span className="side-name">TOTAL</span>
                <span />
                <span className="side-amt">{compact(model.total)}</span>
              </button>
              <div className="side-sub">{model.totalSub}</div>
              <div className="side-rule" />

              {model.sleeves.map((s, i) => (
                <button key={s.key} className={`side-row sleeve ${!narrow && sel === i ? 'is-sel' : ''}`} onClick={() => select(i)} title={s.alloc}>
                  <span className="side-caret">&gt;</span>
                  <span className="side-name-wrap">
                    <span className="side-name">{s.name}</span>
                    {(s.status === 'amber' || s.status === 'red') && (
                      <span className="dot" style={{ background: STATUS_COLOR[s.status] }} title={s.alloc} />
                    )}
                  </span>
                  <span className="side-bar">
                    <span style={{ width: `${Math.min(1, s.pct) * 100}%` }} />
                  </span>
                  <span className="side-pct">{pct(s.pct)}</span>
                  <span className="side-amt">{compact(s.amount)}</span>
                </button>
              ))}

              <button className={`side-row ask ${!narrow && sel === SEL_ASK ? 'is-sel' : ''}`} onClick={() => select(SEL_ASK)}>
                <span className="side-caret">&gt;</span>
                <span className="side-name">ASK THE POLICY</span>
                <span />
                <span className="ask-arrow">→</span>
              </button>
            </nav>
            )}

            {drill.showDetail && (
            <div key={drill.detailKey} className={`detail ${drill.detailClass}`} {...drill.touchHandlers}>
              {narrow && <MobileNav onBack={drill.back} position={drill.position} onStep={drill.step} />}
              <ErrorBoundary resetKey={sel}>
              {sel === SEL_TOTAL && (
                <TotalDetail model={model} market={market} />
              )}
              {selected && <Detail key={selected.key} sleeve={selected} />}
              {sel === SEL_ASK && <Ask chat={chat} setChat={setChat} live={market.live} />}
              </ErrorBoundary>
            </div>
            )}
          </div>
        </section>
      </main>
      )}
      </div>
      <NavBar tab={tab} onChange={goTab} />
    </>
  );
}
