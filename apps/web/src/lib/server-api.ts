import 'server-only';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Server-side fetch for public endpoints (marketing pages). Cached briefly; never throws.
 * A short timeout keeps a slow or unreachable API from stalling static generation (the page
 * build budget) or a page render; on timeout we fall back to the default instead of hanging.
 */
export async function publicGet<T>(path: string, fallback: T, revalidate = 60): Promise<T> {
  try {
    const res = await fetch(`${API_URL}/v1${path}`, { next: { revalidate }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export interface PublicSymbol {
  id: string;
  name: string;
  assetClass: string;
  digits: number;
  leverageMax: number;
  spreadMarkup: string;
  contractSize?: string;
  minLot?: string;
  maxLot?: string;
  lotStep?: string;
  isOpen?: boolean;
  /** overnight financing in account currency per lot per night, long / short (ARCHITECTURE §08) */
  swapLong?: string;
  swapShort?: string;
  featured: boolean;
  quote: { bid: string; ask: string; ts: number } | null;
}

export interface PublicRisk {
  tier: string;
  marginCallPct: string;
  stopOutPct: string;
  defaultLeverage: number;
  maxLeverage: number;
  minDeposit: string;
  spreadDiscountPct: string;
}

/** One trading window in UTC. weekday: 0 = Sunday. A symbol with no rows trades 24/7. */
export interface PublicSession {
  symbolId: string;
  weekday: number;
  openTime: string;
  closeTime: string;
}

export interface PublicHoliday {
  symbolId: string;
  /** YYYY-MM-DD */
  date: string;
}
