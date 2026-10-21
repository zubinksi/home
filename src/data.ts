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
  equities: number; // flexible bucket: seeds Diversified; Ascent bets live here too
  cash: number; // the Fortress
  diversified: { voo: number; vxus: number; avuv: number };
}

export const reviews: Review[] = [
  {
    date: '2026-08-01',
    hype: { tokens: 6_500, price: 67 },
    zec: { tokens: 100, price: 450 },
    aapl: { shares: 927, price: 300 },
    equities: 30_000,
    cash: 200_000,
    diversified: { voo: 0, vxus: 0, avuv: 0 },
  },
  {
    date: '2026-11-01',
    hype: { tokens: 6_500, price: 82 },
    zec: { tokens: 100, price: 1_200 },
    aapl: { shares: 927, price: 340 },
    equities: 30_000,
    cash: 190_000,
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
export const fortressIdleCash: number | null = null;

/** Number of positions in the flexible / Ascent bucket. */
export const equityPositions: number | null = null;

/** Date the 3-year Diversified goal (30% of liquid) is due. */
export const diversifiedGoalDate = '2029-08-01';

/**
 * Open items. Ids are `SLEEVE:index` within each sleeve, so append new items
 * to the end of a sleeve's list to keep checked-off state stable. Trims and
 * refills the policy requires are added automatically by src/model.ts.
 */
export const items: Record<string, { text: string; when: When }[]> = {
  POLICY: [
    { text: 'Both of us sign and date the policy statement', when: 'this week' },
  ],
  FORTRESS: [
    { text: 'Move the idle USAA cash into T-bills or SGOV', when: 'this week' },
    { text: 'Confirm real spending now that 90 days have passed (expect ~$100K / yr)', when: 'this week' },
  ],
  DIVERSIFIED: [
    { text: 'Move the $30K flexible equities into VOO 55 / VXUS 30 / AVUV 15', when: 'this month' },
  ],
  HYPE: [
    { text: 'Place the $100 rung: sell 250 tokens when it hits', when: 'before fill' },
    { text: 'Set up the 30% tax set-aside line inside the Fortress', when: 'this month' },
  ],
  AAPL: [
    { text: 'CPA session: 0% / 15% bracket room for harvesting, and how Evergreen is taxed', when: 'q1 review' },
  ],
  EQUITIES: [
    { text: 'Write a thesis in our own words for every Ascent position', when: 'q1 review' },
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
  equities: { value: now.equities, positions: equityPositions },
  diversified: now.diversified,
};

export const snapshots = reviews.map((r) => ({ date: r.date, total: reviewTotal(r) }));
