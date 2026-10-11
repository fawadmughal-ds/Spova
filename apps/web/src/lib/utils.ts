import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Zerventa';
export const SUPPORT_EMAIL = 'info@zerventa.com';

const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "12000.5" -> "12,000.50" */
export const fmtMoney = (v: string | number | null | undefined, currency = '') => {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return `${fmt.format(n)}${currency ? ' ' + currency : ''}`;
};

export const fmtDate = (iso: string | null | undefined, withTime = true) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const initials = (first?: string | null, last?: string | null, fallback = '?') =>
  `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || fallback;
