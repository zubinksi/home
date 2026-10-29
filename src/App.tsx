import { useEffect, useMemo, useRef, useState } from 'react';
import { Detail, TotalDetail } from './Detail';
import { ErrorBoundary } from './ErrorBoundary';
import irisWhite from './assets/iris-white.png';
import { LockButton } from './Gate';
import { SectionTabs, useNarrow, useRoute } from './Nav';
import { MobileNav } from './MobileNav';
import { Projects } from './Projects';
import { Servicing } from './Servicing';
import { purchaseCosts, useMarket } from './prices';
import { useDrill } from './useDrill';
import { buildItems, buildSleeves, compact, pct, PORTFOLIO_RULES, STATUS_COLOR, WHEN_RANK, type Item } from './model';

const SEL_TOTAL = -1;
const SEL_ITEMS = -2;
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
  const costs = useMemo(() => purchaseCosts(market.stockHistories), [market.stockHistories]);
  const model = useMemo(() => buildSleeves(market.live, market.series, costs), [market.live, market.series, costs]);
  const allItems = useMemo(() => buildItems(market.live), [market.live]);

  const { route, goTab, openSub, replaceSub, closeSub } = useRoute();
  const tab = route.tab;

  // each section is a different room: Projects has the dark brown wall and a lamp
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.room = tab;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', getComputedStyle(root).getPropertyValue('--ground').trim());
    return () => {
      delete root.dataset.room;
      meta?.setAttribute('content', getComputedStyle(root).getPropertyValue('--ground').trim());
    };
  }, [tab]);
  const narrow = useNarrow();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [done, setDone] = useState<string[]>(loadDone);
  const sleevesRef = useRef<HTMLElement>(null);

  // ── phones: the list is the home view; a row opens its detail as its own page
  const subOf = (i: number) => (i === SEL_TOTAL ? 'total' : i === SEL_ITEMS ? 'items' : model.sleeves[i].key.toLowerCase());
  const selOf = (key: string) => {
    if (key === 'total') return SEL_TOTAL;
    if (key === 'items') return SEL_ITEMS;
    return model.sleeves.findIndex((s) => s.key.toLowerCase() === key);
  };
  // next / previous run through TOTAL and the sleeves (open items sit apart, at the foot of the list)
  const sequence = ['total', ...model.sleeves.map((s) => s.key.toLowerCase())];
  const drill = useDrill({
    narrow,
    sub: tab === 'investments' ? route.sub : null,
    keys: [...sequence, 'items'],
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

  const itemsList = (
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
  );

  return (
    <>
      <header className="masthead">
        {/* straight on the wall: the iris, the three sections, the lock */}
        <div className="mast-inner">
          <div className="mast-bar">
            {/* the iris from our mudroom wallpaper, in the wall's white */}
            <span className="mast-iris" style={{ maskImage: `url(${irisWhite})`, WebkitMaskImage: `url(${irisWhite})` }} aria-hidden />
            <SectionTabs tab={tab} onChange={goTab} />
            <LockButton />
          </div>
        </div>
      </header>
      <div className="doc">
      {tab === 'servicing' && <Servicing />}
      {tab === 'projects' && (
        <Projects narrow={narrow} sub={route.sub} openSub={openSub} replaceSub={replaceSub} closeSub={closeSub} />
      )}
      {tab === 'investments' && (
      <main className="body">
        {/* ── Sleeves ────────────────────────────────────────────────── */}
        <section className="slab sleeves" ref={sleevesRef}>
          <div className={`sleeves-grid ${drill.gridClass}`}>
            {drill.showList && (
            <nav className={`sidebar ${drill.listClass}`}>
              <button className={`side-row total ${!narrow && sel === SEL_TOTAL ? 'is-sel' : ''}`} onClick={() => select(SEL_TOTAL)}>
                <span className="side-caret" aria-hidden />
                <span className="side-name">TOTAL</span>
                <span />
                <span className="side-amt">{compact(model.total)}</span>
              </button>
              <div className="side-sub total-sub">{model.totalSub}</div>
              <div className="side-rule" />

              {model.sleeves.map((s, i) => (
                <button key={s.key} className={`side-row sleeve ${!narrow && sel === i ? 'is-sel' : ''}`} onClick={() => select(i)} title={s.alloc}>
                  <span className="side-caret" aria-hidden />
                  <span className="side-name-wrap">
                    <span className="side-name">{s.name}</span>
                  </span>
                  <span className="side-bar">
                    <span style={{ width: `${Math.min(1, s.pct) * 100}%` }} />
                  </span>
                  <span className="side-pct">{pct(s.pct)}</span>
                  <span className="side-amt">{compact(s.amount)}</span>
                </button>
              ))}

              {/* open items, set apart at the foot of the list */}
              <div className="side-foot">
                <div className="side-rule" />
                <button className={`side-row items-row ${!narrow && sel === SEL_ITEMS ? 'is-sel' : ''}`} onClick={() => select(SEL_ITEMS)}>
                  <span className="side-caret" aria-hidden />
                  <span className="side-name">OPEN ITEMS</span>
                  <span />
                  <span className="items-count">{open.length}</span>
                </button>
              </div>
            </nav>
            )}

            {drill.showDetail && (
            <div key={drill.detailKey} className={`detail ${drill.detailClass}`} {...drill.touchHandlers}>
              {narrow && <MobileNav onBack={drill.back} />}
              <ErrorBoundary resetKey={sel}>
              {sel === SEL_TOTAL && (
                <TotalDetail model={model} />
              )}
              {selected && <Detail key={selected.key} sleeve={selected} market={market} />}
              {sel === SEL_ITEMS && (
                <>
                  <div className="d-title">
                    <span className="d-name">OPEN ITEMS</span>
                  </div>
                  {itemsList}
                </>
              )}
              </ErrorBoundary>
            </div>
            )}
          </div>
        </section>
      </main>
      )}
      </div>
    </>
  );
}
