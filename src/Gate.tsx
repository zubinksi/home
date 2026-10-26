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
        <span className="lock-knob" />
      </span>
    </button>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export function Gate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(wasUnlocked);
  const [entry, setEntry] = useState('');
  const [wrong, setWrong] = useState(false);

  const press = useCallback(
    (k: string) => {
      if (wrong) return;
      if (k === 'clear') return setEntry('');
      if (k === 'back') return setEntry((e) => e.slice(0, -1));
      setEntry((e) => (e.length < LEN ? e + k : e));
    },
    [wrong],
  );

  // check once the last digit is in
  useEffect(() => {
    if (entry.length < LEN) return;
    if (entry === CODE) {
      remember(true);
      const t = setTimeout(() => setUnlocked(true), 160);
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

  if (unlocked) return <LockContext.Provider value={lock}>{children}</LockContext.Provider>;

  const done = entry === CODE;
  return (
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

        <div className={`gate-slots ${wrong ? 'shake' : ''}`} role="img" aria-label={`${entry.length} of ${LEN} digits entered`}>
          {Array.from({ length: LEN }, (_, i) => (
            <span key={i} className={`gate-slot ${i < entry.length ? 'filled' : ''} ${wrong ? 'wrong' : ''} ${done ? 'done' : ''}`} />
          ))}
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
}
