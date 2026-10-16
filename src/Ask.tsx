import { useEffect, useRef, useState } from 'react';
import { buildSleeves, PORTFOLIO_RULES } from './model';

export type ChatTurn = { who: 'you' | 'policy'; text: string; pending?: boolean };

const SUGGESTIONS = [
  'HYPE just hit $100. What do we do?',
  'Markets are down 40%. Can we change the rules?',
  'Evergreen sent $60K. Where does it go?',
  'Can we prepay the mortgage this year?',
];

/** Without an API key, point at the policy lines that share the most words with the question. */
function closestLines(q: string): string[] {
  const words = new Set(q.toLowerCase().match(/[a-z0-9$%]{3,}/g) ?? []);
  const sleeves = buildSleeves().sleeves;
  const lines = [
    ...sleeves.flatMap((s) => s.policy.map((l) => ({ l, tag: s.name }))),
    ...PORTFOLIO_RULES.map((l) => ({ l, tag: 'PORTFOLIO' })),
  ];
  return lines
    .map(({ l, tag }) => ({ l, tag, score: (l.toLowerCase().match(/[a-z0-9$%]{3,}/g) ?? []).filter((w) => words.has(w) || words.has(tag.toLowerCase())).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ l, tag }) => `${tag}: “${l}”`);
}

export function Ask({ chat, setChat }: { chat: ChatTurn[]; setChat: (c: ChatTurn[]) => void }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [chat]);

  const ask = async (q: string) => {
    q = q.trim();
    if (!q || busy) return;
    const history = chat.filter((t) => !t.pending);
    const next: ChatTurn[] = [...history, { who: 'you', text: q }];
    setChat([...next, { who: 'policy', text: 'Reading the policy…', pending: true }]);
    setDraft('');
    setBusy(true);
    let answer: string;
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.answer) answer = data.answer;
      else if (data.error === 'no-key') {
        const near = closestLines(q);
        answer =
          'Ask the Policy needs an ANTHROPIC_API_KEY in .env.local to answer in full.' +
          (near.length ? ` Closest lines in the meantime — ${near.join(' ')}` : '');
      } else answer = 'Couldn’t reach the policy just now. Try again in a moment — or read the § lines on the sleeve it concerns.';
    } catch {
      answer = 'Couldn’t reach the policy just now. Try again in a moment — or read the § lines on the sleeve it concerns.';
    }
    setChat([...next, { who: 'policy', text: answer }]);
    setBusy(false);
  };

  return (
    <div className="ask-pane">
      <div className="d-title">
        <span className="d-name">ASK THE POLICY</span>
      </div>
      <div className="chat">
        {chat.length === 0 && (
          <div className="suggest">
            <div className="label">TRY ONE OF THESE</div>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {chat.map((t, i) => (
          <div key={i} className={`msg ${t.who}`}>
            <div className="label">{t.who === 'you' ? 'YOU' : 'POLICY'}</div>
            <div className={`msg-text ${t.pending ? 'pending' : ''}`}>{t.text}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
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
    </div>
  );
}
