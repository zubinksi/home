import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import irisUrl from './assets/iris.png';
import { DoorLight } from './DoorLight';

// A household gate, not real security: the code and the data both ship in the
// page's JavaScript. It keeps casual eyes out; see README for the caveat.
const CODE = '5319';
const UNLOCK_KEY = 'browns.unlocked.v1';
const LEN = CODE.length;

function wasUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(on: boolean) {
  try {
    if (on) sessionStorage.setItem(UNLOCK_KEY, '1');
    else sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* private mode: unlock lasts until reload */
  }
}

const LockContext = createContext<() => void>(() => {});

/** Open padlock in the masthead: the shackle snaps shut, then the pin pad returns. */
export function LockButton() {
  const lock = useContext(LockContext);
  const [locking, setLocking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const start = useCallback(() => {
    setLocking((was) => {
      if (!was) timer.current = setTimeout(lock, 560);
      return true;
    });
  }, [lock]);

  // on a keyboard, L locks the site, as the button does; not while typing in a
  // field, nor with a modifier held (Cmd+L is the browser's address bar)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'l' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start]);

  return (
    <button
      className={`mast-lock ${locking ? 'is-locking' : ''}`}
      aria-label="Lock the site"
      aria-keyshortcuts="L"
      title="Lock (L)"
      disabled={locking}
      onClick={start}
    >
      {/* a bronze toggle: the knob slides across to lock */}
      <span className="lock-track" aria-hidden>
        {/* the knob rests left, showing the open lock; locking slides it over
            the open lock and uncovers the closed one beneath where it sat */}
        <svg className="lock-icon lock-icon-closed" viewBox="0 0 12 14">
          <path d="M3.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2" />
          <rect x="2" y="6.5" width="8" height="6" rx="1.2" />
        </svg>
        <svg className="lock-icon lock-icon-open" viewBox="0 0 12 14">
          <path d="M3.5 6.5V4.5a2.5 2.5 0 0 1 5 0" />
          <rect x="2" y="6.5" width="8" height="6" rx="1.2" />
        </svg>
        <span className="lock-knob" />
      </span>
    </button>
  );
}

type LockState = 'locked' | 'wrong' | 'open';

/**
 * The masthead's bronze lock, at the door. The code's digits sit engraved in
 * a long channel; the knob rests locked at the right end and, on the right
 * code, rolls back across them to open.
 */
function GateLock({ state, entered }: { state: LockState; entered: number }) {
  // while locked, the knob can be pushed left with a thumb; let go and it rolls home
  const [drag, setDrag] = useState<number | null>(null); // knob position, 0 (left) … 1 (home)
  const [returning, setReturning] = useState(false);
  const start = useRef<{ x: number; travel: number; scale: number } | null>(null);
  const returnTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(returnTimer.current), []);

  const grab = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (state !== 'locked') return;
    const track = e.currentTarget.parentElement!;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    // the channel is drawn scaled up, so screen pixels and its own differ
    const scale = track.getBoundingClientRect().width / track.offsetWidth;
    start.current = { x: e.clientX, travel: TRAVEL_REM * rem, scale };
    e.currentTarget.setPointerCapture(e.pointerId);
    clearTimeout(returnTimer.current);
    setReturning(false);
    setDrag(1);
  };
  const move = (e: React.PointerEvent<HTMLSpanElement>) => {
    const s0 = start.current;
    if (!s0) return;
    const dx = (e.clientX - s0.x) / s0.scale;
    setDrag(Math.min(1, Math.max(0, 1 + dx / s0.travel)));
  };
  const release = () => {
    if (!start.current) return;
    start.current = null;
    setDrag(null);
    setReturning(true);
    returnTimer.current = setTimeout(() => setReturning(false), 900);
  };

  const knobStyle =
    drag == null
      ? undefined
      : { transform: `translateX(calc(var(--travel) * ${drag})) rotate(calc(var(--spin) * ${drag}))`, transition: 'none' };

  return (
    <span className={`lock-track gate-track is-${state} ${returning ? 'is-returning' : ''}`} aria-hidden>
      <svg className="lock-icon lock-icon-closed" viewBox="0 0 12 14">
        <path d="M3.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2" />
        <rect x="2" y="6.5" width="8" height="6" rx="1.2" />
      </svg>
      <svg className="lock-icon lock-icon-open" viewBox="0 0 12 14">
        <path d="M3.5 6.5V4.5a2.5 2.5 0 0 1 5 0" />
        <rect x="2" y="6.5" width="8" height="6" rx="1.2" />
      </svg>
      <span className="gate-pips">
        {Array.from({ length: LEN }, (_, i) => (
          <span key={i} className={`gate-pip ${i < entered ? 'filled' : ''}`} />
        ))}
      </span>
      <span
        className={`lock-knob ${state === 'locked' ? 'is-grabbable' : ''}`}
        style={knobStyle}
        onPointerDown={grab}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
      />
    </span>
  );
}

