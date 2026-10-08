import { ArrowLeftRight, BarChart3, Bitcoin, Building2, Droplets, Gem, type LucideIcon } from 'lucide-react';

/** One entry per asset class. `rgb` is the class accent as a space-separated triplet for rgb(var(--x) / a). */
export interface MarketMeta {
  slug: string;
  /** assetClass value used by the API */
  cls: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  rgb: string;
  leverage: string;
  hours: string;
}

export const MARKET_LIST: MarketMeta[] = [
  { slug: 'forex', cls: 'forex', label: 'Forex', blurb: 'Majors, minors and exotics', icon: ArrowLeftRight, rgb: '37 99 235', leverage: '1:400', hours: '24/5' },
  { slug: 'indices', cls: 'index', label: 'Indices', blurb: 'S&P 500, Nasdaq 100, DAX 40', icon: BarChart3, rgb: '2 132 199', leverage: '1:200', hours: 'Exchange hours' },
  { slug: 'commodities', cls: 'commodity', label: 'Commodities', blurb: 'Crude oil and natural gas', icon: Droplets, rgb: '211 78 9', leverage: '1:100', hours: '24/5' },
  { slug: 'shares', cls: 'stock', label: 'Shares', blurb: 'Wall Street blue chips', icon: Building2, rgb: '124 58 237', leverage: '1:5', hours: 'Exchange hours' },
  { slug: 'cryptocurrencies', cls: 'crypto', label: 'Crypto', blurb: 'BTC, ETH, SOL and more', icon: Bitcoin, rgb: '15 118 110', leverage: '1:5', hours: '24/7' },
  { slug: 'metals', cls: 'metal', label: 'Metals', blurb: 'Gold and silver vs USD', icon: Gem, rgb: '173 108 7', leverage: '1:200', hours: '24/5' },
];

export const marketByCls = (cls: string) => MARKET_LIST.find((m) => m.cls === cls);
export const marketBySlug = (slug: string) => MARKET_LIST.find((m) => m.slug === slug);

/** Round reference prices used by simulated previews and calculators while a symbol has no live quote. Not market data. */
export const INDICATIVE_PRICE: Record<string, number> = {
  EURUSD: 1.0842,
  GBPUSD: 1.2715,
  USDJPY: 149.32,
  AUDUSD: 0.6612,
  USDCAD: 1.3655,
  USDCHF: 0.8794,
  NZDUSD: 0.6051,
  XAUUSD: 2648.5,
  XAGUSD: 31.24,
  USOIL: 71.4,
  UKOIL: 75.1,
  NATGAS: 2.85,
  US500: 5720,
  US100: 20150,
  US30: 42300,
  AAPL: 228,
  TSLA: 245,
  AMZN: 186,
  NVDA: 124,
  BTCUSD: 67250,
  ETHUSD: 3480,
  LTCUSD: 71,
  XRPUSD: 0.58,
  SOLUSD: 152,
};
