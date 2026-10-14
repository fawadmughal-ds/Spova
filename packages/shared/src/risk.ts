import Decimal from 'decimal.js';

/**
 * Pure risk / pricing math (ARCHITECTURE §08). Used by the API (execution), the worker (risk loop)
 * and the web (margin preview) so all three agree to the cent. No I/O here.
 */
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

export type Dec = Decimal;
export const dec = (v: Decimal.Value | null | undefined): Decimal => new Decimal(v === null || v === undefined || v === '' ? 0 : v.toString());

import { TIMEFRAMES, type Timeframe } from './enums';
/** Nominal bucket length in seconds (w1/mn1 are calendar-based; mn1 uses 30 days as a sizing hint). */
export const TF_SECONDS: Record<Timeframe, number> = { m1: 60, m5: 300, m15: 900, m30: 1800, h1: 3600, h4: 14400, d1: 86400, w1: 604800, mn1: 2592000 };
/** Binance kline interval names. */
export const TF_LABEL: Record<Timeframe, string> = { m1: '1m', m5: '5m', m15: '15m', m30: '30m', h1: '1h', h4: '4h', d1: '1d', w1: '1w', mn1: '1M' };
/** Human labels for menus. */
export const TF_NAME: Record<Timeframe, string> = { m1: 'M1', m5: 'M5', m15: 'M15', m30: 'M30', h1: 'H1', h4: 'H4', d1: 'D1', w1: 'W1', mn1: 'MN1' };