/** How far the knob travels along the channel, in rem (matches --travel in styles.css). */
const TRAVEL_REM = 6.875;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export function Gate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(wasUnlocked);
  const [entry, setEntry] = useState('');
  // handing over between the door and the inside: going 'in' after the code,
  // coming back 'out' to the door when locked
  const [handover, setHandover] = useState<'in' | 'out' | null>(null);
  const [wrong, setWrong] = useState(false);
  const opening = entry === CODE;

  const press = useCallback(
    (k: string) => {
      if (wrong || opening) return;
      if (k === 'clear') return setEntry('');
      if (k === 'back') return setEntry((e) => e.slice(0, -1));
      setEntry((e) => (e.length < LEN ? e + k : e));
    },
    [wrong, opening],
  );

  // check once the last digit is in
  useEffect(() => {
    if (entry.length < LEN) return;
    if (entry === CODE) {
      remember(true);
      // let the knob roll all the way open before the door swings
      const t = setTimeout(() => {
        setUnlocked(true);
        setHandover('in');
      }, 1_500);
      return () => clearTimeout(t);
    }
    setWrong(true);
    const t = setTimeout(() => {
      setWrong(false);
      setEntry('');
    }, 650);
    return () => clearTimeout(t);
  }, [entry]);

  useEffect(() => {
    if (unlocked) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Escape') press('clear');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [unlocked, press]);

  // The handover, both ways, with the door laid over the inside. Going in, the
  // pad's contents fade and its paper grows into the slab, whose contents then
  // come up, while the sunlit wall fades slowly to the wall inside throughout; coming out, the same in reverse: the slab's
  // contents fade under the paper, it shrinks back into the pad as the sunlight
  // returns, and the pad's contents come up.
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!handover) return;
    const el = layer.current;
    const card = el?.querySelector<HTMLElement>('.gate-card');
    const slab = document.querySelector<HTMLElement>('.slab');
    const light = el?.querySelector<HTMLElement>('.door-light');
    if (!el || !card || !slab || !light) {
      setHandover(null);
      return;
    }
    const going = handover;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pad = card.getBoundingClientRect();
    const inside = slab.getBoundingClientRect();
    const box = (r: DOMRect) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    // the paper the pad and the slab share, standing in for both as it changes size
    const paper = document.createElement('div');
    paper.className = 'gate-paper';
    Object.assign(paper.style, box(going === 'in' ? pad : inside));
    el.appendChild(paper);
    const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
    const fade = (x: HTMLElement, from: number, to: number, duration: number, delay = 0, easing = 'ease') =>
      x.animate([{ opacity: from }, { opacity: to }], { duration, delay, easing, fill: 'both' });
    // the real slab stays unseen while the paper stands in for it: going in,
    // until the paper has reached it; coming out, once the paper has covered it
    const root = document.documentElement;
    if (going === 'in' && !still) root.dataset.slabHidden = '';
    // the header moves with the paper both ways: lifted above the door, it
    // starts as the paper starts and changes over the same span
    const mast = document.querySelector<HTMLElement>('.masthead');
    if (mast && !still) root.dataset.mastOver = '';
    const runs = still
      ? [going === 'in' ? fade(el, 1, 0, 300) : fade(el, 0, 1, 300)]
      : going === 'in'
        ? [
            fade(card, 1, 0, 180),
            paper.animate([box(pad), box(inside)], { duration: 700, delay: 120, easing: ease, fill: 'forwards' }),
            // the sunlight fades the whole way through, beginning with the pad
            // and lingering a little after the slab's contents are up
            fade(light, 1, 0, 1600, 120, 'ease-in'),
          ]
        : [
            fade(card, 0, 1, 220, 980),
            // the slab's contents go under the paper, which then shrinks into the pad
            fade(paper, 0, 1, 220),
            paper.animate([box(inside), box(pad)], { duration: 700, delay: 240, easing: ease, fill: 'forwards' }),
            fade(light, 0, 1, 900, 200, 'ease-in-out'),
          ];
    if (mast && !still) runs.push(going === 'in' ? fade(mast, 0, 1, 700, 120, ease) : fade(mast, 1, 0, 700, 0, ease));
    let cancelled = false;
    // Going in, when the paper reaches the slab the real slab takes its place,
    // raised above the fading light so the light can't show through it, and
    // its contents come up. Coming out, the slab hides once the paper covers it.
    const settled = still
      ? Promise.resolve()
      : runs[1].finished
          .catch(() => undefined)
          .then(() => {
            if (cancelled) return;
            if (going === 'out') {
              root.dataset.slabHidden = '';
              return;
            }
            delete root.dataset.slabHidden;
            root.dataset.slabOver = '';
            paper.remove();
            const contents = slab.firstElementChild as HTMLElement | null;
            if (!contents) return;
            const up = fade(contents, 0, 1, 300);
            runs.push(up);
            return up.finished.catch(() => undefined).then(() => undefined);
          });
    Promise.all([settled, ...runs.map((a) => a.finished)])
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        if (going === 'out') window.scrollTo(0, 0);
        setHandover(null);
      });
    return () => {
      cancelled = true;
      runs.forEach((a) => a.cancel());
      paper.remove();
      delete root.dataset.slabHidden;
      delete root.dataset.slabOver;
      delete root.dataset.mastOver;
    };
  }, [handover]);

  const lock = useCallback(() => {
    remember(false);
    setEntry('');
    setWrong(false);
    setUnlocked(false);
    setHandover('out');
  }, []);

  const done = opening;
  const lockState: LockState = wrong ? 'wrong' : done ? 'open' : 'locked';
  const card = (
    <>
      <DoorLight />
      <div className="gate">
        <div className="gate-card">
          <div className="gate-mast">
            <img className="gate-iris" src={irisUrl} alt="" />
            <div className="mast-title">HOME OFFICES</div>
            <div className="mast-line2">
              <span className="mast-of">of</span>
              <span className="mast-title">THE BROWNS</span>
            </div>
          </div>

          {/* not shown (the lock says it), but read out to screen readers */}
          <div className="gate-status" aria-live="polite">
            {wrong ? 'Incorrect code' : done ? 'Opening' : 'Enter the code'}
          </div>

          <div
            className={`gate-lock ${wrong ? 'shake' : ''}`}
            role="img"
            aria-label={`${entry.length} of ${LEN} digits entered`}
          >
            <GateLock state={lockState} entered={entry.length} />
          </div>

          <div className="keypad">
            {KEYS.map((k) => (
              <button
                key={k}
                className={`key ${k === 'clear' || k === 'back' ? 'key-fn' : ''}`}
                onClick={() => press(k)}
                aria-label={k === 'clear' ? 'Clear' : k === 'back' ? 'Delete last digit' : k}
              >
                {k === 'clear' ? 'CLEAR' : k === 'back' ? '⌫' : k}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  // the door stays in the same place in the tree while it hands over, so its
  // light keeps running through the transition
  return (
    <LockContext.Provider value={lock}>
      {(unlocked || handover === 'out') && children}
      {(!unlocked || handover === 'in') && (
        <div ref={layer} className={handover ? 'gate-layer is-handing-over' : 'gate-layer'}>
          {card}
        </div>
      )}
    </LockContext.Provider>
  );
}
