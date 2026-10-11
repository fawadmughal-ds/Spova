/* eslint-disable no-console */
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * Idempotent reference data: risk tiers, symbols + sessions, the first superadmin (from SEED_ADMIN_*),
 * and a demo client outside production. Run by `pnpm db:seed` in dev and by `node dist/seed/cli.js`
 * on boot when SEED_ON_BOOT=true (hosted previews without a shell).
 */
const dec = (v: number | string) => new Prisma.Decimal(v);

type Sym = {
  id: string;
  name: string;
  assetClass: 'forex' | 'index' | 'commodity' | 'stock' | 'crypto' | 'metal';
  digits: number;
  contractSize: number;
  leverageMax: number;
  feedSource: string;
  feedSymbol: string;
  spreadMarkup?: number;
  swapLong?: number;
  swapShort?: number;
  maxLot?: number;
  featured?: boolean;
  sortOrder?: number;
};

const SYMBOLS: Sym[] = [
  // forex (synthetic DEMO feed until Twelve Data key)
  { id: 'EURUSD', name: 'Euro vs US Dollar', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EUR/USD', spreadMarkup: 0.00006, swapLong: -6.2, swapShort: 2.1, featured: true, sortOrder: 1 },
  { id: 'GBPUSD', name: 'British Pound vs US Dollar', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'GBP/USD', spreadMarkup: 0.00009, swapLong: -4.9, swapShort: 1.2, featured: true, sortOrder: 2 },
  { id: 'USDJPY', name: 'US Dollar vs Japanese Yen', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USD/JPY', spreadMarkup: 0.009, swapLong: 9.4, swapShort: -15.1, featured: true, sortOrder: 3 },
  { id: 'AUDUSD', name: 'Australian Dollar vs US Dollar', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'AUD/USD', spreadMarkup: 0.00009, swapLong: -2.1, swapShort: -0.8, sortOrder: 4 },
  { id: 'USDCAD', name: 'US Dollar vs Canadian Dollar', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USD/CAD', spreadMarkup: 0.0001, swapLong: 1.1, swapShort: -5.4, sortOrder: 5 },
  { id: 'USDCHF', name: 'US Dollar vs Swiss Franc', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USD/CHF', spreadMarkup: 0.0001, swapLong: 7.5, swapShort: -13.2, sortOrder: 6 },
  { id: 'NZDUSD', name: 'New Zealand Dollar vs US Dollar', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'NZD/USD', spreadMarkup: 0.00012, swapLong: -1.9, swapShort: -1.1, sortOrder: 7 },
  { id: 'EURGBP', name: 'Euro vs British Pound', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EUR/GBP', spreadMarkup: 0.0001, swapLong: -3.4, swapShort: 0.4, sortOrder: 8 },
  { id: 'EURJPY', name: 'Euro vs Japanese Yen', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EUR/JPY', spreadMarkup: 0.012, swapLong: 6.1, swapShort: -12.3, sortOrder: 9 },
  { id: 'GBPJPY', name: 'British Pound vs Japanese Yen', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'GBP/JPY', spreadMarkup: 0.015, swapLong: 8.9, swapShort: -16.4, sortOrder: 10 },
  // metals
  { id: 'XAUUSD', name: 'Gold vs US Dollar', assetClass: 'metal', digits: 2, contractSize: 100, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'XAU/USD', spreadMarkup: 0.15, swapLong: -28.5, swapShort: 14.2, featured: true, sortOrder: 20 },
  { id: 'XAGUSD', name: 'Silver vs US Dollar', assetClass: 'metal', digits: 3, contractSize: 5000, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'XAG/USD', spreadMarkup: 0.015, swapLong: -4.2, swapShort: 1.8, sortOrder: 21 },
  // commodities
  { id: 'USOIL', name: 'WTI Crude Oil', assetClass: 'commodity', digits: 2, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'WTI/USD', spreadMarkup: 0.03, swapLong: -9.2, swapShort: -3.1, featured: true, sortOrder: 30 },
  { id: 'UKOIL', name: 'Brent Crude Oil', assetClass: 'commodity', digits: 2, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'BRENT/USD', spreadMarkup: 0.03, swapLong: -9.8, swapShort: -3.4, sortOrder: 31 },
  { id: 'NATGAS', name: 'Natural Gas', assetClass: 'commodity', digits: 3, contractSize: 10000, leverageMax: 50, feedSource: 'synthetic', feedSymbol: 'NG/USD', spreadMarkup: 0.004, swapLong: -1.2, swapShort: -0.9, sortOrder: 32 },
  // indices
  { id: 'US500', name: 'S&P 500', assetClass: 'index', digits: 2, contractSize: 1, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'SPX', spreadMarkup: 0.4, swapLong: -1.1, swapShort: -0.6, featured: true, sortOrder: 40 },
  { id: 'US100', name: 'Nasdaq 100', assetClass: 'index', digits: 2, contractSize: 1, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'NDX', spreadMarkup: 1.0, swapLong: -3.2, swapShort: -1.8, sortOrder: 41 },
  { id: 'US30', name: 'Dow Jones 30', assetClass: 'index', digits: 2, contractSize: 1, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'DJI', spreadMarkup: 2.0, swapLong: -6.5, swapShort: -3.9, sortOrder: 42 },
  { id: 'DE40', name: 'DAX 40', assetClass: 'index', digits: 2, contractSize: 1, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'DAX', spreadMarkup: 1.2, swapLong: -2.4, swapShort: -1.3, sortOrder: 43 },
  { id: 'UK100', name: 'FTSE 100', assetClass: 'index', digits: 2, contractSize: 1, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'FTSE', spreadMarkup: 1.0, swapLong: -1.5, swapShort: -0.9, sortOrder: 44 },
  // stocks
  { id: 'AAPL', name: 'Apple Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'AAPL', spreadMarkup: 0.05, swapLong: -0.03, swapShort: -0.02, maxLot: 1000, sortOrder: 50 },
  { id: 'TSLA', name: 'Tesla Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'TSLA', spreadMarkup: 0.08, swapLong: -0.04, swapShort: -0.02, maxLot: 1000, sortOrder: 51 },
  { id: 'AMZN', name: 'Amazon.com Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'AMZN', spreadMarkup: 0.06, swapLong: -0.03, swapShort: -0.02, maxLot: 1000, sortOrder: 52 },
  { id: 'NVDA', name: 'NVIDIA Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'NVDA', spreadMarkup: 0.06, swapLong: -0.03, swapShort: -0.02, maxLot: 1000, sortOrder: 53 },
  // crypto (Binance bookTicker, free)
  { id: 'BTCUSD', name: 'Bitcoin vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'btcusdt', spreadMarkup: 8, swapLong: -0.05, swapShort: -0.05, maxLot: 20, featured: true, sortOrder: 60 },
  { id: 'ETHUSD', name: 'Ethereum vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'ethusdt', spreadMarkup: 0.6, swapLong: -0.05, swapShort: -0.05, maxLot: 200, featured: true, sortOrder: 61 },
  { id: 'LTCUSD', name: 'Litecoin vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'ltcusdt', spreadMarkup: 0.08, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 62 },
  { id: 'XRPUSD', name: 'Ripple vs US Dollar', assetClass: 'crypto', digits: 4, contractSize: 1000, leverageMax: 5, feedSource: 'binance', feedSymbol: 'xrpusdt', spreadMarkup: 0.0006, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 63 },
  { id: 'SOLUSD', name: 'Solana vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'solusdt', spreadMarkup: 0.05, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 64 },
  // --- additional catalogue ---
  // forex crosses
  { id: 'AUDJPY', name: 'Australian Dollar vs Japanese Yen', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'AUD/JPY', spreadMarkup: 0.012, swapLong: 3.1, swapShort: -8.4, sortOrder: 9 },
  { id: 'EURCHF', name: 'Euro vs Swiss Franc', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EUR/CHF', spreadMarkup: 0.00012, swapLong: 2.4, swapShort: -6.1, sortOrder: 10 },
  { id: 'GBPCHF', name: 'British Pound vs Swiss Franc', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'GBP/CHF', spreadMarkup: 0.00018, swapLong: 3.9, swapShort: -9.2, sortOrder: 11 },
  { id: 'CADJPY', name: 'Canadian Dollar vs Japanese Yen', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'CAD/JPY', spreadMarkup: 0.012, swapLong: 2.8, swapShort: -7.6, sortOrder: 12 },
  { id: 'NZDJPY', name: 'New Zealand Dollar vs Japanese Yen', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'NZD/JPY', spreadMarkup: 0.013, swapLong: 2.6, swapShort: -7.1, sortOrder: 13 },
  { id: 'EURAUD', name: 'Euro vs Australian Dollar', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EUR/AUD', spreadMarkup: 0.00016, swapLong: -5.2, swapShort: 1.4, sortOrder: 14 },
  { id: 'GBPAUD', name: 'British Pound vs Australian Dollar', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'GBP/AUD', spreadMarkup: 0.0002, swapLong: -4.1, swapShort: 0.9, sortOrder: 15 },
  { id: 'AUDNZD', name: 'Australian Dollar vs New Zealand Dollar', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'AUD/NZD', spreadMarkup: 0.00018, swapLong: -1.2, swapShort: -1.1, sortOrder: 16 },
  { id: 'EURCAD', name: 'Euro vs Canadian Dollar', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EUR/CAD', spreadMarkup: 0.00015, swapLong: -4.6, swapShort: 0.8, sortOrder: 17 },
  { id: 'CHFJPY', name: 'Swiss Franc vs Japanese Yen', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'CHF/JPY', spreadMarkup: 0.014, swapLong: 1.1, swapShort: -4.9, sortOrder: 18 },
  // metals
  { id: 'XPTUSD', name: 'Platinum vs US Dollar', assetClass: 'metal', digits: 2, contractSize: 100, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'XPT/USD', spreadMarkup: 0.6, swapLong: -12.1, swapShort: 5.4, sortOrder: 22 },
  { id: 'XPDUSD', name: 'Palladium vs US Dollar', assetClass: 'metal', digits: 2, contractSize: 100, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'XPD/USD', spreadMarkup: 1.2, swapLong: -14.8, swapShort: 6.1, sortOrder: 23 },
  // commodities
  { id: 'COPPER', name: 'Copper', assetClass: 'commodity', digits: 4, contractSize: 25000, leverageMax: 50, feedSource: 'synthetic', feedSymbol: 'COPPER/USD', spreadMarkup: 0.0015, swapLong: -2.1, swapShort: -1.4, sortOrder: 33 },
  { id: 'WHEAT', name: 'Wheat', assetClass: 'commodity', digits: 2, contractSize: 50, leverageMax: 20, feedSource: 'synthetic', feedSymbol: 'WHEAT/USD', spreadMarkup: 0.25, swapLong: -1.8, swapShort: -1.2, sortOrder: 34 },
  { id: 'CORN', name: 'Corn', assetClass: 'commodity', digits: 2, contractSize: 50, leverageMax: 20, feedSource: 'synthetic', feedSymbol: 'CORN/USD', spreadMarkup: 0.25, swapLong: -1.6, swapShort: -1.1, sortOrder: 35 },
  { id: 'COFFEE', name: 'Coffee', assetClass: 'commodity', digits: 2, contractSize: 100, leverageMax: 20, feedSource: 'synthetic', feedSymbol: 'COFFEE/USD', spreadMarkup: 0.3, swapLong: -2.4, swapShort: -1.6, sortOrder: 36 },
  // indices
  { id: 'JP225', name: 'Japan 225', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'JP225', spreadMarkup: 8, swapLong: -2.1, swapShort: -1.1, sortOrder: 44 },
  { id: 'AUS200', name: 'Australia 200', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'AUS200', spreadMarkup: 2, swapLong: -1.8, swapShort: -0.9, sortOrder: 45 },
  { id: 'HK50', name: 'Hong Kong 50', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'HK50', spreadMarkup: 6, swapLong: -2.4, swapShort: -1.2, sortOrder: 46 },
  { id: 'FRA40', name: 'France 40', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'FRA40', spreadMarkup: 2, swapLong: -1.9, swapShort: -1.0, sortOrder: 47 },
  { id: 'EU50', name: 'Euro Stoxx 50', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'EU50', spreadMarkup: 2, swapLong: -1.9, swapShort: -1.0, sortOrder: 48 },
  { id: 'US2000', name: 'US Russell 2000', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'US2000', spreadMarkup: 1.5, swapLong: -2.0, swapShort: -1.1, sortOrder: 49 },
  // shares
  { id: 'MSFT', name: 'Microsoft Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'MSFT', spreadMarkup: 0.05, swapLong: -0.03, swapShort: -0.02, maxLot: 1000, sortOrder: 54 },
  { id: 'GOOGL', name: 'Alphabet Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'GOOGL', spreadMarkup: 0.05, swapLong: -0.03, swapShort: -0.02, maxLot: 1000, sortOrder: 55 },
  { id: 'META', name: 'Meta Platforms Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'META', spreadMarkup: 0.06, swapLong: -0.03, swapShort: -0.02, maxLot: 1000, sortOrder: 56 },
  { id: 'NFLX', name: 'Netflix Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'NFLX', spreadMarkup: 0.08, swapLong: -0.04, swapShort: -0.02, maxLot: 1000, sortOrder: 57 },
  { id: 'AMD', name: 'Advanced Micro Devices', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'AMD', spreadMarkup: 0.05, swapLong: -0.03, swapShort: -0.02, maxLot: 1000, sortOrder: 58 },
  { id: 'INTC', name: 'Intel Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'INTC', spreadMarkup: 0.03, swapLong: -0.02, swapShort: -0.02, maxLot: 1000, sortOrder: 59 },
  { id: 'JPM', name: 'JPMorgan Chase & Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'JPM', spreadMarkup: 0.05, swapLong: -0.03, swapShort: -0.02, maxLot: 1000, sortOrder: 66 },
  { id: 'DIS', name: 'Walt Disney Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'DIS', spreadMarkup: 0.04, swapLong: -0.03, swapShort: -0.02, maxLot: 1000, sortOrder: 67 },
  { id: 'BABA', name: 'Alibaba Group', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'BABA', spreadMarkup: 0.05, swapLong: -0.03, swapShort: -0.02, maxLot: 1000, sortOrder: 68 },
  // crypto (binance has live prices for these)
  { id: 'BNBUSD', name: 'BNB vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'bnbusdt', spreadMarkup: 0.3, swapLong: -0.05, swapShort: -0.05, maxLot: 200, sortOrder: 70 },
  { id: 'ADAUSD', name: 'Cardano vs US Dollar', assetClass: 'crypto', digits: 4, contractSize: 1000, leverageMax: 5, feedSource: 'binance', feedSymbol: 'adausdt', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 71 },
  { id: 'DOGUSD', name: 'Dogecoin vs US Dollar', assetClass: 'crypto', digits: 5, contractSize: 10000, leverageMax: 5, feedSource: 'binance', feedSymbol: 'dogeusdt', spreadMarkup: 0.00004, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 72 },
  { id: 'DOTUSD', name: 'Polkadot vs US Dollar', assetClass: 'crypto', digits: 3, contractSize: 100, leverageMax: 5, feedSource: 'binance', feedSymbol: 'dotusdt', spreadMarkup: 0.004, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 73 },
  { id: 'AVAUSD', name: 'Avalanche vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 10, leverageMax: 5, feedSource: 'binance', feedSymbol: 'avaxusdt', spreadMarkup: 0.03, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 74 },
  { id: 'LNKUSD', name: 'Chainlink vs US Dollar', assetClass: 'crypto', digits: 3, contractSize: 100, leverageMax: 5, feedSource: 'binance', feedSymbol: 'linkusdt', spreadMarkup: 0.01, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 75 },
  { id: 'TRXUSD', name: 'TRON vs US Dollar', assetClass: 'crypto', digits: 5, contractSize: 10000, leverageMax: 5, feedSource: 'binance', feedSymbol: 'trxusdt', spreadMarkup: 0.00005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 76 },
];

const RISK = [
  { tier: 'classic', minDeposit: 200, defaultLeverage: 100, maxLeverage: 400, spreadDiscountPct: 0 },
  { tier: 'silver', minDeposit: 5000, defaultLeverage: 100, maxLeverage: 400, spreadDiscountPct: 10 },
  { tier: 'gold', minDeposit: 25000, defaultLeverage: 100, maxLeverage: 400, spreadDiscountPct: 20 },
  { tier: 'platinum', minDeposit: 50000, defaultLeverage: 100, maxLeverage: 400, spreadDiscountPct: 30 },
  { tier: 'vip', minDeposit: 100000, defaultLeverage: 100, maxLeverage: 400, spreadDiscountPct: 40 },
] as const;

/** FX sessions: Sun 22:00 -> Fri 22:00 UTC. Crypto 24/7 (no rows = always open). Stocks/indices: Mon-Fri 13:30-20:00 UTC. */
function sessionsFor(s: Sym): { weekday: number; openTime: string; closeTime: string }[] {
  if (s.assetClass === 'crypto') return [];
  if (s.assetClass === 'stock' || s.assetClass === 'index') {
    return [1, 2, 3, 4, 5].map((weekday) => ({ weekday, openTime: '13:30', closeTime: '20:00' }));
  }
  return [
    { weekday: 0, openTime: '22:00', closeTime: '24:00' },
    ...[1, 2, 3, 4].map((weekday) => ({ weekday, openTime: '00:00', closeTime: '24:00' })),
    { weekday: 5, openTime: '00:00', closeTime: '22:00' },
  ];
}

export async function runSeed(prisma: PrismaClient, opts: { demoClient?: boolean } = {}) {
  // risk configs
  for (const r of RISK) {
    await prisma.riskConfig.upsert({
      where: { tier: r.tier },
      create: { tier: r.tier, marginCallPct: dec(100), stopOutPct: dec(20), defaultLeverage: r.defaultLeverage, maxLeverage: r.maxLeverage, minDeposit: dec(r.minDeposit), spreadDiscountPct: dec(r.spreadDiscountPct) },
      update: {},
    });
  }
  console.log(`risk configs: ${RISK.length}`);

  // symbols
  for (const s of SYMBOLS) {
    await prisma.symbol.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        name: s.name,
        assetClass: s.assetClass,
        digits: s.digits,
        contractSize: dec(s.contractSize),
        maxLot: dec(s.maxLot ?? 50),
        leverageMax: s.leverageMax,
        spreadMarkup: dec(s.spreadMarkup ?? 0),
        swapLong: dec(s.swapLong ?? 0),
        swapShort: dec(s.swapShort ?? 0),
        feedSource: s.feedSource,
        feedSymbol: s.feedSymbol,
        featured: s.featured ?? false,
        sortOrder: s.sortOrder ?? 100,
        sessions: { create: sessionsFor(s) },
      },
      update: { name: s.name, leverageMax: s.leverageMax, featured: s.featured ?? false, sortOrder: s.sortOrder ?? 100 },
    });
  }
  console.log(`symbols: ${SYMBOLS.length}`);

  // superadmin
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@zerventa.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await argon2.hash(adminPassword, { type: argon2.argon2id }),
        role: 'superadmin',
        emailVerifiedAt: new Date(),
        tcAcceptedAt: new Date(),
        riskAcceptedAt: new Date(),
        profile: { create: { firstName: 'Super', lastName: 'Admin', phone: '+10000000000', countryCode: 'AE' } },
      },
    });
    console.log(`superadmin created: ${adminEmail} / ${adminPassword}  <- change after first login`);
  } else {
    console.log(`superadmin exists: ${adminEmail}`);
  }

  // demo client (dev only)
  if (opts.demoClient ?? process.env.NODE_ENV !== 'production') {
    const demoEmail = 'client@zerventa.local';
    const u = await prisma.user.findUnique({ where: { email: demoEmail } });
    if (!u) {
      const start = new Prisma.Decimal(process.env.DEMO_START_BALANCE ?? '10000');
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: demoEmail,
            passwordHash: await argon2.hash('Client@12345', { type: argon2.argon2id }),
            tcAcceptedAt: new Date(),
            riskAcceptedAt: new Date(),
            profile: { create: { firstName: 'Demo', lastName: 'Client', phone: '+971501234567', countryCode: 'AE', dob: new Date('1990-05-15'), city: 'Dubai' } },
          },
        });
        const acc = await tx.tradingAccount.create({
          data: { userId: user.id, type: 'demo', loginCode: 100001, leverage: 100, balance: start },
        });
        await tx.ledgerEntry.create({
          data: { accountId: acc.id, type: 'credit', amount: start, balanceAfter: start, creditAfter: dec(0), reason: 'Demo account opening balance', refType: 'system' },
        });
      });
      console.log(`demo client created: ${demoEmail} / Client@12345 (login 100001)`);
    }
  }
}