const DAY = 86400;
/** Bucket start (unix seconds) for a timestamp in ms. Weeks start Monday 00:00 UTC, months on the 1st 00:00 UTC. */
export function bucketStart(tsMs: number, tf: Timeframe): number {
  const s = Math.floor(tsMs / 1000);
  if (tf === 'w1') {
    // 1970-01-01 was a Thursday; shift by 3 days so Monday is the bucket boundary
    return Math.floor((s + 3 * DAY) / (7 * DAY)) * 7 * DAY - 3 * DAY;
  }
  if (tf === 'mn1') {
    const d = new Date(s * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
  }
  return Math.floor(s / TF_SECONDS[tf]) * TF_SECONDS[tf];
}
/** Start of the bucket `n` steps after (n<0: before) the bucket starting at `t` (unix seconds). */
export function bucketShift(t: number, tf: Timeframe, n: number): number {
  if (tf === 'mn1') {
    const d = new Date(t * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1) / 1000;
  }
  return t + n * TF_SECONDS[tf];
}
/** End (exclusive) of the bucket starting at `t`. */
export const bucketEnd = (t: number, tf: Timeframe) => bucketShift(t, tf, 1);

export interface Quote {
  bid: string;
  ask: string;
  ts: number;
}
export type PriceBook = Record<string, Quote | undefined>;

/** Max age of a quote before trading on it is refused. */
export const QUOTE_MAX_AGE_MS = 10_000;
export const isStale = (q: Quote | undefined, now = Date.now()) => !q || now - q.ts > QUOTE_MAX_AGE_MS;

const QUOTE_CCY_OVERRIDES: Record<string, string> = { DE40: 'EUR', UK100: 'GBP', XAUEUR: 'EUR', XAGEUR: 'EUR' };

/** Currency the instrument is quoted in (what raw P/L comes out as). Forex pairs: the counter currency. */
export function quoteCurrency(symbolId: string, assetClass: string): string {
  if (QUOTE_CCY_OVERRIDES[symbolId]) return QUOTE_CCY_OVERRIDES[symbolId];
  if (assetClass === 'forex' && symbolId.length === 6) return symbolId.slice(3, 6);
  return 'USD';
}

/** Mid price of a quote. */
export const mid = (q: Quote) => dec(q.bid).plus(q.ask).div(2);

/**
 * Convert an amount in `ccy` to USD through the USD pair in the book (EURUSD for EUR, USDJPY for JPY).
 * Returns null when the pair is missing; callers must refuse to trade rather than guess.
 */
export function toUsd(amount: Decimal, ccy: string, book: PriceBook): Decimal | null {
  if (ccy === 'USD') return amount;
  const direct = book[`${ccy}USD`];
  if (direct) return amount.times(mid(direct));
  const inverse = book[`USD${ccy}`];
  if (inverse) return amount.div(mid(inverse));
  return null;
}

export const effectiveLeverage = (accountLeverage: number, symbolLeverageMax: number) => Math.max(1, Math.min(accountLeverage, symbolLeverageMax));

/** notional (quote currency) = lots x contract_size x price */
export const notional = (lots: Decimal.Value, contractSize: Decimal.Value, price: Decimal.Value) => dec(lots).times(contractSize).times(price);

/** required margin in USD, or null if the quote currency cannot be converted. */
export function requiredMarginUsd(p: { lots: Decimal.Value; contractSize: Decimal.Value; price: Decimal.Value; leverage: number; quoteCcy: string; book: PriceBook }): Decimal | null {
  const n = toUsd(notional(p.lots, p.contractSize, p.price), p.quoteCcy, p.book);
  return n ? n.div(p.leverage) : null;
}

/** floating P/L in the quote currency: buy closes at bid, sell at ask. */
export function floatingPnl(p: { side: 'buy' | 'sell'; openPrice: Decimal.Value; lots: Decimal.Value; contractSize: Decimal.Value; bid: Decimal.Value; ask: Decimal.Value }): Decimal {
  const closeAt = p.side === 'buy' ? dec(p.bid) : dec(p.ask);
  const diff = p.side === 'buy' ? closeAt.minus(p.openPrice) : dec(p.openPrice).minus(closeAt);
  return diff.times(p.lots).times(p.contractSize);
}

/** Price the position would close at right now. */
export const closePriceFor = (side: 'buy' | 'sell', q: Quote) => (side === 'buy' ? dec(q.bid) : dec(q.ask));

export interface AccountMath {
  equity: Decimal;
  usedMargin: Decimal;
  freeMargin: Decimal;
  marginLevel: Decimal | null;
}

/** equity = balance + credit + sum(floating); used = sum(margin_used); level = equity / used x 100 */
/**
 * Hedged used margin (full-offset / MT4 classic): opposite positions on the same symbol net out, so per
 * symbol the required margin is only the margin of the UNHEDGED remainder — the absolute difference between
 * total buy-side and total sell-side margin. A perfectly hedged pair (equal buy + sell) uses ZERO margin;
 * closing one leg immediately re-applies the full margin of the side left open.
 */
export function hedgedUsedMargin(positions: { symbol: string; side: 'buy' | 'sell'; marginUsed: Decimal.Value }[]): Decimal {
  const bySymbol = new Map<string, { buy: Decimal; sell: Decimal }>();
  for (const p of positions) {
    const e = bySymbol.get(p.symbol) ?? { buy: dec(0), sell: dec(0) };
    if (p.side === 'buy') e.buy = e.buy.plus(p.marginUsed);
    else e.sell = e.sell.plus(p.marginUsed);
    bySymbol.set(p.symbol, e);
  }
  let used = dec(0);
  for (const e of bySymbol.values()) used = used.plus(e.buy.minus(e.sell).abs());
  return used;
}

export function accountMath(balance: Decimal.Value, credit: Decimal.Value, positions: { symbol: string; side: 'buy' | 'sell'; marginUsed: Decimal.Value; floatingUsd: Decimal }[]): AccountMath {
  const floating = positions.reduce((a, p) => a.plus(p.floatingUsd), dec(0));
  const usedMargin = hedgedUsedMargin(positions);
  const equity = dec(balance).plus(credit).plus(floating);
  return { equity, usedMargin, freeMargin: equity.minus(usedMargin), marginLevel: usedMargin.gt(0) ? equity.div(usedMargin).times(100) : null };
}

/** SL/TP hit checks (buy exits at bid, sell at ask). */
export function slHit(side: 'buy' | 'sell', sl: Decimal.Value | null | undefined, q: Quote) {
  if (sl === null || sl === undefined) return false;
  return side === 'buy' ? dec(q.bid).lte(sl) : dec(q.ask).gte(sl);
}
export function tpHit(side: 'buy' | 'sell', tp: Decimal.Value | null | undefined, q: Quote) {
  if (tp === null || tp === undefined) return false;
  return side === 'buy' ? dec(q.bid).gte(tp) : dec(q.ask).lte(tp);
}

/** Pending-order trigger: limit buy when ask <= price, limit sell when bid >= price, stop buy when ask >= price, stop sell when bid <= price. */
export function orderTriggered(o: { type: 'limit' | 'stop'; side: 'buy' | 'sell'; price: Decimal.Value }, q: Quote) {
  const ask = dec(q.ask);
  const bid = dec(q.bid);
  if (o.type === 'limit') return o.side === 'buy' ? ask.lte(o.price) : bid.gte(o.price);
  return o.side === 'buy' ? ask.gte(o.price) : bid.lte(o.price);
}

/** Entry price for a fill: buy at ask, sell at bid. */
export const fillPrice = (side: 'buy' | 'sell', q: Quote) => (side === 'buy' ? dec(q.ask) : dec(q.bid));

/** SL must sit on the losing side of the reference price, TP on the winning side. Returns an error message or null. */
export function validateSlTp(side: 'buy' | 'sell', ref: Decimal.Value, sl?: Decimal.Value | null, tp?: Decimal.Value | null): string | null {
  const r = dec(ref);
  if (sl !== null && sl !== undefined) {
    if (side === 'buy' && !dec(sl).lt(r)) return 'Stop loss must be below the price for a buy';
    if (side === 'sell' && !dec(sl).gt(r)) return 'Stop loss must be above the price for a sell';
  }
  if (tp !== null && tp !== undefined) {
    if (side === 'buy' && !dec(tp).gt(r)) return 'Take profit must be above the price for a buy';
    if (side === 'sell' && !dec(tp).lt(r)) return 'Take profit must be below the price for a sell';
  }
  return null;
}

/** Lots must be within [min, max] and on the step grid. */
export function validateLots(lots: Decimal.Value, min: Decimal.Value, max: Decimal.Value, step: Decimal.Value): string | null {
  const l = dec(lots);
  if (!l.isFinite() || l.lte(0)) return 'Volume must be positive';
  if (l.lt(min)) return `Minimum volume is ${dec(min).toString()} lots`;
  if (l.gt(max)) return `Maximum volume is ${dec(max).toString()} lots`;
  if (!l.div(step).minus(l.div(step).round()).abs().lt(1e-9)) return `Volume must be a multiple of ${dec(step).toString()} lots`;
  return null;
}

/** Nightly swap for one position in USD terms as stored (rates are per lot per night; x3 on Wednesday). */
export function swapFor(lots: Decimal.Value, side: 'buy' | 'sell', swapLong: Decimal.Value, swapShort: Decimal.Value, date: Date) {
  const nights = date.getUTCDay() === 3 ? 3 : 1;
  return dec(lots).times(side === 'buy' ? swapLong : swapShort).times(nights);
}

/** Worst position first for stop-out: most negative floating P/L. */
export function worstPosition<T extends { floatingUsd: Decimal }>(positions: T[]): T | undefined {
  return [...positions].sort((a, b) => a.floatingUsd.comparedTo(b.floatingUsd))[0];
}

/** Round to the symbol's digits for display / storage. */
export const roundPrice = (v: Decimal.Value, digits: number) => dec(v).toDecimalPlaces(digits, Decimal.ROUND_HALF_EVEN);
export const money2 = (v: Decimal.Value) => dec(v).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toFixed(2);
