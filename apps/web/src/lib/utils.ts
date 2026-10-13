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

/** Relative time like "just now", "10 min ago", "5 h ago", "3 d ago", "2 mo ago". */
export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  return `${Math.floor(mo / 12)} y ago`;
}
