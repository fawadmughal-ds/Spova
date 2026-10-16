import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { marketBySlug } from '@/lib/markets';
import { publicGet, type PublicSymbol } from '@/lib/server-api';
import { MarketPage, type MarketCopy } from '@/components/marketing/market-page';
import { ContentPage, type ContentCopy } from '@/components/marketing/content-pages';

// `headline` is the hero title with the *accent* phrase marked; `title` feeds metadata.
const MARKETS: Record<string, MarketCopy & { cls: string }> = {
  forex: {
    cls: 'forex',
    title: 'Forex trading',
    headline: 'Forex *trading*',
    intro: 'Trade 40+ currency pairs including majors, minors and exotics with leverage up to 1:400 and spreads from 0.0 pips. The FX market runs 24 hours a day, five days a week.',
    bullets: ['Majors, minors and exotics', 'Leverage up to 1:400', 'Micro lots from 0.01', 'No requotes on market orders'],
  },
  indices: {
    cls: 'index',
    title: 'Indices trading',
    headline: 'Indices *trading*',
    intro: 'Speculate on the direction of entire stock markets: S&P 500, Nasdaq 100, Dow Jones, DAX 40, FTSE 100 and more, long or short, from one account.',
    bullets: ['US, European and Asian indices', 'Leverage up to 1:200', 'Trade cash indices during exchange hours', 'Hedge your equity portfolio'],
  },
  commodities: {
    cls: 'commodity',
    title: 'Commodities trading',
    headline: 'Commodities *trading*',
    intro: 'Energy and agricultural CFDs including WTI and Brent crude oil and natural gas. Go long or short with no physical delivery.',
    bullets: ['Crude oil (WTI, Brent)', 'Natural gas', 'Leverage up to 1:100', 'Transparent expiry calendar'],
  },
  shares: {
    cls: 'stock',
    title: 'Share CFDs',
    headline: 'Share *CFDs*',
    intro: 'Trade the biggest names on Wall Street as CFDs: Apple, Tesla, Amazon, NVIDIA and more. Fractional exposure, long and short.',
    bullets: ['US blue-chip shares', 'Leverage up to 1:5', 'Dividend adjustments', 'Exchange hours'],
  },
  cryptocurrencies: {
    cls: 'crypto',
    title: 'Crypto CFDs',
    headline: 'Crypto *CFDs*',
    intro: 'Bitcoin, Ethereum, Solana, XRP and Litecoin against the US dollar. Trade 24/7 without wallets, exchanges or custody risk.',
    bullets: ['24/7 trading', 'Leverage up to 1:5', 'No wallet needed', 'Live Binance pricing'],
  },
  metals: {
    cls: 'metal',
    title: 'Precious metals',
    headline: 'Precious *metals*',
    intro: 'Gold and silver against the US dollar. The classic safe-haven trade with leverage up to 1:200.',
    bullets: ['XAUUSD, XAGUSD', 'Leverage up to 1:200', 'Tight spreads', 'Trade during FX hours'],
  },
};

// Simple content pages (copy to be replaced by client-approved text in Phase 4).
const CONTENT: Record<string, ContentCopy> = {
  platform: {
    title: 'Web trading platform',
    paragraphs: [
      'Our browser-based terminal runs on any device with no download. Real-time charts with six timeframes, one-click market orders, pending limit and stop orders, and live P/L on every open position.',
      'Set stop-loss and take-profit on the ticket or edit them later from the positions table. Margin requirements are previewed before you confirm.',
      'Demo and live accounts share the same terminal, so what you practise is exactly what you trade.',
    ],
  },
  'about-us': {
    title: 'About us',
    paragraphs: [
      'We are a multi-asset CFD broker focused on fair pricing, straightforward account conditions and fast support. Across forex, indices, commodities, shares, crypto and metals, we give traders tight spreads, flexible leverage and a web terminal that works on any device.',
    ],
  },
  'contact-us': {
    title: 'Contact us',
    paragraphs: ['Support: info@zerventa.com - 24/5 live chat from the client area.'],
  },
  // questions and answers live in components/marketing/company-faq-data.ts; this is the hero lead
  faq: {
    title: 'Frequently asked questions',
    paragraphs: ['Short answers to what clients ask most, grouped by topic. Search them all, or pick a topic and browse.'],
  },
  legal: {
    title: 'Legal documents',
    paragraphs: [
      'Client Agreement, Risk Disclosure, AML & CFT Policy, Complaints Handling Procedure, General Fees, Margin Information, Order Execution Policy, Privacy Policy, Refund and Cancellation Policy, Website Terms of Use, Bonus Terms & Conditions.',
    ],
  },
};

export function generateStaticParams() {
  return [...Object.keys(MARKETS), ...Object.keys(CONTENT)].map((market) => ({ market }));
}

export async function generateMetadata({ params }: { params: Promise<{ market: string }> }): Promise<Metadata> {
  const { market } = await params;
  const m = MARKETS[market];
  if (m) return { title: m.title, description: m.intro };
  const c = CONTENT[market];
  return c ? { title: c.title } : {};
}

export default async function MarketRoute({ params }: { params: Promise<{ market: string }> }) {
  const { market } = await params;

  const c = CONTENT[market];
  if (c) {
    // only the platform page shows symbols (in the terminal preview)
    const symbols = market === 'platform' ? await publicGet<PublicSymbol[]>('/market/symbols', []) : [];
    const featured = symbols.filter((s) => s.featured).slice(0, 5);
    return <ContentPage slug={market} copy={c} symbols={featured.length ? featured : PREVIEW_FALLBACK} />;
  }

  const m = MARKETS[market];
  const meta = marketBySlug(market);
  if (!m || !meta) notFound();

  const symbols = await publicGet<PublicSymbol[]>(`/market/symbols?class=${m.cls}`, []);
  return <MarketPage market={meta} copy={m} symbols={symbols} />;
}

const PREVIEW_FALLBACK: PublicSymbol[] = [
  { id: 'EURUSD', name: 'Euro vs US Dollar', assetClass: 'forex', digits: 5, leverageMax: 400, spreadMarkup: '0', featured: true, quote: null },
  { id: 'XAUUSD', name: 'Gold', assetClass: 'metal', digits: 2, leverageMax: 200, spreadMarkup: '0', featured: true, quote: null },
  { id: 'BTCUSD', name: 'Bitcoin', assetClass: 'crypto', digits: 2, leverageMax: 5, spreadMarkup: '0', featured: true, quote: null },
  { id: 'US500', name: 'S&P 500', assetClass: 'index', digits: 2, leverageMax: 200, spreadMarkup: '0', featured: true, quote: null },
];
