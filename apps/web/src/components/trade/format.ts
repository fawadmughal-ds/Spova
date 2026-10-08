import { dec } from '@spova/shared';

/** Instrument spec as returned by GET /market/symbols. Decimal fields travel as strings. */
export interface SymbolSpec {
  id: string;
  name: string;
  assetClass: string;
  digits: number;
  contractSize: string;
  minLot: string;
  maxLot: string;
  lotStep: string;
  leverageMax: number;
  spreadMarkup: string;
  swapLong: string;
  swapShort: string;
  isOpen: boolean;
  featured: boolean;
  quote: { bid: string; ask: string; ts: number } | null;
}

/** "60000" -> "60000.00" at the instrument's precision. Empty / NaN -> em dash. */
export const fmtPrice = (v: string | number | null | undefined, digits: number) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
};

/** Signed money with two decimals ("+12.30" / "-4.00"). */
export const fmtSigned = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const s = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n > 0 ? `+${s}` : s;
};

/** Smallest price step the SL/TP steppers move by: one pip on 3/5-digit forex quotes, ten ticks otherwise. */
export const pipSize = (digits: number) => (digits === 3 || digits === 5 ? Math.pow(10, -(digits - 1)) : Math.pow(10, -digits) * 10);

/** Spread in points (last digit units). */
export const spreadPoints = (bid: string, ask: string, digits: number) => {
  const s = dec(ask).minus(bid).times(Math.pow(10, digits));
  return s.isFinite() ? s.toFixed(1).replace(/\.0$/, '') : '—';
};

/** Decimal string with trailing zeros trimmed but at least `min` decimals. */
export const trimDec = (v: string | number, min = 2) => {
  const n = dec(v);
  const s = n.toFixed(Math.max(min, Math.min(8, n.decimalPlaces())));
  return s;
};
