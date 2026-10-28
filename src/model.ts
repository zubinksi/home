// Derives everything the page shows from src/data.ts + the policy rules.

import { diversifiedGoalDate, evergreenReceived, fortressYield, holdings, household, items, reviewDate, snapshots, zecSales, zecTrimWaived } from './data';

export type Status = 'green' | 'amber' | 'red' | 'muted';
export type When = 'this week' | 'this month' | 'before fill' | 'q1 review';
export type SleeveKey = 'HYPE' | 'AAPL' | 'FORTRESS' | 'ZEC' | 'EQUITIES' | 'DIVERSIFIED';

export const STATUS_COLOR: Record<Status, string> = {
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  muted: 'var(--muted)',
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
  /** colour for the value itself */
  vc?: Status;
}

export interface Rung {
  price: number;
  tokens: number;
}

export type Module =
  | { kind: 'ladder'; rungs: Rung[]; sold: number; next: number; price: number; keep: number; total: number; held: number }
  | { kind: 'gauge'; now: number; target: number; floor: number; max: number }
  | { kind: 'plan'; rows: { source: string; amount: string; when: string }[]; goal: number; goalDate: string }
  | { kind: 'tax'; rows: { k: string; v: string; color?: Status }[]; note?: string }
  | { kind: 'tranches'; asset: string; price: number; held: number; sales: { date: string; price: number; tokens: number }[] }
  | { kind: 'positions'; rows: { ticker: string; name: string; value: number; share: number; overMax: boolean; thesis: string | null; sellIf: string | null }[] };

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
  /** Held assets (HYPE, AAPL, ZEC): holding, price and gain under the name, in place of the stat boxes. */
  position?: { holding: string; gain?: { text: string; color: Status } };
  /** The asset whose price history feeds this sleeve's 1D / 1W / 1M / 3M row. */
  asset?: Asset;
  /** Fortress: what the runway chart needs. */
  runway?: {
    balance: number;
    /** months of expenses covered: the one figure the Fortress and Total pages both show */
    months: number;
    burn: number;
    idle: number;
    yield: number;
    target: number;
    floor: number;
    /** expected Evergreen distributions, $ / year */
    evergreen: number;
    /** received so far this calendar year */
    evergreenYTD: number;
    evergreenCount: number;
    /** idle cash is an estimate until it's entered in data.ts */
    idleKnown: boolean;
    /** sales that would refill the Fortress, gross $, in the order they'd happen */
    refills: { label: string; gross: number }[];
    tax: number;
  };
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
  hypeCeiling: 0.45,
  hypeTrimTo: 0.4,
  zecTrimAt: 0.1,
  zecTrimTo: 0.07,
  diversifiedGoal: 0.3,
  ascentCap: 0.1,
  maxPosition: 0.05,
  taxSetAside: 0.3,
  hypeFloor: 40,
  hypeKeep: 650,
  gaugeMax: 36, // months shown on the Fortress gauges
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

// ── live market inputs ─────────────────────────────────────────────────────

export type Asset = 'hype' | 'zec' | 'aapl';
export interface Quote {
  price: number;
  change?: number; // fraction vs. 24h ago (crypto) or the previous close (stock)
  at: number; // ms
  source: string;
}
/** Live prices; any asset missing falls back to the latest review's price. */
export type LivePrices = Partial<Record<Asset, Quote>>;
/** Daily value of the liquid portfolio at market prices. */
export type Series = { date: string; total: number }[];

/** $82.37 under $1,000; $1,234 above. */
export const priceFmt = (n: number) => (n < 1000 ? `$${n.toFixed(2)}` : `$${num(Math.round(n))}`);

const changeKV = (q: Quote | undefined, label: string): Pick<KV, 'd' | 'dc'> =>
  q?.change == null
    ? {}
    : { d: `${q.change >= 0 ? '▲ +' : '▼ −'}${pct(Math.abs(q.change), 1)} ${label}`, dc: q.change >= 0 ? 'green' : 'red' };

/** "6,400 HYPE @ $82.00" and the gain on basis, for a held asset's header. */
function positionLine(qty: string, price: number, gain: number | null) {
  return {
    holding: `${qty} @ ${priceFmt(price)}`,
    gain:
      gain == null
        ? undefined
        : {
            text: `${gain >= 0 ? '+' : '−'}${money(Math.abs(gain))}`,
            color: (gain >= 0 ? 'green' : 'red') as Status,
          },
  };
}

