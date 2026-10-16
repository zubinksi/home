// Derives everything the page shows from src/data.ts + the policy rules.

import { diversifiedGoalDate, holdings, household, items, reviewDate, snapshots } from './data';

export type Status = 'green' | 'amber' | 'red' | 'muted';
export type When = 'this week' | 'this month' | 'before fill' | 'q1 review';
export type SleeveKey = 'HYPE' | 'AAPL' | 'FORTRESS' | 'ZEC' | 'EQUITIES' | 'DIVERSIFIED';

export const STATUS_COLOR: Record<Status, string> = {
  green: '#356b39',
  amber: '#7d5716',
  red: '#8f3338',
  muted: '#61604f',
};

export const WHEN_RANK: Record<When | 'done', number> = {
  'this week': 0,
  'this month': 1,
  'before fill': 2,
  'q1 review': 3,
  done: 4,
};

export interface KV {
  k: string;
  v: string;
  d?: string;
  dc?: Status;
}

export interface Rung {
  price: number;
  tokens: number;
}

export type Module =
  | { kind: 'ladder'; rungs: Rung[]; sold: number; next: number; price: number; keep: number; total: number }
  | { kind: 'gauge'; now: number; target: number; floor: number; max: number }
  | { kind: 'plan'; rows: { source: string; amount: string; when: string }[]; goal: number; goalDate: string }
  | { kind: 'tax'; rows: { k: string; v: string; color?: Status }[]; note?: string };

export interface Sleeve {
  key: SleeveKey;
  name: string;
  amount: number;
  pct: number;
  roleTitle: string;
  status: Status;
  alloc: string;
  cap: { cap: number | null; kind: 'cap' | 'trim' | 'goal' | 'target' | 'frozen' };
  kv: KV[];
  policy: string[];
  module?: Module;
}

export interface PlanStep {
  sleeve: SleeveKey;
  action: string;
  amount: number;
  why: string;
}

export interface Item {
  id: string;
  sleeve: SleeveKey | 'POLICY';
  text: string;
  when: When;
}

// ── formatting ──────────────────────────────────────────────────────────────

/** 1126900 → "1.1M", 435500 → "436K", 0 → "0" */
export function compact(n: number): string {
  if (n === 0) return '0';
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `${Math.round(n)}`;
}

