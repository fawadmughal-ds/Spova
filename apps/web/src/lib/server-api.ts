import 'server-only';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Server-side fetch for public endpoints (marketing pages). Cached briefly; never throws. */
export async function publicGet<T>(path: string, fallback: T, revalidate = 60): Promise<T> {
  try {
    const res = await fetch(`${API_URL}/v1${path}`, { next: { revalidate } });
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