// ── derivation ──────────────────────────────────────────────────────────────

export function buildSleeves(live: LivePrices = {}, series: Series | null = null) {
  const aaplPrice = live.aapl?.price ?? holdings.aapl.price;
  const h = {
    ...holdings,
    hype: { ...holdings.hype, price: live.hype?.price ?? holdings.hype.price },
    zec: { ...holdings.zec, price: live.zec?.price ?? holdings.zec.price },
    aapl: { ...holdings.aapl, price: aaplPrice, value: holdings.aapl.shares * aaplPrice },
  };
  const hype = h.hype.tokens * h.hype.price;
  const zec = h.zec.tokens * h.zec.price;
  const div = h.diversified.voo + h.diversified.vxus + h.diversified.avuv;
  const total = hype + h.aapl.value + h.fortress.value + zec + h.equities.value + div;
  const share = (v: number) => (total ? v / total : 0);

  const burn = household.annualSpend / 12;
  const fortressMonths = Math.round((h.fortress.value / burn) * 100) / 100;
  const hypeShare = share(hype);
  const crypto = hypeShare + share(zec);

  // ── HYPE: the 45% ceiling is HYPE's alone; ZEC has its own 10% line
  const hypeStatus: Status = hypeShare >= RULES.hypeCeiling ? 'red' : hypeShare >= RULES.hypeCeiling - 0.05 ? 'amber' : 'green';
  const ladderTotal = LADDER.reduce((s, r) => s + r.price * r.tokens, 0);
  const nextRung = h.hype.rungsSold < LADDER.length ? h.hype.rungsSold : -1;
  const hypeGain = h.hype.basis == null ? null : hype - h.hype.basis;

  // ── ZEC
  const zecShare = share(zec);
  // we agreed to skip the ZEC trim for this review
  const zecWaived = zecTrimWaived.includes(reviewDate);
  const zecStatus: Status = zecWaived ? 'muted' : zecShare > RULES.zecTrimAt ? 'red' : zecShare > RULES.zecTrimAt - 0.02 ? 'amber' : 'green';
  const zecGain = h.zec.basis == null ? null : zec - h.zec.basis;

  // ── AAPL
  const aaplGain = h.aapl.basis == null ? null : h.aapl.value - h.aapl.basis;
  const aaplTax = h.aapl.value * RULES.taxSetAside;

  // ── FORTRESS
  const fortressStatus: Status =
    fortressMonths < RULES.austerityMonths ? 'red' : fortressMonths < RULES.fortressTargetMonths - 0.5 ? 'amber' : 'green';

  // ── THIS REVIEW: trims and refills the policy calls for (§2, §3, §4, §5)
  const plan: PlanStep[] = [];
  const zecTrimTokens = !zecWaived && zecShare > RULES.zecTrimAt ? Math.ceil((zec - RULES.zecTrimTo * total) / h.zec.price) : 0;
  const hypeTrimTokens =
    hypeShare > RULES.hypeCeiling
      ? Math.min(h.hype.tokens - RULES.hypeKeep, Math.max(0, Math.ceil((hype - RULES.hypeTrimTo * total) / h.hype.price)))
      : 0;
  if (zecTrimTokens > 0)
    plan.push({
      sleeve: 'ZEC',
      action: `Sell ${num(zecTrimTokens)} ZEC at ${priceFmt(h.zec.price)}`,
      amount: zecTrimTokens * h.zec.price,
      why: `ZEC is ${pct(zecShare, 1)} of liquid, past the 10% line. Trim back to 7%.`,
    });
  if (hypeTrimTokens > 0)
    plan.push({
      sleeve: 'HYPE',
      action: `Sell ${num(hypeTrimTokens)} HYPE at ${priceFmt(h.hype.price)}`,
      amount: hypeTrimTokens * h.hype.price,
      why: `HYPE is ${pct(hypeShare)} of liquid, over the 45% ceiling. Trim back to 40% within 30 days.`,
    });
  // §2 refill draws on HYPE *sale proceeds* (ladder rungs, ceiling trims), never
  // a sale made just to refill. Whatever is still short is left for us to decide.
  const fortressGap = Math.max(0, RULES.fortressTargetMonths * burn - h.fortress.value);
  const proceeds = plan.reduce((s, p) => s + p.amount, 0);
  const taxReserve = proceeds * RULES.taxSetAside;
  const toWork = proceeds - taxReserve;
  const toFortress = Math.min(toWork, fortressGap);
  const toDiversified = toWork - toFortress;
  if (taxReserve > 0)
    plan.push({ sleeve: 'FORTRESS', action: 'Set aside 30% for taxes', amount: taxReserve, why: 'Held in the Fortress, reserved for the estimated tax payment. Not counted toward months of coverage.' });
  if (toFortress > 0)
    plan.push({
      sleeve: 'FORTRESS',
      action: `Refill the Fortress to ${RULES.fortressTargetMonths} months`,
      amount: toFortress,
      why: `The Fortress covers ${fortressMonths.toFixed(1)} months. Refill from what is up, HYPE proceeds first.`,
    });
  // rounding up whole tokens leaves a few dollars over; only a real surplus goes on
  if (toDiversified >= 1_000)
    plan.push({ sleeve: 'DIVERSIFIED', action: 'Fund Diversified: VOO 55 · VXUS 30 · AVUV 15', amount: toDiversified, why: 'Anything above the Fortress target goes to the Diversified sleeve. Over $100K goes in in thirds.' });
  const hypeTokensAfter = h.hype.tokens - hypeTrimTokens;
  const hypeShareAfter = (hypeTokensAfter * h.hype.price) / total;
  const fortressMonthsAfter = (h.fortress.value + toFortress) / burn;

  const year = String(new Date().getFullYear());
  const evergreenThisYear = evergreenReceived.filter((d) => d.date.startsWith(year));

  // ── DIVERSIFIED
  const divShare = share(div);
  const divGoal = total * RULES.diversifiedGoal;
  const divStatus: Status = div === 0 ? 'red' : divShare >= RULES.diversifiedGoal ? 'green' : 'amber';

  // ── EQUITIES (researched bets we hold, each with a thesis)
  const eqShare = share(h.equities.value);
  const withThesis = h.equities.positions.filter((p) => p.thesis).length;
  // amber until every position has its thesis written down
  const eqStatus: Status = eqShare > RULES.ascentCap ? 'red' : withThesis < h.equities.positions.length ? 'amber' : 'green';

  const sleeves: Sleeve[] = [
    {
      key: 'HYPE',
      name: 'HYPE',
      amount: hype,
      pct: share(hype),
      roleTitle: `Our biggest bet — ${num(h.hype.tokens)} tokens, skimmed on the way up`,
      status: hypeStatus,
      alloc: hypeShare > RULES.hypeCeiling ? `${pct(hypeShare, 1)} · OVER ${pct(RULES.hypeCeiling)} CEILING` : `${pct(hypeShare, 1)} OF ${pct(RULES.hypeCeiling)} CEILING`,
      cap: { cap: RULES.hypeCeiling, kind: 'cap' },
      kv: [
        { k: 'PRICE', v: priceFmt(h.hype.price), d: `FLOOR $${RULES.hypeFloor}`, ...changeKV(live.hype, '24H') },
        { k: 'TOKENS', v: num(h.hype.tokens), d: `KEEP ${num(RULES.hypeKeep)} FOREVER` },
        { k: 'BASIS', v: dash(h.hype.basis, money) },
        {
          k: 'GAIN',
          v: dash(hypeGain, money),
          d: hypeGain == null ? 'ADD BASIS' : `${hypeGain >= 0 ? '▲' : '▼'} ${pct(hypeGain / (h.hype.basis || 1))}`,
          dc: hypeGain == null ? undefined : hypeGain >= 0 ? 'green' : 'red',
        },
      ],
      position: positionLine(`${num(h.hype.tokens)} HYPE`, h.hype.price, hypeGain),
      asset: 'hype',
      policy: [
        'HYPE can’t exceed 45% of liquid assets (checked quarterly). If it does, we trim back to 40% within 30 days.',
        'The sell ladder is pre-committed. When the price hits the number, we sell. No skipping a rung because it “obviously” has further to run.',
        'We keep 650 tokens forever, at any price — our oldest, cheapest-basis tokens.',
        'Below $40 we never sell HYPE to pay for living expenses. Period.',
        'We never buy more HYPE with Fortress or Diversified money. Gains get skimmed; dips get held, not bought.',
        'Set aside 30% of every sale into the Fortress for taxes. The ladder always wins over tax optimization.',
      ],
      module: { kind: 'ladder', rungs: LADDER, sold: h.hype.rungsSold, next: nextRung, price: h.hype.price, keep: RULES.hypeKeep, total: ladderTotal, held: h.hype.tokens },
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
        { k: 'PRICE', v: priceFmt(h.aapl.price), ...changeKV(live.aapl, 'TODAY') },
        { k: 'SHARES', v: dash(h.aapl.shares, num) },
        { k: 'BASIS', v: dash(h.aapl.basis, money) },
        {
          k: 'GAIN',
          v: dash(aaplGain, money),
          d: aaplGain == null ? 'ADD BASIS' : `${aaplGain >= 0 ? '▲' : '▼'} LONG-TERM`,
          dc: aaplGain == null ? undefined : aaplGain >= 0 ? 'green' : 'red',
        },
      ],
      position: positionLine(`${num(h.aapl.shares)} SHARES`, h.aapl.price, aaplGain),
      asset: 'aapl',
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
      alloc: `${fortressMonths.toFixed(1)} MO · TARGET ${RULES.fortressTargetMonths}`,
      cap: { cap: RULES.fortressTargetMonths, kind: 'target' },
      kv: [
        { k: 'BURN', v: money(burn), d: `PER MONTH · ${money(household.annualSpend)} / YR` },
        {
          k: 'COVERAGE',
          v: `${fortressMonths.toFixed(1)} MO`,
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
      runway: {
        balance: h.fortress.value,
        months: fortressMonths,
        burn,
        idle: h.fortress.idleCash ?? 10_000,
        yield: fortressYield,
        target: RULES.fortressTargetMonths * burn,
        floor: RULES.austerityMonths * burn,
        evergreen: household.evergreenIncome,
        evergreenYTD: evergreenThisYear.reduce((t, d) => t + d.amount, 0),
        evergreenCount: evergreenThisYear.length,
        idleKnown: h.fortress.idleCash != null,
        refills: [
          ...(zecTrimTokens > 0 ? [{ label: `ZEC TRIM · ${num(zecTrimTokens)}`, gross: zecTrimTokens * h.zec.price }] : []),
          ...LADDER.slice(h.hype.rungsSold).map((r) => ({ label: `HYPE $${r.price} · ${num(r.tokens)}`, gross: r.price * r.tokens })),
        ],
        tax: RULES.taxSetAside,
      },
      policy: [
        'Target: 30 months of expenses, held in T-bills or SGOV — not idle cash. All spending comes out of here.',
        'Every Evergreen distribution goes here first. Anything above target flows to the Diversified sleeve.',
        'Each quarter, if under 30 months, refill from whatever is up — first HYPE proceeds, then Diversified, then AAPL.',
        'If nothing is up and the Fortress falls below 18 months: austerity mode. Spending drops to $75k / year; we do not sell into a crash.',
        'Never prepay the mortgage from the Fortress.',
      ],
      module: { kind: 'gauge', now: fortressMonths, target: RULES.fortressTargetMonths, floor: RULES.austerityMonths, max: RULES.gaugeMax },
    },
    {
      key: 'ZEC',
      name: 'ZEC',
      amount: zec,
      pct: zecShare,
      roleTitle: `Small bet on purpose — ${num(h.zec.tokens)} tokens`,
      status: zecStatus,
      alloc: zecWaived
        ? `${pct(zecShare, 1)} · 10% TRIM WAIVED THIS QUARTER`
        : zecShare > RULES.zecTrimAt ? `${pct(zecShare, 1)} · OVER 10% · TRIM TO 7%` : `${pct(zecShare, 1)} · TRIM AT ${pct(RULES.zecTrimAt)}`,
      cap: { cap: RULES.zecTrimAt, kind: 'trim' },
      kv: [
        { k: 'PRICE', v: priceFmt(h.zec.price), ...changeKV(live.zec, '24H') },
        { k: 'TOKENS', v: num(h.zec.tokens) },
        { k: 'BASIS', v: dash(h.zec.basis, money) },
        {
          k: 'GAIN',
          v: dash(zecGain, money),
          d: zecGain == null ? 'ADD BASIS' : `${zecGain >= 0 ? '▲' : '▼'} ${pct(zecGain / (h.zec.basis || 1))}`,
          dc: zecGain == null ? undefined : zecGain >= 0 ? 'green' : 'red',
        },
      ],
      position: positionLine(`${num(h.zec.tokens)} ZEC`, h.zec.price, zecGain),
      module: { kind: 'tranches', asset: 'ZEC', price: h.zec.price, held: h.zec.tokens, sales: zecSales },
      asset: 'zec',
      policy: [
        'If ZEC grows past 10% of liquid assets at a quarterly review, trim back to 7%.',
        'No price ladder — this thesis isn’t about a price target.',
        'ZEC has its own 10% line and doesn’t count toward HYPE’s 45% ceiling. It still falls in the same crypto crash.',
        'We only add with spare money, never by selling something else to buy it.',
      ],
    },
    {
      key: 'EQUITIES',
      name: 'EQUITIES',
      amount: h.equities.value,
      pct: eqShare,
      roleTitle: 'Researched bets with written theses — capped at 10%',
      status: eqStatus,
      alloc: `${pct(eqShare)} · CAP ${pct(RULES.ascentCap)}`,
      cap: { cap: RULES.ascentCap, kind: 'cap' },
      kv: [],
      policy: [
        'New cash goes to Diversified first; we add to Equities positions only after that.',
        'Equities cap: 10% of liquid assets. Over that, trim to 8%. No single position over 5% of liquid assets.',
        'Funded only with spare money — never from the Fortress or the Diversified sleeve.',
        'Every position needs a written thesis in our own words. If the thesis breaks, we sell regardless of price.',
        'Changes only at quarterly reviews. Research arrives weekly; we don’t trade weekly.',
      ],
      module: {
        kind: 'positions',
        rows: h.equities.positions.map((p) => ({ ...p, share: share(p.value), overMax: share(p.value) > RULES.maxPosition })),
      },
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
        'Nothing exciting lives here — no themes, no sectors, no crypto. If it moves with tech, it belongs in Equities.',
        'Three funds, all equities: VOO 55% · VXUS 30% · AVUV 15%. The Fortress is our fixed income.',
        'Rebalance with new money, not by selling. When a big lump arrives, invest within 30 days; over $100k, in thirds.',
        'If the Fortress ever drops below 15% of liquid assets, revisit whether this sleeve should hold bonds.',
      ],
      module: {
        kind: 'plan',
        goal: divGoal,
        goalDate: diversifiedGoalDate,
        rows: [
          ...(toDiversified >= 1_000 ? [{ source: 'This review’s trim, after the Fortress refill', amount: money(toDiversified), when: 'THIS MONTH' }] : []),
          { source: 'New cash, before any Equities adds', amount: 'ALL OF IT', when: 'AS IT COMES' },
          { source: 'HYPE ladder, after 30% tax set-aside', amount: money(ladderTotal * (1 - RULES.taxSetAside)), when: 'AS RUNGS FILL' },
          { source: 'Evergreen above the Fortress target', amount: 'VARIES', when: 'AS RECEIVED' },
          { source: 'AAPL harvesting in low-income years', amount: 'CPA SETS', when: 'LOW-INCOME YEARS' },
        ],
      },
    },
  ];

  // ── TOTAL
  // With live prices the baseline is the market series' first day; otherwise
  // the review snapshots as entered.
  const marketLine = series && series.length >= 2 ? series : null;
  const history = marketLine ?? snapshots;
  const first = history[0];
  const ninety = trailingChange(history, 90, total);
  // interest only on what's in T-bills today (as on the Fortress page), not the idle cash
  const fortressInterest = Math.max(0, h.fortress.value - (h.fortress.idleCash ?? 10_000)) * fortressYield;
  const netDraw = household.annualSpend - household.evergreenIncome - fortressInterest;

  const drawRate = netDraw / total;
  // under 4% is sustainable; 4–5% is worth watching; over 5% is drawing too fast
  const drawStatus: Status = drawRate < 0.04 ? 'green' : drawRate <= 0.05 ? 'amber' : 'red';
  const totalCards: KV[] = [{ k: 'NET DRAW', v: pct(drawRate, 1), vc: drawStatus, d: `${money(netDraw)} / YR FROM PORTFOLIO` }];

  return {
    sleeves,
    total,
    totalCards,
    // the trailing 90 days; until the line is 90 days long, since it began (Aug 1)
    totalSub:
      history.length < 2
        ? `FIRST REVIEW · ${dayMon(first.date)}`
        : `${ninety >= 0 ? '+' : '−'}${Math.abs(Math.round(ninety * 100))}% · 90D`,
    history,
    // the quarterly-review fallback is too coarse for day/week/month changes
    periods: marketLine ? periodChanges(marketLine) : PERIODS.map(({ label }) => ({ label, change: null as number | null, since: undefined as string | undefined })),
    marketLine: !!marketLine,
    reviewDate,
    fortressMonths,
    crypto,
    hypeShare,
    zecShare,
    plan,
    after: { hypeShare: hypeShareAfter, fortressMonths: fortressMonthsAfter, hypeTokens: hypeTokensAfter, taxReserve },
  };
}

