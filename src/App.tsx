import { useEffect, useMemo, useRef, useState } from 'react';
import { Ask, type ChatTurn } from './Ask';
import { Detail, TotalDetail } from './Detail';
import { buildItems, buildSleeves, compact, monYY, PORTFOLIO_RULES, STATUS_COLOR, WHEN_RANK, type Item } from './model';

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
  const model = useMemo(buildSleeves, []);
  const allItems = useMemo(buildItems, []);

  const [sel, setSel] = useState(SEL_TOTAL);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [done, setDone] = useState<string[]>(loadDone);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const itemsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(done));
    } catch {
      /* private mode: state just won't persist */
    }
  }, [done]);

  const open = allItems.filter((i) => !done.includes(i.id)).sort((a, b) => WHEN_RANK[a.when] - WHEN_RANK[b.when]);
  const closed = allItems.filter((i) => done.includes(i.id));
  const openCount = (key: string) => open.filter((i) => i.sleeve === key).length;

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const openTheList = () => {
    setItemsOpen(true);
    itemsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const policyFor = (item: Item) =>
    item.sleeve === 'POLICY' ? PORTFOLIO_RULES : model.sleeves.find((s) => s.key === item.sleeve)!.policy;

  const selected = sel >= 0 ? model.sleeves[sel] : null;

  return (
    <div className="doc">
      <header className="masthead">
        <div>
          <div className="mast-title">INVESTMENT POLICY</div>
          <div className="mast-line2">
            <span className="mast-of">of</span>
            <span className="mast-title">THE BROWNS</span>
          </div>
        </div>
        <div className="mast-title mast-date">{monYY(new Date())}</div>
      </header>

      <main className="body">
        {/* ── Open items ─────────────────────────────────────────────── */}
        <section className={`slab items ${itemsOpen ? 'is-open' : ''}`} ref={itemsRef}>
          <button className="items-head" onClick={() => setItemsOpen(!itemsOpen)} aria-expanded={itemsOpen}>
            <span className={`caret ${itemsOpen ? '' : 'closed'}`}>▾</span>
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
                      <span className={`caret small ${isExp ? '' : 'closed'}`}>▾</span>
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
                <div className="closed">
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
        <section className="slab sleeves">
          <div className="sleeves-head">BROWN HOUSEHOLD</div>
          <div className="sleeves-grid">
            <nav className="sidebar">
              <button className={`side-row total ${sel === SEL_TOTAL ? 'is-sel' : ''}`} onClick={() => setSel(SEL_TOTAL)}>
                <span className="side-caret">&gt;</span>
                <span className="side-name">TOTAL</span>
                <span />
                <span className="side-amt">{compact(model.total)}</span>
              </button>
              <div className="side-sub">{model.totalSub}</div>
              <div className="side-rule" />

              {model.sleeves.map((s, i) => (
                <button key={s.key} className={`side-row ${sel === i ? 'is-sel' : ''}`} onClick={() => setSel(i)}>
                  <span className="side-caret">&gt;</span>
                  <span className="side-name-wrap">
                    <span className="side-name">{s.name}</span>
                    {(s.status === 'amber' || s.status === 'red') && (
                      <span className="dot" style={{ background: STATUS_COLOR[s.status] }} title={s.alloc} />
                    )}
                  </span>
                  <span />
                  <span className="side-amt">{compact(s.amount)}</span>
                </button>
              ))}

              <button className={`side-row ask ${sel === SEL_ASK ? 'is-sel' : ''}`} onClick={() => setSel(SEL_ASK)}>
                <span className="side-caret">&gt;</span>
                <span className="side-name">ASK THE POLICY</span>
                <span />
                <span className="ask-arrow">→</span>
              </button>
            </nav>

            <div className="detail">
              {sel === SEL_TOTAL && (
                <TotalDetail model={model} openCount={open.length} onOpenList={openTheList} />
              )}
              {selected && <Detail sleeve={selected} openCount={openCount(selected.key)} onOpenList={openTheList} />}
              {sel === SEL_ASK && <Ask chat={chat} setChat={setChat} />}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>MAINTAINED BY THE BROWN HOUSEHOLD · REVIEWED QUARTERLY</span>
        <span>@{new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
