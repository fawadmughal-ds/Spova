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
  { id: 'EURUSD', name: 'EUR vs USD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURUSD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, featured: true, sortOrder: 1 },
  { id: 'GBPUSD', name: 'GBP vs USD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'GBPUSD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, featured: true, sortOrder: 2 },
  { id: 'USDJPY', name: 'USD vs JPY', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDJPY', spreadMarkup: 0.008, swapLong: -2.5, swapShort: -1.5, featured: true, sortOrder: 3 },
  { id: 'AUDUSD', name: 'AUD vs USD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'AUDUSD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 4 },
  { id: 'USDCAD', name: 'USD vs CAD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDCAD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 5 },
  { id: 'USDCHF', name: 'USD vs CHF', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDCHF', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 6 },
  { id: 'NZDUSD', name: 'NZD vs USD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'NZDUSD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 7 },
  { id: 'EURGBP', name: 'EUR vs GBP', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURGBP', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 8 },
  { id: 'EURJPY', name: 'EUR vs JPY', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURJPY', spreadMarkup: 0.008, swapLong: -2.5, swapShort: -1.5, sortOrder: 9 },
  { id: 'GBPJPY', name: 'GBP vs JPY', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'GBPJPY', spreadMarkup: 0.008, swapLong: -2.5, swapShort: -1.5, sortOrder: 10 },
  { id: 'AUDJPY', name: 'AUD vs JPY', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'AUDJPY', spreadMarkup: 0.008, swapLong: -2.5, swapShort: -1.5, sortOrder: 11 },
  { id: 'EURCHF', name: 'EUR vs CHF', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURCHF', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 12 },
  { id: 'GBPCHF', name: 'GBP vs CHF', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'GBPCHF', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 13 },
  { id: 'CADJPY', name: 'CAD vs JPY', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'CADJPY', spreadMarkup: 0.008, swapLong: -2.5, swapShort: -1.5, sortOrder: 14 },
  { id: 'NZDJPY', name: 'NZD vs JPY', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'NZDJPY', spreadMarkup: 0.008, swapLong: -2.5, swapShort: -1.5, sortOrder: 15 },
  { id: 'EURAUD', name: 'EUR vs AUD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURAUD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 16 },
  { id: 'GBPAUD', name: 'GBP vs AUD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'GBPAUD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 17 },
  { id: 'AUDNZD', name: 'AUD vs NZD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'AUDNZD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 18 },
  { id: 'EURCAD', name: 'EUR vs CAD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURCAD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 19 },
  { id: 'CHFJPY', name: 'CHF vs JPY', assetClass: 'forex', digits: 3, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'CHFJPY', spreadMarkup: 0.008, swapLong: -2.5, swapShort: -1.5, sortOrder: 20 },
  { id: 'EURNZD', name: 'EUR vs NZD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURNZD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 21 },
  { id: 'GBPNZD', name: 'GBP vs NZD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'GBPNZD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 22 },
  { id: 'AUDCAD', name: 'AUD vs CAD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'AUDCAD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 23 },
  { id: 'AUDCHF', name: 'AUD vs CHF', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'AUDCHF', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 24 },
  { id: 'NZDCAD', name: 'NZD vs CAD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'NZDCAD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 25 },
  { id: 'NZDCHF', name: 'NZD vs CHF', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'NZDCHF', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 26 },
  { id: 'CADCHF', name: 'CAD vs CHF', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'CADCHF', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 27 },
  { id: 'GBPCAD', name: 'GBP vs CAD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'GBPCAD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 28 },
  { id: 'EURSEK', name: 'EUR vs SEK', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURSEK', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 29 },
  { id: 'EURNOK', name: 'EUR vs NOK', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURNOK', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 30 },
  { id: 'USDSEK', name: 'USD vs SEK', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDSEK', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 31 },
  { id: 'USDNOK', name: 'USD vs NOK', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDNOK', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 32 },
  { id: 'USDMXN', name: 'USD vs MXN', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDMXN', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 33 },
  { id: 'USDZAR', name: 'USD vs ZAR', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDZAR', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 34 },
  { id: 'USDTRY', name: 'USD vs TRY', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDTRY', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 35 },
  { id: 'USDSGD', name: 'USD vs SGD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDSGD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 36 },
  { id: 'USDHKD', name: 'USD vs HKD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDHKD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 37 },
  { id: 'USDPLN', name: 'USD vs PLN', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDPLN', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 38 },
  { id: 'USDDKK', name: 'USD vs DKK', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDDKK', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 39 },
  { id: 'USDCNH', name: 'USD vs CNH', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDCNH', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 40 },
  { id: 'USDINR', name: 'USD vs INR', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDINR', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 41 },
  { id: 'EURTRY', name: 'EUR vs TRY', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURTRY', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 42 },
  { id: 'EURPLN', name: 'EUR vs PLN', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURPLN', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 43 },
  { id: 'GBPSGD', name: 'GBP vs SGD', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'GBPSGD', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 44 },
  { id: 'EURHUF', name: 'EUR vs HUF', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURHUF', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 45 },
  { id: 'USDTHB', name: 'USD vs THB', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDTHB', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 46 },
  { id: 'EURCZK', name: 'EUR vs CZK', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'EURCZK', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 47 },
  { id: 'USDCZK', name: 'USD vs CZK', assetClass: 'forex', digits: 5, contractSize: 100000, leverageMax: 400, feedSource: 'synthetic', feedSymbol: 'USDCZK', spreadMarkup: 8e-05, swapLong: -2.5, swapShort: -1.5, sortOrder: 48 },
  { id: 'XAUUSD', name: 'Gold vs US Dollar', assetClass: 'metal', digits: 2, contractSize: 100, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'XAUUSD', spreadMarkup: 0.15, swapLong: -8.0, swapShort: 3.0, featured: true, sortOrder: 100 },
  { id: 'XAGUSD', name: 'Silver vs US Dollar', assetClass: 'metal', digits: 3, contractSize: 5000, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'XAGUSD', spreadMarkup: 0.15, swapLong: -8.0, swapShort: 3.0, sortOrder: 101 },
  { id: 'XPTUSD', name: 'Platinum vs US Dollar', assetClass: 'metal', digits: 2, contractSize: 100, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'XPTUSD', spreadMarkup: 0.15, swapLong: -8.0, swapShort: 3.0, sortOrder: 102 },
  { id: 'XPDUSD', name: 'Palladium vs US Dollar', assetClass: 'metal', digits: 2, contractSize: 100, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'XPDUSD', spreadMarkup: 0.15, swapLong: -8.0, swapShort: 3.0, sortOrder: 103 },
  { id: 'XAUEUR', name: 'Gold vs Euro', assetClass: 'metal', digits: 2, contractSize: 100, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'XAUEUR', spreadMarkup: 0.15, swapLong: -8.0, swapShort: 3.0, sortOrder: 104 },
  { id: 'XAGEUR', name: 'Silver vs Euro', assetClass: 'metal', digits: 3, contractSize: 5000, leverageMax: 200, feedSource: 'synthetic', feedSymbol: 'XAGEUR', spreadMarkup: 0.15, swapLong: -8.0, swapShort: 3.0, sortOrder: 105 },
  { id: 'USOIL', name: 'Crude Oil WTI', assetClass: 'commodity', digits: 2, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'USOIL', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 140 },
  { id: 'UKOIL', name: 'Crude Oil Brent', assetClass: 'commodity', digits: 2, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'UKOIL', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 141 },
  { id: 'NATGAS', name: 'Natural Gas', assetClass: 'commodity', digits: 3, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'NATGAS', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 142 },
  { id: 'COPPER', name: 'Copper', assetClass: 'commodity', digits: 3, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'COPPER', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 143 },
  { id: 'WHEAT', name: 'Wheat', assetClass: 'commodity', digits: 2, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'WHEAT', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 144 },
  { id: 'CORN', name: 'Corn', assetClass: 'commodity', digits: 2, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'CORN', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 145 },
  { id: 'COFFEE', name: 'Coffee', assetClass: 'commodity', digits: 2, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'COFFEE', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 146 },
  { id: 'SUGAR', name: 'Sugar', assetClass: 'commodity', digits: 4, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'SUGAR', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 147 },
  { id: 'COCOA', name: 'Cocoa', assetClass: 'commodity', digits: 1, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'COCOA', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 148 },
  { id: 'COTTON', name: 'Cotton', assetClass: 'commodity', digits: 2, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'COTTON', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 149 },
  { id: 'SOYBEAN', name: 'Soybean', assetClass: 'commodity', digits: 2, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'SOYBEAN', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 150 },
  { id: 'GASOLINE', name: 'Gasoline RBOB', assetClass: 'commodity', digits: 4, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'GASOLINE', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 151 },
  { id: 'ALUMINIUM', name: 'Aluminium', assetClass: 'commodity', digits: 1, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'ALUMINIUM', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 152 },
  { id: 'NICKEL', name: 'Nickel', assetClass: 'commodity', digits: 1, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'NICKEL', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 153 },
  { id: 'ZINC', name: 'Zinc', assetClass: 'commodity', digits: 1, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'ZINC', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 154 },
  { id: 'ORANGE', name: 'Orange Juice', assetClass: 'commodity', digits: 2, contractSize: 1000, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'ORANGE', spreadMarkup: 0.03, swapLong: -1.0, swapShort: -1.0, sortOrder: 155 },
  { id: 'US500', name: 'S&P 500 Index', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'US500', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, featured: true, sortOrder: 180 },
  { id: 'US100', name: 'Nasdaq 100 Index', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'US100', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, featured: true, sortOrder: 181 },
  { id: 'US30', name: 'Dow Jones 30', assetClass: 'index', digits: 0, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'US30', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, featured: true, sortOrder: 182 },
  { id: 'DE40', name: 'Germany 40 (DAX)', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'DE40', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 183 },
  { id: 'UK100', name: 'UK 100 (FTSE)', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'UK100', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 184 },
  { id: 'JP225', name: 'Japan 225 (Nikkei)', assetClass: 'index', digits: 0, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'JP225', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 185 },
  { id: 'AUS200', name: 'Australia 200 (ASX)', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'AUS200', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 186 },
  { id: 'HK50', name: 'Hong Kong 50 (HSI)', assetClass: 'index', digits: 0, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'HK50', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 187 },
  { id: 'FRA40', name: 'France 40 (CAC)', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'FRA40', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 188 },
  { id: 'EU50', name: 'Euro Stoxx 50', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'EU50', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 189 },
  { id: 'US2000', name: 'US Russell 2000', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'US2000', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 190 },
  { id: 'ES35', name: 'Spain 35 (IBEX)', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'ES35', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 191 },
  { id: 'IT40', name: 'Italy 40 (FTSE MIB)', assetClass: 'index', digits: 0, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'IT40', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 192 },
  { id: 'NL25', name: 'Netherlands 25 (AEX)', assetClass: 'index', digits: 2, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'NL25', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 193 },
  { id: 'CH20', name: 'Switzerland 20 (SMI)', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'CH20', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 194 },
  { id: 'SE30', name: 'Sweden 30 (OMX)', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'SE30', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 195 },
  { id: 'IN50', name: 'India 50 (Nifty)', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'IN50', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 196 },
  { id: 'CN50', name: 'China A50', assetClass: 'index', digits: 0, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'CN50', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 197 },
  { id: 'SG30', name: 'Singapore 30 (STI)', assetClass: 'index', digits: 1, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'SG30', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 198 },
  { id: 'KR200', name: 'Korea 200 (KOSPI)', assetClass: 'index', digits: 2, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'KR200', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 199 },
  { id: 'ZA40', name: 'South Africa 40', assetClass: 'index', digits: 0, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'ZA40', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 200 },
  { id: 'BR50', name: 'Brazil 50 (Bovespa)', assetClass: 'index', digits: 0, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'BR50', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 201 },
  { id: 'MX35', name: 'Mexico 35 (IPC)', assetClass: 'index', digits: 0, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'MX35', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 202 },
  { id: 'JP400', name: 'Japan 400', assetClass: 'index', digits: 0, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'JP400', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 203 },
  { id: 'VOL', name: 'Volatility Index (VIX)', assetClass: 'index', digits: 2, contractSize: 1, leverageMax: 100, feedSource: 'synthetic', feedSymbol: 'VOL', spreadMarkup: 0.5, swapLong: -3.0, swapShort: -3.0, sortOrder: 204 },
  { id: 'BTCUSD', name: 'Bitcoin vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'BTCUSDT', spreadMarkup: 66.8, swapLong: -0.05, swapShort: -0.05, maxLot: 500, featured: true, sortOrder: 240 },
  { id: 'ETHUSD', name: 'Ethereum vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'ETHUSDT', spreadMarkup: 2.024, swapLong: -0.05, swapShort: -0.05, maxLot: 500, featured: true, sortOrder: 241 },
  { id: 'LTCUSD', name: 'Litecoin vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'LTCUSDT', spreadMarkup: 0.076, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 242 },
  { id: 'XRPUSD', name: 'Ripple vs US Dollar', assetClass: 'crypto', digits: 4, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'XRPUSDT', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 243 },
  { id: 'SOLUSD', name: 'Solana vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'SOLUSDT', spreadMarkup: 0.144, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 244 },
  { id: 'BNBUSD', name: 'BNB vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'BNBUSDT', spreadMarkup: 0.48, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 245 },
  { id: 'ADAUSD', name: 'Cardano vs US Dollar', assetClass: 'crypto', digits: 4, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'ADAUSDT', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 246 },
  { id: 'DOGUSD', name: 'Dogecoin vs US Dollar', assetClass: 'crypto', digits: 5, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'DOGEUSDT', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 247 },
  { id: 'DOTUSD', name: 'Polkadot vs US Dollar', assetClass: 'crypto', digits: 3, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'DOTUSDT', spreadMarkup: 0.0044, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 248 },
  { id: 'AVAUSD', name: 'Avalanche vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'AVAXUSDT', spreadMarkup: 0.0224, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 249 },
  { id: 'LNKUSD', name: 'Chainlink vs US Dollar', assetClass: 'crypto', digits: 3, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'LINKUSDT', spreadMarkup: 0.0104, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 250 },
  { id: 'TRXUSD', name: 'TRON vs US Dollar', assetClass: 'crypto', digits: 5, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'TRXUSDT', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 251 },
  { id: 'MATUSD', name: 'Polygon vs US Dollar', assetClass: 'crypto', digits: 4, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'MATUSD', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 252 },
  { id: 'ATMUSD', name: 'Cosmos vs US Dollar', assetClass: 'crypto', digits: 3, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'ATOMUSDT', spreadMarkup: 0.00512, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 253 },
  { id: 'UNIUSD', name: 'Uniswap vs US Dollar', assetClass: 'crypto', digits: 3, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'UNIUSDT', spreadMarkup: 0.00648, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 254 },
  { id: 'ETCUSD', name: 'Ethereum Classic vs USD', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'ETCUSDT', spreadMarkup: 0.018, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 255 },
  { id: 'FILUSD', name: 'Filecoin vs US Dollar', assetClass: 'crypto', digits: 3, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'FILUSDT', spreadMarkup: 0.00344, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 256 },
  { id: 'XLMUSD', name: 'Stellar vs US Dollar', assetClass: 'crypto', digits: 5, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'XLMUSDT', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 257 },
  { id: 'VETUSD', name: 'VeChain vs US Dollar', assetClass: 'crypto', digits: 5, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'VETUSDT', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 258 },
  { id: 'ICPUSD', name: 'Internet Computer vs USD', assetClass: 'crypto', digits: 3, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'ICPUSDT', spreadMarkup: 0.00736, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 259 },
  { id: 'APTUSD', name: 'Aptos vs US Dollar', assetClass: 'crypto', digits: 3, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'APTUSDT', spreadMarkup: 0.0076, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 260 },
  { id: 'NERUSD', name: 'NEAR Protocol vs USD', assetClass: 'crypto', digits: 3, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'NEARUSDT', spreadMarkup: 0.00384, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 261 },
  { id: 'AAVUSD', name: 'Aave vs US Dollar', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'AAVEUSDT', spreadMarkup: 0.1216, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 262 },
  { id: 'SNDUSD', name: 'The Sandbox vs USD', assetClass: 'crypto', digits: 4, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'SANDUSDT', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 263 },
  { id: 'MANUSD', name: 'Decentraland vs USD', assetClass: 'crypto', digits: 4, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'MANAUSDT', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 264 },
  { id: 'ALGUSD', name: 'Algorand vs US Dollar', assetClass: 'crypto', digits: 5, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'ALGOUSDT', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 265 },
  { id: 'EOSUSD', name: 'EOS vs US Dollar', assetClass: 'crypto', digits: 4, contractSize: 1, leverageMax: 5, feedSource: 'synthetic', feedSymbol: 'EOSUSD', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 266 },
  { id: 'XTZUSD', name: 'Tezos vs US Dollar', assetClass: 'crypto', digits: 4, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'XTZUSDT', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 267 },
  { id: 'BCHUSD', name: 'Bitcoin Cash vs USD', assetClass: 'crypto', digits: 2, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'BCHUSDT', spreadMarkup: 0.28, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 268 },
  { id: 'SHBUSD', name: 'Shiba Inu vs USD', assetClass: 'crypto', digits: 9, contractSize: 1, leverageMax: 5, feedSource: 'binance', feedSymbol: 'SHIBUSDT', spreadMarkup: 0.0005, swapLong: -0.05, swapShort: -0.05, maxLot: 500, sortOrder: 269 },
  { id: 'AAPL', name: 'Apple Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'AAPL', spreadMarkup: 0.114, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 320 },
  { id: 'MSFT', name: 'Microsoft Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MSFT', spreadMarkup: 0.2075, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 321 },
  { id: 'AMZN', name: 'Amazon.com Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'AMZN', spreadMarkup: 0.093, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 322 },
  { id: 'NVDA', name: 'NVIDIA Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'NVDA', spreadMarkup: 0.062, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 323 },
  { id: 'GOOGL', name: 'Alphabet Inc. Class A', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'GOOGL', spreadMarkup: 0.084, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 324 },
  { id: 'META', name: 'Meta Platforms Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'META', spreadMarkup: 0.2825, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 325 },
  { id: 'TSLA', name: 'Tesla Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'TSLA', spreadMarkup: 0.1225, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 326 },
  { id: 'NFLX', name: 'Netflix Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'NFLX', spreadMarkup: 0.35, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 327 },
  { id: 'AMD', name: 'Advanced Micro Devices', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'AMD', spreadMarkup: 0.079, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 328 },
  { id: 'INTC', name: 'Intel Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'INTC', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 329 },
  { id: 'JPM', name: 'JPMorgan Chase & Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'JPM', spreadMarkup: 0.109, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 330 },
  { id: 'DIS', name: 'Walt Disney Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'DIS', spreadMarkup: 0.048, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 331 },
  { id: 'BABA', name: 'Alibaba Group', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'BABA', spreadMarkup: 0.046, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 332 },
  { id: 'ORCL', name: 'Oracle Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'ORCL', spreadMarkup: 0.086, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 333 },
  { id: 'CRM', name: 'Salesforce Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CRM', spreadMarkup: 0.1475, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 334 },
  { id: 'ADBE', name: 'Adobe Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'ADBE', spreadMarkup: 0.2525, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 335 },
  { id: 'CSCO', name: 'Cisco Systems', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CSCO', spreadMarkup: 0.027, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 336 },
  { id: 'QCOM', name: 'Qualcomm Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'QCOM', spreadMarkup: 0.084, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 337 },
  { id: 'TXN', name: 'Texas Instruments', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'TXN', spreadMarkup: 0.1025, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 338 },
  { id: 'AVGO', name: 'Broadcom Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'AVGO', spreadMarkup: 0.084, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 339 },
  { id: 'PYPL', name: 'PayPal Holdings', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'PYPL', spreadMarkup: 0.039, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 340 },
  { id: 'UBER', name: 'Uber Technologies', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'UBER', spreadMarkup: 0.036, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 341 },
  { id: 'LYFT', name: 'Lyft Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'LYFT', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 342 },
  { id: 'SNAP', name: 'Snap Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SNAP', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 343 },
  { id: 'PINS', name: 'Pinterest Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'PINS', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 344 },
  { id: 'SPOT', name: 'Spotify Technology', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SPOT', spreadMarkup: 0.185, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 345 },
  { id: 'ABNB', name: 'Airbnb Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'ABNB', spreadMarkup: 0.065, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 346 },
  { id: 'COIN', name: 'Coinbase Global', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'COIN', spreadMarkup: 0.1025, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 347 },
  { id: 'PLTR', name: 'Palantir Technologies', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'PLTR', spreadMarkup: 0.021, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 348 },
  { id: 'RBLX', name: 'Roblox Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'RBLX', spreadMarkup: 0.0225, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 349 },
  { id: 'SNOW', name: 'Snowflake Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SNOW', spreadMarkup: 0.059, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 350 },
  { id: 'NET', name: 'Cloudflare Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'NET', spreadMarkup: 0.041, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 351 },
  { id: 'DDOG', name: 'Datadog Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'DDOG', spreadMarkup: 0.06, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 352 },
  { id: 'CRWD', name: 'CrowdStrike Holdings', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CRWD', spreadMarkup: 0.145, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 353 },
  { id: 'SHOP', name: 'Shopify Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SHOP', spreadMarkup: 0.039, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 354 },
  { id: 'SQ', name: 'Block Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SQ', spreadMarkup: 0.036, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 355 },
  { id: 'F', name: 'Ford Motor Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'F', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 356 },
  { id: 'GM', name: 'General Motors', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'GM', spreadMarkup: 0.024, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 357 },
  { id: 'BA', name: 'Boeing Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'BA', spreadMarkup: 0.0775, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 358 },
  { id: 'CAT', name: 'Caterpillar Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CAT', spreadMarkup: 0.1925, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 359 },
  { id: 'DE', name: 'Deere & Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'DE', spreadMarkup: 0.2075, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 360 },
  { id: 'MMM', name: '3M Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MMM', spreadMarkup: 0.066, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 361 },
  { id: 'HON', name: 'Honeywell Intl.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'HON', spreadMarkup: 0.1075, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 362 },
  { id: 'UPS', name: 'United Parcel Service', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'UPS', spreadMarkup: 0.065, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 363 },
  { id: 'FDX', name: 'FedEx Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'FDX', spreadMarkup: 0.1425, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 364 },
  { id: 'WMT', name: 'Walmart Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'WMT', spreadMarkup: 0.041, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 365 },
  { id: 'TGT', name: 'Target Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'TGT', spreadMarkup: 0.075, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 366 },
  { id: 'COST', name: 'Costco Wholesale', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'COST', spreadMarkup: 0.4425, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 367 },
  { id: 'HD', name: 'Home Depot', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'HD', spreadMarkup: 0.2, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 368 },
  { id: 'LOW', name: 'Lowe’s Cos.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'LOW', spreadMarkup: 0.1275, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 369 },
  { id: 'NKE', name: 'Nike Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'NKE', spreadMarkup: 0.039, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 370 },
  { id: 'SBUX', name: 'Starbucks Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SBUX', spreadMarkup: 0.049, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 371 },
  { id: 'MCD', name: 'McDonald’s Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MCD', spreadMarkup: 0.1475, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 372 },
  { id: 'KO', name: 'Coca-Cola Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'KO', spreadMarkup: 0.034, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 373 },
  { id: 'PEP', name: 'PepsiCo Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'PEP', spreadMarkup: 0.084, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 374 },
  { id: 'PG', name: 'Procter & Gamble', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'PG', spreadMarkup: 0.084, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 375 },
  { id: 'JNJ', name: 'Johnson & Johnson', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'JNJ', spreadMarkup: 0.08, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 376 },
  { id: 'PFE', name: 'Pfizer Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'PFE', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 377 },
  { id: 'MRK', name: 'Merck & Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MRK', spreadMarkup: 0.051, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 378 },
  { id: 'ABBV', name: 'AbbVie Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'ABBV', spreadMarkup: 0.0975, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 379 },
  { id: 'LLY', name: 'Eli Lilly & Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'LLY', spreadMarkup: 0.4525, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 380 },
  { id: 'UNH', name: 'UnitedHealth Group', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'UNH', spreadMarkup: 0.29, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 381 },
  { id: 'CVS', name: 'CVS Health', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CVS', spreadMarkup: 0.029, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 382 },
  { id: 'MRNA', name: 'Moderna Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MRNA', spreadMarkup: 0.024, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 383 },
  { id: 'BAC', name: 'Bank of America', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'BAC', spreadMarkup: 0.021, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 384 },
  { id: 'WFC', name: 'Wells Fargo & Co.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'WFC', spreadMarkup: 0.034, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 385 },
  { id: 'C', name: 'Citigroup Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'C', spreadMarkup: 0.033, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 386 },
  { id: 'GS', name: 'Goldman Sachs', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'GS', spreadMarkup: 0.255, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 387 },
  { id: 'MS', name: 'Morgan Stanley', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MS', spreadMarkup: 0.055, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 388 },
  { id: 'V', name: 'Visa Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'V', spreadMarkup: 0.1425, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 389 },
  { id: 'MA', name: 'Mastercard Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MA', spreadMarkup: 0.245, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 390 },
  { id: 'AXP', name: 'American Express', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'AXP', spreadMarkup: 0.135, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 391 },
  { id: 'BLK', name: 'BlackRock Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'BLK', spreadMarkup: 0.4925, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 392 },
  { id: 'XOM', name: 'Exxon Mobil', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'XOM', spreadMarkup: 0.059, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 393 },
  { id: 'CVX', name: 'Chevron Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CVX', spreadMarkup: 0.075, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 394 },
  { id: 'COP', name: 'ConocoPhillips', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'COP', spreadMarkup: 0.054, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 395 },
  { id: 'SLB', name: 'Schlumberger', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SLB', spreadMarkup: 0.021, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 396 },
  { id: 'T', name: 'AT&T Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'T', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 397 },
  { id: 'VZ', name: 'Verizon Communications', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'VZ', spreadMarkup: 0.022, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 398 },
  { id: 'TMUS', name: 'T-Mobile US', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'TMUS', spreadMarkup: 0.1025, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 399 },
  { id: 'CMCSA', name: 'Comcast Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CMCSA', spreadMarkup: 0.021, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 400 },
  { id: 'WBD', name: 'Warner Bros Discovery', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'WBD', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 401 },
  { id: 'PARA', name: 'Paramount Global', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'PARA', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 402 },
  { id: 'GE', name: 'General Electric', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'GE', spreadMarkup: 0.0925, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 403 },
  { id: 'RTX', name: 'RTX Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'RTX', spreadMarkup: 0.061, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 404 },
  { id: 'LMT', name: 'Lockheed Martin', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'LMT', spreadMarkup: 0.2875, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 405 },
  { id: 'NOC', name: 'Northrop Grumman', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'NOC', spreadMarkup: 0.26, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 406 },
  { id: 'GD', name: 'General Dynamics', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'GD', spreadMarkup: 0.1475, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 407 },
  { id: 'AAL', name: 'American Airlines', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'AAL', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 408 },
  { id: 'DAL', name: 'Delta Air Lines', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'DAL', spreadMarkup: 0.026, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 409 },
  { id: 'UAL', name: 'United Airlines', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'UAL', spreadMarkup: 0.029, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 410 },
  { id: 'CCL', name: 'Carnival Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CCL', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 411 },
  { id: 'GME', name: 'GameStop Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'GME', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 412 },
  { id: 'AMC', name: 'AMC Entertainment', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'AMC', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 413 },
  { id: 'CRON', name: 'Cronos Group', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CRON', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 414 },
  { id: 'MCO', name: 'Moody’s Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MCO', spreadMarkup: 0.2325, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 415 },
  { id: 'NEM', name: 'Newmont Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'NEM', spreadMarkup: 0.024, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 416 },
  { id: 'FCX', name: 'Freeport-McMoRan', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'FCX', spreadMarkup: 0.0225, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 417 },
  { id: 'GILD', name: 'Gilead Sciences', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'GILD', spreadMarkup: 0.0425, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 418 },
  { id: 'AMGN', name: 'Amgen Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'AMGN', spreadMarkup: 0.16, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 419 },
  { id: 'BMY', name: 'Bristol-Myers Squibb', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'BMY', spreadMarkup: 0.026, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 420 },
  { id: 'TMO', name: 'Thermo Fisher', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'TMO', spreadMarkup: 0.29, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 421 },
  { id: 'DHR', name: 'Danaher Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'DHR', spreadMarkup: 0.1225, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 422 },
  { id: 'LIN', name: 'Linde plc', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'LIN', spreadMarkup: 0.23, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 423 },
  { id: 'IBM', name: 'IBM Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'IBM', spreadMarkup: 0.1075, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 424 },
  { id: 'NOW', name: 'ServiceNow Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'NOW', spreadMarkup: 0.4625, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 425 },
  { id: 'INTU', name: 'Intuit Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'INTU', spreadMarkup: 0.315, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 426 },
  { id: 'MU', name: 'Micron Technology', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MU', spreadMarkup: 0.0525, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 427 },
  { id: 'AMAT', name: 'Applied Materials', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'AMAT', spreadMarkup: 0.0975, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 428 },
  { id: 'LRCX', name: 'Lam Research', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'LRCX', spreadMarkup: 0.0375, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 429 },
  { id: 'ADI', name: 'Analog Devices', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'ADI', spreadMarkup: 0.1125, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 430 },
  { id: 'KLAC', name: 'KLA Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'KLAC', spreadMarkup: 0.36, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 431 },
  { id: 'PANW', name: 'Palo Alto Networks', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'PANW', spreadMarkup: 0.1925, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 432 },
  { id: 'SNPS', name: 'Synopsys Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SNPS', spreadMarkup: 0.245, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 433 },
  { id: 'CDNS', name: 'Cadence Design', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CDNS', spreadMarkup: 0.15, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 434 },
  { id: 'WDAY', name: 'Workday Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'WDAY', spreadMarkup: 0.1225, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 435 },
  { id: 'TEAM', name: 'Atlassian Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'TEAM', spreadMarkup: 0.1075, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 436 },
  { id: 'ZS', name: 'Zscaler Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'ZS', spreadMarkup: 0.0975, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 437 },
  { id: 'OKTA', name: 'Okta Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'OKTA', spreadMarkup: 0.044, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 438 },
  { id: 'TWLO', name: 'Twilio Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'TWLO', spreadMarkup: 0.049, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 439 },
  { id: 'DOCU', name: 'DocuSign Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'DOCU', spreadMarkup: 0.031, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 440 },
  { id: 'ROKU', name: 'Roku Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'ROKU', spreadMarkup: 0.036, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 441 },
  { id: 'DASH', name: 'DoorDash Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'DASH', spreadMarkup: 0.0825, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 442 },
  { id: 'ZM', name: 'Zoom Video', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'ZM', spreadMarkup: 0.036, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 443 },
  { id: 'MARA', name: 'Marathon Digital', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MARA', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 444 },
  { id: 'RIOT', name: 'Riot Platforms', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'RIOT', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 445 },
  { id: 'MSTR', name: 'MicroStrategy', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MSTR', spreadMarkup: 0.0975, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 446 },
  { id: 'HOOD', name: 'Robinhood Markets', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'HOOD', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 447 },
  { id: 'SOFI', name: 'SoFi Technologies', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SOFI', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 448 },
  { id: 'AFRM', name: 'Affirm Holdings', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'AFRM', spreadMarkup: 0.021, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 449 },
  { id: 'RIVN', name: 'Rivian Automotive', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'RIVN', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 450 },
  { id: 'LCID', name: 'Lucid Group', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'LCID', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 451 },
  { id: 'NIO', name: 'NIO Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'NIO', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 452 },
  { id: 'XPEV', name: 'XPeng Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'XPEV', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 453 },
  { id: 'LI', name: 'Li Auto Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'LI', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 454 },
  { id: 'PDD', name: 'PDD Holdings', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'PDD', spreadMarkup: 0.06, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 455 },
  { id: 'JD', name: 'JD.com Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'JD', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 456 },
  { id: 'BIDU', name: 'Baidu Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'BIDU', spreadMarkup: 0.046, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 457 },
  { id: 'NTES', name: 'NetEase Inc.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'NTES', spreadMarkup: 0.049, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 458 },
  { id: 'SE', name: 'Sea Ltd.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SE', spreadMarkup: 0.0475, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 459 },
  { id: 'ISRG', name: 'Intuitive Surgical', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'ISRG', spreadMarkup: 0.2525, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 460 },
  { id: 'REGN', name: 'Regeneron Pharma', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'REGN', spreadMarkup: 0.3775, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 461 },
  { id: 'VRTX', name: 'Vertex Pharma', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'VRTX', spreadMarkup: 0.2425, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 462 },
  { id: 'BKNG', name: 'Booking Holdings', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'BKNG', spreadMarkup: 2.425, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 463 },
  { id: 'CMG', name: 'Chipotle Mexican Grill', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CMG', spreadMarkup: 0.029, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 464 },
  { id: 'MNST', name: 'Monster Beverage', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MNST', spreadMarkup: 0.026, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 465 },
  { id: 'KHC', name: 'Kraft Heinz', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'KHC', spreadMarkup: 0.02, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 466 },
  { id: 'MDLZ', name: 'Mondelez Intl.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'MDLZ', spreadMarkup: 0.034, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 467 },
  { id: 'CL', name: 'Colgate-Palmolive', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CL', spreadMarkup: 0.049, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 468 },
  { id: 'KMB', name: 'Kimberly-Clark', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'KMB', spreadMarkup: 0.069, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 469 },
  { id: 'GIS', name: 'General Mills', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'GIS', spreadMarkup: 0.034, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 470 },
  { id: 'SYK', name: 'Stryker Corp.', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SYK', spreadMarkup: 0.1825, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 471 },
  { id: 'BDX', name: 'Becton Dickinson', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'BDX', spreadMarkup: 0.1175, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 472 },
  { id: 'CI', name: 'Cigna Group', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CI', spreadMarkup: 0.1725, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 473 },
  { id: 'ELV', name: 'Elevance Health', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'ELV', spreadMarkup: 0.2425, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 474 },
  { id: 'HCA', name: 'HCA Healthcare', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'HCA', spreadMarkup: 0.1725, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 475 },
  { id: 'SPGI', name: 'S&P Global', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SPGI', spreadMarkup: 0.2525, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 476 },
  { id: 'ICE', name: 'Intercontinental Exch', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'ICE', spreadMarkup: 0.079, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 477 },
  { id: 'CME', name: 'CME Group', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'CME', spreadMarkup: 0.1075, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 478 },
  { id: 'PNC', name: 'PNC Financial', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'PNC', spreadMarkup: 0.0925, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 479 },
  { id: 'USB', name: 'US Bancorp', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'USB', spreadMarkup: 0.023, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 480 },
  { id: 'TFC', name: 'Truist Financial', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'TFC', spreadMarkup: 0.022, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 481 },
  { id: 'SCHW', name: 'Charles Schwab', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'SCHW', spreadMarkup: 0.036, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 482 },
  { id: 'COF', name: 'Capital One', assetClass: 'stock', digits: 2, contractSize: 1, leverageMax: 10, feedSource: 'synthetic', feedSymbol: 'COF', spreadMarkup: 0.0775, swapLong: -0.5, swapShort: -0.3, maxLot: 500, sortOrder: 483 },
];

const RISK = [
  { tier: 'classic', minDeposit: 200, defaultLeverage: 100, maxLeverage: 400, spreadDiscountPct: 0 },
  { tier: 'silver', minDeposit: 5000, defaultLeverage: 100, maxLeverage: 400, spreadDiscountPct: 10 },
  { tier: 'gold', minDeposit: 25000, defaultLeverage: 100, maxLeverage: 400, spreadDiscountPct: 20 },
  { tier: 'platinum', minDeposit: 50000, defaultLeverage: 100, maxLeverage: 400, spreadDiscountPct: 30 },
  { tier: 'vip', minDeposit: 100000, defaultLeverage: 100, maxLeverage: 400, spreadDiscountPct: 40 },
] as const;

/**
 * Crypto: 24/7 (no rows = always open).
 * Stocks: the US cash session, Mon-Fri 13:30-20:00 UTC (single-stock CFDs follow the exchange).
 * FX, metals, commodities AND indices: near 24/5, Sun 22:00 -> Fri 22:00 UTC. Index CFDs trade almost
 * around the clock on weekdays, so a Tokyo / Hong Kong / Frankfurt index is not stuck to US hours.
 */
function sessionsFor(s: Sym): { weekday: number; openTime: string; closeTime: string }[] {
  if (s.assetClass === 'crypto') return [];
  if (s.assetClass === 'stock') {
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
      },
      update: { name: s.name, leverageMax: s.leverageMax, featured: s.featured ?? false, sortOrder: s.sortOrder ?? 100, feedSource: s.feedSource, feedSymbol: s.feedSymbol },
    });

    // Sessions are synced every seed so trading hours in code always win (e.g. re-seeding existing
    // symbols to widen index hours). Delete + recreate keeps it idempotent.
    await prisma.symbolSession.deleteMany({ where: { symbolId: s.id } });
    const rows = sessionsFor(s);
    if (rows.length) {
      await prisma.symbolSession.createMany({ data: rows.map((r) => ({ symbolId: s.id, ...r })) });
    }
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

