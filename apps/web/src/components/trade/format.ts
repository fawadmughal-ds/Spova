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

const THIN = ' ';
/** "1325470.56" -> "1 325 470.56" (thin-space thousands, fixed decimals) like the reference terminal. */
export const fmtNum = (v: string | number | null | undefined, decimals = 2) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '—';
  const [int, frac] = Math.abs(n).toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
  return `${n < 0 ? '-' : ''}${grouped}${frac ? '.' + frac : ''}`;
};
/** Signed thin-space money: "+12.30" / "-4.00". */
export const fmtSignedNum = (v: string | number | null | undefined, decimals = 2) => {
  const s = fmtNum(v, decimals);
  if (s === '—') return s;
  const n = Number(v);
  return n > 0 ? `+${s}` : s;
};
/** "1.04%" with sign. */
export const fmtPct = (v: number | null | undefined, decimals = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(decimals)}%`);
/** Lots with trailing zeros trimmed but at least two decimals ("0.01", "1.50", "100.00"). */
export const fmtLots = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const s = String(v);
  const decimals = s.includes('.') ? Math.max(2, s.split('.')[1].replace(/0+$/, '').length) : 2;
  return n.toFixed(Math.min(decimals, 8));
};
/** "08/10/2026" and "05:57:06" (UTC) as two strings. */
export const fmtDateTimeParts = (iso: string | null | undefined): [string, string] => {
  if (!iso) return ['—', ''];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return ['—', ''];
  const p = (n: number) => String(n).padStart(2, '0');
  return [`${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`, `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`];
};
/** "2h 05m" / "45s" style duration. */
export const fmtDuration = (ms: number) => {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};
/** "h:mm:ss" countdown. */
export const fmtCountdown = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
/** Daily % change of a live quote against its reference close. */
export const dailyChange = (q: { bid: string; ask: string; ref: number | null } | undefined) => {
  if (!q || !q.bid || !q.ask || !q.ref) return null;
  const mid = (Number(q.bid) + Number(q.ask)) / 2;
  return ((mid - q.ref) / q.ref) * 100;
};
