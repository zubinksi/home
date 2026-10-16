// ─────────────────────────────────────────────────────────────────────────────
// THE NUMBERS. Update this file at each quarterly review.
//
// Everything on the page (percentages, statuses, ladder position, gauge,
// funding plan) is derived from these values by src/model.ts against the rules
// in policy/investment-policy.md. `null` means "we haven't written it down yet";
// the page shows "—" until it's filled in.
// ─────────────────────────────────────────────────────────────────────────────

import type { When } from './model';

export const household = {
  annualSpend: 100_000,
  austeritySpend: 75_000,
  evergreenIncome: 50_000, // ~per year, irregular
  evergreenValue: 500_000, // not counted in allocation math
  mortgage: { balance: 350_000, rate: 6.625, payment: 2_240 },
};

export const holdings = {
  hype: {
    tokens: 6_500,
    price: 67,
    basis: null as number | null, // total cost basis, $
    rungsSold: 0, // how many ladder rungs have filled
  },
  aapl: {
    value: 300_000,
    shares: null as number | null,
    basis: null as number | null, // total cost basis, $
  },
  fortress: {
    value: 250_000,
    idleCash: null as number | null, // USAA cash not yet in T-bills / SGOV
  },
  zec: {
    tokens: 92,
    price: 450,
    basis: null as number | null,
  },
  equities: {
    value: 100_000, // flexible bucket: seeds Diversified; Ascent bets live here too
    positions: null as number | null,
  },
  diversified: {
    voo: 0,
    vxus: 0,
    avuv: 0,
  },
};

/** Total liquid at each review. Append one row per quarter. */
export const snapshots: { date: string; total: number }[] = [
  { date: '2026-07-01', total: 1_126_900 },
];

/** Date the 3-year Diversified goal (30% of liquid) is due. */
export const diversifiedGoalDate = '2029-07-01';

/**
 * Open items. Ids are `SLEEVE:index` within each sleeve, so append new items
 * to the end of a sleeve's list to keep checked-off state stable.
 */
export const items: Record<string, { text: string; when: When }[]> = {
  POLICY: [
    { text: 'Both of us sign and date the policy statement', when: 'this week' },
  ],
  FORTRESS: [
    { text: 'Move the idle USAA cash into T-bills or SGOV', when: 'this week' },
    { text: 'Confirm real spending 90 days after closing (expect ~$100K / yr)', when: 'this month' },
  ],
  DIVERSIFIED: [
    { text: 'Invest the $100K flexible bucket: VOO 55 / VXUS 30 / AVUV 15', when: 'this month' },
  ],
  HYPE: [
    { text: 'Place the $100 rung: sell 250 tokens when it hits', when: 'before fill' },
    { text: 'Set up the 30% tax set-aside line inside the Fortress', when: 'before fill' },
    { text: 'Check HYPE + ZEC against the 45% crypto ceiling', when: 'q1 review' },
  ],
  AAPL: [
    { text: 'CPA session: 0% / 15% bracket room for harvesting, and how Evergreen is taxed', when: 'q1 review' },
  ],
  ZEC: [
    { text: 'Check ZEC against the 10% trim line', when: 'q1 review' },
  ],
  EQUITIES: [
    { text: 'Write a thesis in our own words for every Ascent position', when: 'q1 review' },
  ],
};
