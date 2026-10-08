import type { PublicRisk } from './server-api';

/** Shared copy + helpers for the account tiers (/trading-account and the five /<tier>-account pages). */

export const PERKS: Record<string, string[]> = {
  classic: ['All instruments', 'Web terminal', 'Email support', 'Daily market news'],
  silver: ['Everything in Classic', '10% spread discount', 'Priority support', 'Weekly webinars'],
  gold: ['Everything in Silver', '20% spread discount', 'Dedicated account manager', 'Trading signals'],
  platinum: ['Everything in Gold', '30% spread discount', 'VPS hosting', 'Premium analysis'],
  vip: ['Everything in Platinum', '40% spread discount', 'Personal analyst', 'Custom conditions'],
};

/** Tier accent as an "r g b" triplet. Gold is the featured tier (brand mint + beam); VIP wears the gold. */
export const TIER_TINT: Record<string, string> = {
  classic: '71 85 105',
  silver: '82 113 153',
  gold: '37 99 235',
  platinum: '79 70 229',
  vip: '173 108 7',
};

export const tierName = (tier: string) => (tier === 'vip' ? 'VIP' : tier.charAt(0).toUpperCase() + tier.slice(1));
export const tierMoney = (v: string) => Number(v).toLocaleString('en-US');

/** Used when the API is unreachable at build/render time. */
export const TIER_FALLBACK: PublicRisk[] = ['classic', 'silver', 'gold', 'platinum', 'vip'].map((tier, i) => ({
  tier,
  marginCallPct: '100',
  stopOutPct: '20',
  defaultLeverage: 100,
  maxLeverage: 400,
  minDeposit: ['200', '5000', '25000', '50000', '100000'][i],
  spreadDiscountPct: String(i * 10),
}));

/** Perks a tier adds on top of the one below it (drops "Everything in X" and the spread-discount line). */
export const ownPerks = (tier: string) => (PERKS[tier] ?? []).filter((p) => !p.startsWith('Everything in') && !p.includes('spread discount'));

/** comparison row: label + cell value per tier (true = included, false/null = not included) */
export type TierRow = [label: string, cell: (t: PublicRisk, i: number) => string | boolean | null];

export function tierRows(tiers: PublicRisk[]): TierRow[] {
  // a perk unlocks at one tier and stays for every tier above it
  const unlocks = tiers.flatMap((t, i) => ownPerks(t.tier).map((perk) => ({ perk, from: i })));
  return [
    ['Min deposit', (t) => `$${tierMoney(t.minDeposit)}`],
    ['Default leverage', (t) => `1:${t.defaultLeverage}`],
    ['Max leverage', (t) => `1:${t.maxLeverage}`],
    ['Margin call', (t) => `${Number(t.marginCallPct)}%`],
    ['Stop out', (t) => `${Number(t.stopOutPct)}%`],
    ['Spread discount', (t) => (Number(t.spreadDiscountPct) > 0 ? `${Number(t.spreadDiscountPct)}%` : null)],
    ['Negative balance protection', () => true],
    ...unlocks.map(({ perk, from }): TierRow => [perk, (_t, i) => i >= from]),
  ];
}
