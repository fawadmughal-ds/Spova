import type { Tier } from '@spova/shared';

/** Tier accent as an "r g b" triplet for rgb(var(--t) / a). Classic keeps the house mint; each step up gets its own metal. */
export const TIER_RGB: Record<Tier, string> = {
  classic: '37 99 235',
  silver: '82 113 153',
  gold: '173 108 7',
  platinum: '2 132 199',
  vip: '124 58 237',
};