/** Change over the last `days` days of a line, or since it began if it's shorter. */
function trailingChange(history: { date: string; total: number }[], days: number, now: number) {
  const last = history[history.length - 1];
  const d = new Date(last.date + 'T00:00:00');
  d.setDate(d.getDate() - days);
  const from = isoDay(d);
  let base = history[0];
  for (const h of history) {
    if (h.date > from) break;
    base = h;
  }
  return base.total ? now / base.total - 1 : 0;
}

/** Local calendar day as YYYY-MM-DD. */
export function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


/** Today, as the masthead shows it: "OCT 21, 2026". */
export function longDate(d: Date) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "2026-08-01" → "AUG 1" */
export function dayMon(d: string) {
  const date = new Date(d + 'T00:00:00');
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function buildItems(live: LivePrices = {}): Item[] {
  const out: Item[] = [];
  for (const [sleeve, list] of Object.entries(items)) {
    list.forEach((it, i) => out.push({ id: `${sleeve}:${i}`, sleeve: sleeve as Item['sleeve'], ...it }));
  }

  // Items the policy itself calls for at this review. Ids carry the review
  // date so a new quarter's trims start unchecked.
  const m = buildSleeves(live);
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
      text: `${m.after.hypeTokens < holdings.hype.tokens ? 'After this review’s sales we hold' : 'We hold'} ${num(m.after.hypeTokens)} HYPE, fewer than the ${num(laddered)} the ladder and the ${num(RULES.hypeKeep)}-token keep assume. Write down how the rungs scale at the annual review`,
      when: 'q1 review',
    });
  return out;
}

