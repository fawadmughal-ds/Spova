import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';

// All money math goes through Decimal. Round half-even to 2dp only when writing to the ledger.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

export type Money = Decimal;

export const D = (v: Decimal.Value | Prisma.Decimal | null | undefined): Decimal =>
  new Decimal(v === null || v === undefined ? 0 : v.toString());

export const ZERO = new Decimal(0);

/** Normalize to 2dp string for the wire ("1234.50"). */
export const money = (v: Decimal.Value | Prisma.Decimal | null | undefined): string =>
  D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toFixed(2);

/** Prisma expects Prisma.Decimal / string for Decimal columns. */
export const toDb = (v: Decimal): Prisma.Decimal =>
  new Prisma.Decimal(v.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toFixed(2));

export function assertPositiveMoney(v: string): Decimal {
  const d = D(v);
  if (!d.isFinite() || d.lte(0)) throw new Error('Amount must be positive');
  if (d.decimalPlaces() > 2) throw new Error('Amount has more than 2 decimals');
  return d;
}
