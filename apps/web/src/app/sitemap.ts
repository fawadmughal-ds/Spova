import type { MetadataRoute } from 'next';
import { MARKET_LIST } from '@/lib/markets';
import { COMPANY_LINKS, EDUCATION_LINKS, TIER_LINKS, TRADING_LINKS, tierHref } from '@/lib/site-nav';
import { LEGAL_DOCS } from '@spova/shared';
import { SITE_URL } from '@/lib/site';

const BASE = SITE_URL;

/** Public pages only; /app, /trade and /admin are noindex (see next.config.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '/',
    ...MARKET_LIST.map((m) => `/${m.slug}`),
    ...TRADING_LINKS.map((l) => l.href),
    ...TIER_LINKS.map((t) => tierHref(t.tier)),
    '/platform',
    ...EDUCATION_LINKS.map((l) => l.href),
    ...COMPANY_LINKS.map((l) => l.href),
    ...LEGAL_DOCS.map((d) => `/legal/${d.slug}`),
  ];
  return paths.map((p) => ({ url: `${BASE}${p}`, changeFrequency: p === '/' ? 'daily' : 'weekly', priority: p === '/' ? 1 : 0.7 }));
}