export const money = (n: number) => `$${compact(n)}`;
export const pct = (n: number, dp = 0) => `${(n * 100).toFixed(dp)}%`;
export const num = (n: number) => n.toLocaleString('en-US');
const dash = (v: number | null, f: (n: number) => string) => (v == null ? '—' : f(v));

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** "2026-07-01" → "JUL 26" */
export function monYY(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  return `${MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
}

// ── policy constants (from policy/investment-policy.md) ─────────────────────

export const RULES = {
  fortressTargetMonths: 30,
  austerityMonths: 18,
  cryptoCeiling: 0.45,
  cryptoTrimTo: 0.4,
  zecTrimAt: 0.1,
  zecTrimTo: 0.07,
  diversifiedGoal: 0.3,
  ascentCap: 0.1,
  maxPosition: 0.05,
  taxSetAside: 0.3,
  hypeFloor: 40,
  hypeKeep: 750,
};

export const LADDER: Rung[] = [
  { price: 100, tokens: 250 },
  { price: 125, tokens: 500 },
  { price: 150, tokens: 1_000 },
  { price: 175, tokens: 1_500 },
  { price: 200, tokens: 1_500 },
  { price: 225, tokens: 1_000 },
];

export const PORTFOLIO_RULES = [
  'This portfolio is our only income. Its first job is making sure we are never forced to sell something at a bad time to pay our bills.',
  'We don’t change these rules in the middle of a scary market. Changes happen at the annual review, in writing, signed by both of us.',
  'We never borrow against the portfolio.',
  'No new position over 5% of liquid assets. 48-hour waiting period on any trade over $25k.',
  'No treating Evergreen or home equity as money we can spend.',
];

// ── derivation ──────────────────────────────────────────────────────────────

export function buildSleeves() {
  const h = holdings;
  const hype = h.hype.tokens * h.hype.price;
  const zec = h.zec.tokens * h.zec.price;
  const div = h.diversified.voo + h.diversified.vxus + h.diversified.avuv;
  const total = hype + h.aapl.value + h.fortress.value + zec + h.equities.value + div;
  const share = (v: number) => (total ? v / total : 0);

  const burn = household.annualSpend / 12;
  const fortressMonths = Math.round((h.fortress.value / burn) * 100) / 100;
  const crypto = share(hype) + share(zec);

  // ── HYPE
  const hypeStatus: Status = crypto >= RULES.cryptoCeiling ? 'red' : crypto >= RULES.cryptoCeiling - 0.05 ? 'amber' : 'green';
  const ladderTotal = LADDER.reduce((s, r) => s + r.price * r.tokens, 0);
  const nextRung = h.hype.rungsSold < LADDER.length ? h.hype.rungsSold : -1;
  const hypeGain = h.hype.basis == null ? null : hype - h.hype.basis;

  // ── ZEC
  const zecShare = share(zec);
  const zecStatus: Status = zecShare > RULES.zecTrimAt ? 'red' : zecShare > RULES.zecTrimAt - 0.02 ? 'amber' : 'green';
  const zecGain = h.zec.basis == null ? null : zec - h.zec.basis;

  // ── AAPL
  const aaplGain = h.aapl.basis == null ? null : h.aapl.value - h.aapl.basis;
  const aaplTax = h.aapl.value * RULES.taxSetAside;

  // ── FORTRESS
  const fortressStatus: Status =
    fortressMonths < RULES.austerityMonths ? 'red' : fortressMonths < RULES.fortressTargetMonths - 0.5 ? 'amber' : 'green';

  // ── THIS REVIEW: trims and refills the policy calls for (§2, §3, §4, §5)
  const plan: PlanStep[] = [];
  const zecTrimTokens = zecShare > RULES.zecTrimAt ? Math.ceil((zec - RULES.zecTrimTo * total) / h.zec.price) : 0;
  const zecAfter = zec - zecTrimTokens * h.zec.price;
  const cryptoTarget = RULES.cryptoTrimTo * total;
  const hypeTrimTokens =
    crypto > RULES.cryptoCeiling
      ? Math.min(h.hype.tokens - RULES.hypeKeep, Math.max(0, Math.ceil((hype + zecAfter - cryptoTarget) / h.hype.price)))
      : 0;
  if (zecTrimTokens > 0)
    plan.push({
      sleeve: 'ZEC',
      action: `Sell ${num(zecTrimTokens)} ZEC at $${num(h.zec.price)}`,
      amount: zecTrimTokens * h.zec.price,
      why: `ZEC is ${pct(zecShare, 1)} of liquid, past the 10% line. Trim back to 7%.`,
    });
  if (hypeTrimTokens > 0)
    plan.push({
      sleeve: 'HYPE',
      action: `Sell ${num(hypeTrimTokens)} HYPE at $${num(h.hype.price)}`,
      amount: hypeTrimTokens * h.hype.price,
      why: `HYPE + ZEC are ${pct(crypto)} of liquid, over the 45% ceiling. Trim back to 40% within 30 days.`,
    });
  const proceeds = plan.reduce((s, p) => s + p.amount, 0);
  const taxReserve = proceeds * RULES.taxSetAside;
  const toWork = proceeds - taxReserve;
  const fortressGap = Math.max(0, RULES.fortressTargetMonths * burn - h.fortress.value);
  const toFortress = Math.min(toWork, fortressGap);
  const toDiversified = toWork - toFortress;
  if (taxReserve > 0)
    plan.push({ sleeve: 'FORTRESS', action: 'Set aside 30% for taxes', amount: taxReserve, why: 'Held in the Fortress, reserved for the estimated tax payment. Not counted toward months of coverage.' });
  if (toFortress > 0)
    plan.push({
      sleeve: 'FORTRESS',
      action: `Refill the Fortress to ${RULES.fortressTargetMonths} months`,
      amount: toFortress,
      why: `The Fortress covers ${Math.floor(fortressMonths)} months. Refill from what is up, HYPE proceeds first.`,
    });
  if (toDiversified > 0)
    plan.push({ sleeve: 'DIVERSIFIED', action: 'Fund Diversified: VOO 55 · VXUS 30 · AVUV 15', amount: toDiversified, why: 'Anything above the Fortress target goes to the Diversified sleeve. Over $100K goes in in thirds.' });
  const hypeTokensAfter = h.hype.tokens - hypeTrimTokens;
  const cryptoAfter = (hype - hypeTrimTokens * h.hype.price + zecAfter) / total;
  const fortressMonthsAfter = (h.fortress.value + toFortress) / burn;

  // ── DIVERSIFIED
  const divShare = share(div);
  const divGoal = total * RULES.diversifiedGoal;
  const divStatus: Status = div === 0 ? 'red' : divShare >= RULES.diversifiedGoal ? 'green' : 'amber';

  // ── EQUITIES (flexible bucket / Ascent)
  const eqShare = share(h.equities.value);
  const eqStatus: Status = eqShare > RULES.ascentCap ? 'red' : div === 0 && h.equities.value > 0 ? 'amber' : 'green';

  const sleeves: Sleeve[] = [
    {
      key: 'HYPE',
      name: 'HYPE',
      amount: hype,
      pct: share(hype),
      roleTitle: `Our biggest bet — ${num(h.hype.tokens)} tokens, skimmed on the way up`,
      status: hypeStatus,
      alloc: crypto > RULES.cryptoCeiling ? `CRYPTO ${pct(crypto)} · OVER ${pct(RULES.cryptoCeiling)} CEILING` : `CRYPTO ${pct(crypto)} OF ${pct(RULES.cryptoCeiling)} CEILING`,
      cap: { cap: RULES.cryptoCeiling, kind: 'cap' },
      kv: [
        { k: 'PRICE', v: `$${num(h.hype.price)}`, d: `FLOOR $${RULES.hypeFloor}` },
        { k: 'TOKENS', v: num(h.hype.tokens), d: `KEEP ${num(RULES.hypeKeep)} FOREVER` },
        { k: 'BASIS', v: dash(h.hype.basis, money) },
        {
          k: 'GAIN',
          v: dash(hypeGain, money),
          d: hypeGain == null ? 'ADD BASIS' : `${hypeGain >= 0 ? '▲' : '▼'} ${pct(hypeGain / (h.hype.basis || 1))}`,
          dc: hypeGain == null ? undefined : hypeGain >= 0 ? 'green' : 'red',
        },
      ],
      policy: [
        'HYPE + ZEC can’t exceed 45% of liquid assets (checked quarterly). If it does, we trim back to 40% within 30 days.',
        'The sell ladder is pre-committed. When the price hits the number, we sell. No skipping a rung because it “obviously” has further to run.',
        'We keep 750 tokens forever, at any price — our oldest, cheapest-basis tokens.',
        'Below $40 we never sell HYPE to pay for living expenses. Period.',
        'We never buy more HYPE with Fortress or Diversified money. Gains get skimmed; dips get held, not bought.',
        'Set aside 30% of every sale into the Fortress for taxes. The ladder always wins over tax optimization.',
      ],
      module: { kind: 'ladder', rungs: LADDER, sold: h.hype.rungsSold, next: nextRung, price: h.hype.price, keep: RULES.hypeKeep, total: ladderTotal },
    },
    {
      key: 'AAPL',
      name: 'AAPL',
      amount: h.aapl.value,
      pct: share(h.aapl.value),
      roleTitle: 'The 20-year holding — a third concentrated bet, left alone',
      status: 'muted',
      alloc: `${pct(share(h.aapl.value))} · HOLD · HARVEST IN LOW-INCOME YEARS`,
      cap: { cap: null, kind: 'frozen' },
      kv: [
        { k: 'PRICE', v: h.aapl.shares ? `$${num(Math.round(h.aapl.value / h.aapl.shares))}` : '—' },
        { k: 'SHARES', v: dash(h.aapl.shares, num) },
        { k: 'BASIS', v: dash(h.aapl.basis, money) },
        {
          k: 'GAIN',
          v: dash(aaplGain, money),
          d: aaplGain == null ? 'ADD BASIS' : `${aaplGain >= 0 ? '▲' : '▼'} LONG-TERM`,
          dc: aaplGain == null ? undefined : aaplGain >= 0 ? 'green' : 'red',
        },
      ],
      policy: [
        'We don’t sell it to fund spending unless the refill rule (§2) calls for it — and it comes last in the refill order.',
        'In low-income years we can sell and rebuy or diversify up to the top of the 0% or 15% bracket. The CPA tells us how much room we have.',
        'Honest label: this is a third concentrated bet, not “our stock portfolio.”',
      ],
      module: {
        kind: 'tax',
        rows: [
          { k: 'Cost basis', v: dash(h.aapl.basis, money) },
          { k: 'Long-term gain', v: dash(aaplGain, money), color: 'green' },
          { k: '30% tax set-aside (§4)', v: money(aaplTax), color: 'red' },
          { k: 'Net to the Fortress / Diversified', v: money(h.aapl.value - aaplTax) },
        ],
        note: h.aapl.basis == null ? 'Add shares and basis in src/data.ts to see the numbers. The CPA confirms actuals.' : 'Estimate only. The CPA confirms actuals each year.',
      },
    },
    {
      key: 'FORTRESS',
      name: 'FORTRESS',
      amount: h.fortress.value,
      pct: share(h.fortress.value),
      roleTitle: 'Cash and T-bills — 30 months of bills, no matter what',
      status: fortressStatus,
      alloc: `${Math.floor(fortressMonths)} MO · TARGET ${RULES.fortressTargetMonths}`,
      cap: { cap: RULES.fortressTargetMonths, kind: 'target' },
      kv: [
        { k: 'BURN', v: money(burn), d: `PER MONTH · ${money(household.annualSpend)} / YR` },
        {
          k: 'COVERAGE',
          v: `${Math.floor(fortressMonths)} MO`,
          d: fortressStatus === 'green' ? 'AT TARGET' : fortressStatus === 'amber' ? 'REFILL THIS QUARTER' : 'AUSTERITY MODE',
          dc: fortressStatus,
        },
        {
          k: 'IDLE CASH',
          v: h.fortress.idleCash == null ? '~$10K' : money(h.fortress.idleCash),
          d: h.fortress.idleCash === 0 ? 'ALL IN T-BILLS' : '▼ YIELD LEFT ON TABLE',
          dc: h.fortress.idleCash === 0 ? 'green' : 'red',
        },
      ],
      policy: [
        'Target: 30 months of expenses, held in T-bills or SGOV — not idle cash. All spending comes out of here.',
        'Every Evergreen distribution goes here first. Anything above target flows to the Diversified sleeve.',
        'Each quarter, if under 30 months, refill from whatever is up — first HYPE proceeds, then flexible / Diversified, then AAPL.',
        'If nothing is up and the Fortress falls below 18 months: austerity mode. Spending drops to $75k / year; we do not sell into a crash.',
        'Never prepay the mortgage from the Fortress.',
      ],
      module: { kind: 'gauge', now: fortressMonths, target: RULES.fortressTargetMonths, floor: RULES.austerityMonths, max: 36 },
    },
    {
      key: 'ZEC',
      name: 'ZEC',
      amount: zec,
      pct: zecShare,
      roleTitle: `Small bet on purpose — ${num(h.zec.tokens)} tokens`,
      status: zecStatus,
      alloc: zecShare > RULES.zecTrimAt ? `${pct(zecShare, 1)} · OVER 10% · TRIM TO 7%` : `${pct(zecShare)} · TRIM AT ${pct(RULES.zecTrimAt)}`,
      cap: { cap: RULES.zecTrimAt, kind: 'trim' },
      kv: [
        { k: 'PRICE', v: `$${num(h.zec.price)}` },
        { k: 'TOKENS', v: num(h.zec.tokens) },
        { k: 'BASIS', v: dash(h.zec.basis, money) },
        {
          k: 'GAIN',
          v: dash(zecGain, money),
          d: zecGain == null ? 'ADD BASIS' : `${zecGain >= 0 ? '▲' : '▼'} ${pct(zecGain / (h.zec.basis || 1))}`,
          dc: zecGain == null ? undefined : zecGain >= 0 ? 'green' : 'red',
        },
      ],
      policy: [
        'If ZEC grows past 10% of liquid assets at a quarterly review, trim back to 7%.',
        'No price ladder — this thesis isn’t about a price target.',
        'ZEC counts inside the same 45% crypto ceiling as HYPE. It falls in the same crash.',
        'We only add with spare money, never by selling something else to buy it.',
      ],
    },
    {
      key: 'EQUITIES',
      name: 'EQUITIES',
      amount: h.equities.value,
      pct: eqShare,
      roleTitle: 'Flexible bucket — seeds Diversified; Ascent bets capped at 10%',
      status: eqStatus,
      alloc: div === 0 ? `${pct(eqShare)} · SLATED FOR DIVERSIFIED` : `${pct(eqShare)} · CAP ${pct(RULES.ascentCap)}`,
      cap: { cap: RULES.ascentCap, kind: 'cap' },
      kv: [
        { k: 'POSITIONS', v: dash(h.equities.positions, num), d: h.equities.positions == null ? 'LIST AT REVIEW' : undefined },
        { k: 'MAX EACH', v: money(total * RULES.maxPosition), d: '5% OF LIQUID' },
      ],
      policy: [
        'The current $100k flexible bucket is the start of the Diversified sleeve.',
        'Ascent cap: 10% of liquid assets. Over that, trim to 8%. No single position over 5% of liquid assets.',
        'Funded only with spare money — never from the Fortress or the Diversified sleeve.',
        'Every position needs a written thesis in our own words. If the thesis breaks, we sell regardless of price.',
        'Changes only at quarterly reviews. Research arrives weekly; we don’t trade weekly.',
      ],
    },
    {
      key: 'DIVERSIFIED',
      name: 'DIVERSIFIED',
      amount: div,
      pct: divShare,
      roleTitle: 'The boring ballast — VOO 55 · VXUS 30 · AVUV 15',
      status: divStatus,
      alloc: div === 0 ? `UNFUNDED · GOAL ${pct(RULES.diversifiedGoal)} BY ${monYY(diversifiedGoalDate)}` : `${pct(divShare)} OF ${pct(RULES.diversifiedGoal)} GOAL`,
      cap: { cap: RULES.diversifiedGoal, kind: 'goal' },
      kv: [],
      policy: [
        'Goal: at least 30% of liquid assets within 3 years. Every dollar of new money goes here first.',
        'Nothing exciting lives here — no themes, no sectors, no crypto. If it moves with tech, it belongs in Ascent.',
        'Three funds, all equities: VOO 55% · VXUS 30% · AVUV 15%. The Fortress is our fixed income.',
        'Rebalance with new money, not by selling. When a big lump arrives, invest within 30 days; over $100k, in thirds.',
        'If the Fortress ever drops below 15% of liquid assets, revisit whether this sleeve should hold bonds.',
      ],
      module: {
        kind: 'plan',
        goal: divGoal,
        goalDate: diversifiedGoalDate,
        rows: [
          ...(toDiversified > 0 ? [{ source: 'This review’s trim, after the Fortress refill', amount: money(toDiversified), when: 'THIS MONTH' }] : []),
          { source: 'Flexible equities bucket', amount: money(h.equities.value), when: 'THIS MONTH' },
          { source: 'HYPE ladder, after 30% tax set-aside', amount: money(ladderTotal * (1 - RULES.taxSetAside)), when: 'AS RUNGS FILL' },
          { source: 'Evergreen above the Fortress target', amount: 'VARIES', when: 'AS RECEIVED' },
          { source: 'AAPL harvesting in low-income years', amount: 'CPA SETS', when: 'LOW-INCOME YEARS' },
        ],
      },
    },
  ];

  // ── TOTAL
  const first = snapshots[0];
  const prior = snapshots.length > 1 ? snapshots[snapshots.length - 2] : first;
  const sinceFirst = total / first.total - 1;
  const netDraw = household.annualSpend - household.evergreenIncome;
  const unfunded = sleeves.filter((s) => s.amount === 0);
  const sinceLast = total - prior.total;
  const months = monthsBetween(first.date, reviewDate);

  const totalCards: KV[] = [
    { k: 'NET DRAW', v: pct(netDraw / total, 1), d: `${money(netDraw)} / YR FROM PORTFOLIO` },
    {
      k: 'THIS QUARTER',
      v: sinceLast === 0 ? '$0' : `${sinceLast > 0 ? '+' : '−'}${money(Math.abs(sinceLast))}`,
      d:
        snapshots.length < 2
          ? `FIRST REVIEW ${dayMon(prior.date)}`
          : `${sinceLast >= 0 ? '▲ +' : '▼ −'}${pct(Math.abs(sinceLast) / prior.total, 1)} SINCE ${dayMon(prior.date)}`,
      dc: snapshots.length < 2 ? undefined : sinceLast >= 0 ? 'green' : 'red',
    },
    {
      k: 'SLEEVES UNFUNDED',
      v: String(unfunded.length),
      d: unfunded.length ? unfunded.map((s) => s.name).join(' · ') : 'ALL FUNDED',
      dc: unfunded.length ? 'red' : 'green',
    },
  ];

  return {
    sleeves,
    total,
    totalCards,
    totalSub:
      snapshots.length < 2
        ? `FIRST REVIEW · ${dayMon(first.date)}`
        : `${sinceFirst >= 0 ? '+' : '−'}${Math.abs(Math.round(sinceFirst * 100))}% · ${months} MONTH${months === 1 ? '' : 'S'}`,
    history: snapshots,
    reviewDate,
    fortressMonths,
    crypto,
    plan,
    after: { crypto: cryptoAfter, fortressMonths: fortressMonthsAfter, hypeTokens: hypeTokensAfter, taxReserve },
  };
}

function monthsBetween(a: string, b: string) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return (db.getFullYear() - da.getFullYear()) * 12 + db.getMonth() - da.getMonth();
}

/** "2026-08-01" → "AUG 1" */
export function dayMon(d: string) {
  const date = new Date(d + 'T00:00:00');
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function buildItems(): Item[] {
  const out: Item[] = [];
  for (const [sleeve, list] of Object.entries(items)) {
    list.forEach((it, i) => out.push({ id: `${sleeve}:${i}`, sleeve: sleeve as Item['sleeve'], ...it }));
  }

  // Items the policy itself calls for at this review. Ids carry the review
  // date so a new quarter's trims start unchecked.
  const m = buildSleeves();
  const wait = (n: number) => (n > 25_000 ? ', after the 48-hour wait' : '');
  m.plan.forEach((p, i) =>
    out.push({
      id: `${p.sleeve}:plan${i}@${m.reviewDate}`,
      sleeve: p.sleeve,
      text: `${p.action} (${money(p.amount)})${p.sleeve === 'HYPE' || p.sleeve === 'ZEC' ? wait(p.amount) : ''}`,
      when: 'this month',
    }),
  );
  const laddered = LADDER.reduce((s, r) => s + r.tokens, 0) + RULES.hypeKeep;
  if (m.after.hypeTokens < laddered)
    out.push({
      id: `HYPE:ladder@${m.reviewDate}`,
      sleeve: 'HYPE',
      text: `After the trim we hold ${num(m.after.hypeTokens)} HYPE, fewer than the ${num(laddered)} the ladder and the 750-token keep assume. Write down how the rungs scale at the annual review`,
      when: 'q1 review',
    });
  return out;
}

/** Plain-text summary of the current state, for the Ask-the-Policy system prompt. */
export function stateForPrompt(): string {
  const m = buildSleeves();
  const lines = [
    `Numbers as of the ${m.reviewDate} quarterly review. Previous snapshots: ${m.history.map((h) => `${h.date} $${num(Math.round(h.total))}`).join('; ')}.`,
    `Total liquid: $${num(Math.round(m.total))}. Annual spend $${num(household.annualSpend)}; Evergreen ~$${num(household.evergreenIncome)}/yr; mortgage $${num(household.mortgage.balance)} at ${household.mortgage.rate}%.`,
    `Fortress coverage: ${m.fortressMonths.toFixed(1)} months. Crypto (HYPE+ZEC): ${pct(m.crypto, 1)} of liquid.`,
    '',
  ];
  for (const s of m.sleeves) {
    lines.push(`${s.name} — ${s.roleTitle}. Value $${num(Math.round(s.amount))} (${pct(s.pct, 1)}). Status: ${s.status} (${s.alloc}).`);
  }
  if (m.plan.length) {
    lines.push('', 'Trims and refills this review calls for (computed from the rules):');
    for (const p of m.plan) lines.push(`- ${p.action}: $${num(Math.round(p.amount))}. ${p.why}`);
  }
  lines.push('', 'Open items:');
  for (const it of buildItems()) lines.push(`- [${it.sleeve}] ${it.text} (${it.when})`);
  return lines.join('\n');
}
