import { useEffect, useRef, useState } from 'react';
import type { Turn } from './askCore';
import { buildSleeves, PORTFOLIO_RULES } from './model';

export type ChatTurn = Turn & { pending?: boolean };

const KEY_STORE = 'browns.anthropicKey.v1';

function loadKey(): string {
  try {
    return localStorage.getItem(KEY_STORE) ?? '';
  } catch {
    return '';
  }
}

function saveKey(k: string) {
  try {
    if (k) localStorage.setItem(KEY_STORE, k);
    else localStorage.removeItem(KEY_STORE);
  } catch {
    /* private mode: key lasts for this visit only */
  }
}

/** Policy lines that share the most words with the question. */
function closestLines(q: string): string[] {
  const words = new Set(q.toLowerCase().match(/[a-z0-9$%]{3,}/g) ?? []);
  const lines = [
    ...buildSleeves().sleeves.flatMap((s) => s.policy.map((l) => ({ l, tag: s.name }))),
    ...PORTFOLIO_RULES.map((l) => ({ l, tag: 'PORTFOLIO' })),
  ];
  return lines
    .map(({ l, tag }) => ({ l, tag, score: (l.toLowerCase().match(/[a-z0-9$%]{3,}/g) ?? []).filter((w) => words.has(w) || words.has(tag.toLowerCase())).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ l, tag }) => `${tag}: “${l}”`);
}

type ServerResult = { answer: string } | { error: string } | { unavailable: true };

/** Try the local server first; it holds the key in .env.local. */
async function askServer(question: string, history: Turn[]): Promise<ServerResult> {
  let res: Response;
  try {
    res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history }),
    });
  } catch {
    return { unavailable: true };
  }
  const data = await res.json().catch(() => null);
  if (res.ok && data?.answer) return { answer: data.answer };
  if (data?.message) return { error: data.message };
  // 503 no-key, or no endpoint at all (static hosting, opened from a file)
  return { unavailable: true };
}

/** Fallback: call the API straight from this browser with a key saved here. */
async function askDirect(key: string, question: string, history: Turn[]): Promise<ServerResult> {
  const [{ default: Anthropic }, { askPolicy, describeError }, { default: policy }] = await Promise.all([
    import('@anthropic-ai/sdk'),
    import('./askCore'),
    import('../policy/investment-policy.md?raw'),
  ]);
  try {
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    return { answer: await askPolicy(client, policy, question, history) };
  } catch (err) {
    return { error: describeError(err) };
  }
}

export function Ask({ chat, setChat }: { chat: ChatTurn[]; setChat: (c: ChatTurn[]) => void }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(loadKey);
  const [keyDraft, setKeyDraft] = useState('');
  const [needKey, setNeedKey] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  // Braces matter: newer browsers return a Promise from scrollIntoView, and
  // React would try to call whatever the effect returns as its cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [chat, needKey]);

  const ask = async (q: string, base: ChatTurn[] = chat, apiKey = key) => {
    q = q.trim();
    if (!q || busy) return;
    const history: Turn[] = base.filter((t) => !t.pending).map(({ who, text }) => ({ who, text }));
    const next: ChatTurn[] = [...history, { who: 'you', text: q }];
    setChat([...next, { who: 'policy', text: 'Reading the policy…', pending: true }]);
    setDraft('');
    setBusy(true);

    let result = await askServer(q, history);
    if ('unavailable' in result && apiKey) result = await askDirect(apiKey, q, history);

    let answer: string;
    if ('answer' in result) {
      answer = result.answer;
      setNeedKey(false);
    } else if ('error' in result) {
      answer = `Couldn’t get an answer. ${result.error}`;
    } else {
      setNeedKey(true);
      const near = closestLines(q);
      answer =
        'To answer in full, Ask the Policy needs an Anthropic API key. Paste one below and it will be saved in this browser only.' +
        (near.length ? ` Closest lines in the meantime: ${near.join(' ')}` : '');
    }
    setChat([...next, { who: 'policy', text: answer }]);
    setBusy(false);
  };

  const saveAndRetry = () => {
    const k = keyDraft.trim();
    if (!k) return;
    saveKey(k);
    setKey(k);
    setKeyDraft('');
    setNeedKey(false);
    // re-ask the question that was waiting on a key
    const lastYou = [...chat].reverse().findIndex((t) => t.who === 'you');
    if (lastYou >= 0) {
      const idx = chat.length - 1 - lastYou;
      ask(chat[idx].text, chat.slice(0, idx), k);
    }
  };

  return (
    <div className="ask-pane">
      <div className="d-title">
        <span className="d-name">ASK THE POLICY</span>
      </div>
      <div className="chat">
        {chat.map((t, i) => (
          <div key={i} className={`msg ${t.who}`}>
            <div className="label">{t.who === 'you' ? 'YOU' : 'POLICY'}</div>
            <div className={`msg-text ${t.pending ? 'pending' : ''}`}>{t.text}</div>
          </div>
        ))}
        <div ref={end} />
      </div>

      {needKey && (
        <form
          className="ask-input key"
          onSubmit={(e) => {
            e.preventDefault();
            saveAndRetry();
          }}
        >
          <input
            type="password"
            autoComplete="off"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="Anthropic API key (sk-ant-…)"
            aria-label="Anthropic API key"
          />
          <button type="submit">SAVE KEY</button>
        </form>
      )}

      <form
        className="ask-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What does the policy say about…" />
        <button type="submit" disabled={busy} className={busy ? 'busy' : ''}>
          ASK
        </button>
      </form>
      {key && (
        <div className="key-note">
          API KEY SAVED IN THIS BROWSER ·{' '}
          <button
            onClick={() => {
              saveKey('');
              setKey('');
            }}
          >
            FORGET
          </button>
        </div>
      )}
    </div>
  );
}
