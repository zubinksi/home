import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import irisUrl from './assets/iris.png';

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

  return (
    <button
      className={`mast-lock ${locking ? 'is-locking' : ''}`}
      aria-label="Lock the site"
      title="Lock"
      disabled={locking}
      onClick={() => {
        setLocking(true);
        timer.current = setTimeout(lock, 560);
      }}
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
  return (
    <span className={`lock-track gate-track is-${state}`} aria-hidden>
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
      <span className="lock-knob" />
    </span>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export function Gate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(wasUnlocked);
  const [entry, setEntry] = useState('');
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
      const t = setTimeout(() => setUnlocked(true), 1_500);
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

  const lock = useCallback(() => {
    remember(false);
    setEntry('');
    setWrong(false);
    setUnlocked(false);
  }, []);

  const done = opening;
  const lockState: LockState = wrong ? 'wrong' : done ? 'open' : 'locked';
  const card = (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-mast">
          <img className="gate-iris" src={irisUrl} alt="" />
          <div className="mast-title">THE HOUSEHOLD</div>
          <div className="mast-line2">
            <span className="mast-of">of</span>
            <span className="mast-title">THE BROWNS</span>
          </div>
        </div>

        <div className={`gate-label ${wrong ? 'is-wrong' : ''} ${done ? 'is-done' : ''}`} aria-live="polite">
          {wrong ? 'INCORRECT CODE' : done ? 'OPENING' : 'ENTER CODE'}
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
  );

  return unlocked ? <LockContext.Provider value={lock}>{children}</LockContext.Provider> : card;
}