/** Plain-text summary of the current state, for the Ask-the-Policy system prompt. */
export const PERIODS = [
  { label: '1D', days: 1 },
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 91 },
] as const;

/**
 * Change in the chart's line over each period, ending at its last day. null
 * when the line doesn't reach back that far, except the longest period, which
 * shows the change since the line began (`since`) until it has full history.
 */
export function periodChanges(history: { date: string; total: number }[]): { label: string; change: number | null; since?: string }[] {
  const last = history[history.length - 1];
  return PERIODS.map(({ label, days }, i) => {
    if (!last) return { label, change: null };
    const d = new Date(last.date + 'T00:00:00');
    d.setDate(d.getDate() - days);
    const from = isoDay(d);
    if (history[0].date > from) {
      if (i < PERIODS.length - 1 || history.length < 2) return { label, change: null };
      const first = history[0];
      return { label, change: first.total ? last.total / first.total - 1 : null, since: first.date };
    }
    let base = history[0];
    for (const h of history) {
      if (h.date > from) break;
      base = h;
    }
    return { label, change: base.total ? last.total / base.total - 1 : null };
  });
}

export function stateForPrompt(live: LivePrices = {}): string {
  const m = buildSleeves(live);
  const quotes = (Object.entries(live) as [Asset, Quote][]).map(([k, q]) => `${k.toUpperCase()} ${priceFmt(q.price)}`);
  const lines = [
    `Holdings as of the ${m.reviewDate} quarterly review. Review snapshots: ${snapshots.map((h) => `${h.date} $${num(Math.round(h.total))}`).join('; ')}.`,
    quotes.length ? `Live prices as of ${new Date().toISOString().slice(0, 16)}Z: ${quotes.join(', ')}. Values below use them.` : 'Prices are the review prices.',
    `Total liquid: $${num(Math.round(m.total))}. Annual spend $${num(household.annualSpend)}; Evergreen ~$${num(household.evergreenIncome)}/yr; mortgage $${num(household.mortgage.balance)} at ${household.mortgage.rate}%.`,
    `Fortress coverage: ${m.fortressMonths.toFixed(1)} months. HYPE: ${pct(m.hypeShare, 1)} of liquid (45% ceiling, HYPE alone). ZEC: ${pct(m.zecShare, 1)} (10% line). Crypto together: ${pct(m.crypto, 1)}.`,
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
  for (const it of buildItems(live)) lines.push(`- [${it.sleeve}] ${it.text} (${it.when})`);
  return lines.join('\n');
}
