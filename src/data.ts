// ─────────────────────────────────────────────────────────────────────────────
// THE NUMBERS. At each quarterly review, append one entry to `reviews`.
//
// The latest review is "now". Everything on the page (percentages, statuses,
// trims, ladder position, gauge, funding plan) is derived from it by
// src/model.ts against the rules in policy/investment-policy.md. `null` means
// "we haven't written it down yet"; the page shows "—" until it's filled in.
// ─────────────────────────────────────────────────────────────────────────────

import type { When } from './model';

export const household = {
  annualSpend: 100_000,
  austeritySpend: 75_000,
  evergreenIncome: 50_000, // ~per year, irregular
  evergreenValue: 500_000, // not counted in allocation math
  mortgage: { balance: 350_000, rate: 6.625, payment: 2_240 },
};

export interface Review {
  date: string; // YYYY-MM-DD
  hype: { tokens: number; price: number };
  zec: { tokens: number; price: number };
  aapl: { shares: number; price: number };
  equities: number; // $ in the Equities positions at that review (today's value comes from equityPositions)
  cash: number; // the Fortress
  diversified: { voo: number; vxus: number; avuv: number };
}

export const reviews: Review[] = [
  {
    date: '2026-08-01',
    hype: { tokens: 6_400, price: 67 },
    zec: { tokens: 100, price: 450 },
    aapl: { shares: 927, price: 300 },
    equities: 30_000,
    cash: 200_000,
    diversified: { voo: 0, vxus: 0, avuv: 0 },
  },
  {
    date: '2026-11-01',
    hype: { tokens: 6_400, price: 82 },
    zec: { tokens: 100, price: 1_200 },
    aapl: { shares: 927, price: 340 },
    equities: 30_000,
    cash: 200_000,
    diversified: { voo: 0, vxus: 0, avuv: 0 },
  },
];

/** Total cost basis, $. Update after any buy or sell. */
export const basis = {
  hype: 225_000,
  zec: 50_000,
  aapl: 10_000,
  equities: 30_000,
};

/** How many HYPE ladder rungs have filled. */
export const hypeRungsSold = 0;

/** USAA cash in the Fortress not yet in T-bills / SGOV. */
export const fortressIdleCash: number | null = 80_000; // $120K of the $200K is in T-bills; the rest isn't earning yet (Oct 2026)

/** Evergreen distributions received, as they arrive. Add one line each time. */
export const evergreenReceived: { date: string; amount: number }[] = [];

/** What T-bills / SGOV pay, for the Fortress yield bar (an estimate; update as rates move). */
export const fortressYield = 0.045;

/**
 * The Equities positions. Every one needs a thesis in our own words, and the
 * line that would break it (if it breaks, we sell regardless of price).
 * Leave a field null until it's written; the page shows it as missing.
 */
export interface EquityPosition {
  ticker: string;
  name: string;
  shares: number;
  /** a recent share price, used only until live prices arrive (or if they can't) */
  price: number;
  thesis: string | null;
  sellIf: string | null;
}

/** The day the Equities positions were bought; the Equities chart starts here. */
export const equitiesSince = '2026-10-21';

export const equityPositions: EquityPosition[] = [
  {
    ticker: 'LLY',
    name: 'Eli Lilly',
    shares: 8,
    price: 1_375,
    thesis:
      'Lilly has the most efficient pipeline for drug development and GLPs are selling incredibly well. AI entrenches their moat since drugs can be patented in a way software cannot. A trillion dollar company worth multiple trillions.',
    sellIf: null,
  },
  {
    ticker: 'FIG',
    name: 'Figma',
    shares: 300,
    price: 23.33,
    thesis:
      'Figma is underrated in terms of their ability to monetize and have a second act crossing the chasm into being AI-native. Figma Agent can translate creative non-designers into designers. When software creation goes up 10x because of AI coding, Figma is the place where all that product work gets made coherent. The stock has been beaten down and the bear case of losing market share to Claude Design and similar products is now fairly baked in. The bull case is owning the start to finish process and becoming the organizational control panel for AI-generated interfaces.',
    sellIf: null,
  },
  {
    ticker: 'CRWD',
    name: 'CrowdStrike',
    shares: 44,
    price: 272.73,
    thesis:
      'Cyber security is increasingly necessary with AI-enabled hacks. The pace at which security compromises are occurring is speeding up and getting more concerning.',
    sellIf: null,
  },
];

/** ZEC tranches sold, oldest first. Add one line per sale (and lower the next review's token count). */
export const zecSales: { date: string; price: number; tokens: number }[] = [];

/** Reviews at which we've agreed to skip the ZEC 10% trim (by review date). */
export const zecTrimWaived: string[] = ['2026-11-01'];

/** Date the 3-year Diversified goal (30% of liquid) is due. */
export const diversifiedGoalDate = '2029-08-01';

/**
 * Open items. Ids are `SLEEVE:index` within each sleeve, so append new items
 * to the end of a sleeve's list to keep checked-off state stable. Trims and
 * refills the policy requires are added automatically by src/model.ts.
 */
export const items: Record<string, { text: string; when: When }[]> = {
  FORTRESS: [
    { text: 'Move the idle USAA cash into T-bills or SGOV', when: 'this week' },
    { text: 'Confirm real spending now that 90 days have passed (expect ~$100K / yr)', when: 'this week' },
  ],
  DIVERSIFIED: [],
  HYPE: [
    { text: 'Place the $100 rung: sell 250 tokens when it hits', when: 'before fill' },
    { text: 'Set up the 30% tax set-aside line inside the Fortress', when: 'this month' },
  ],
  EQUITIES: [
    { text: 'Write a thesis in our own words for every Equities position', when: 'q1 review' },
  ],
};

// ── derived: the latest review is "now" ─────────────────────────────────────

export const reviewTotal = (r: Review) =>
  r.hype.tokens * r.hype.price +
  r.zec.tokens * r.zec.price +
  r.aapl.shares * r.aapl.price +
  r.equities +
  r.cash +
  r.diversified.voo +
  r.diversified.vxus +
  r.diversified.avuv;

const now = reviews[reviews.length - 1];

export const reviewDate = now.date;

export const holdings = {
  hype: { tokens: now.hype.tokens, price: now.hype.price, basis: basis.hype as number | null, rungsSold: hypeRungsSold },
  aapl: { price: now.aapl.price, shares: now.aapl.shares, basis: basis.aapl as number | null },
  fortress: { value: now.cash, idleCash: fortressIdleCash },
  zec: { tokens: now.zec.tokens, price: now.zec.price, basis: basis.zec as number | null },
  // valued from the positions (shares × price), not the review's round figure
  equities: { value: equityPositions.reduce((t, p) => t + p.shares * p.price, 0), positions: equityPositions },
  diversified: now.diversified,
};

export const snapshots = reviews.map((r) => ({ date: r.date, total: reviewTotal(r) }));
