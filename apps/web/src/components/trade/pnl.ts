'use client';

import { useMemo } from 'react';
import { dec, floatingPnl, quoteCurrency, toUsd, type AccountDto, type PositionDto } from '@spova/shared';
import type { SymbolSpec } from './format';
import { quoteStore, useBookVersion, type LiveQuote } from './quote-store';

/** Live close price + floating P/L in USD; falls back to the server's last figures when the store cannot value it. */
export function livePnl(p: PositionDto, spec: SymbolSpec | undefined, q: LiveQuote | undefined): { price: string | null; pnl: number | null; live: boolean } {
  const fallback = { price: p.currentPrice, pnl: p.floatingPnl === null ? null : Number(p.floatingPnl), live: false };
  if (!spec || !q || !q.bid || !q.ask || q.stale) return fallback;
  const raw = floatingPnl({ side: p.side, openPrice: p.openPrice, lots: p.lots, contractSize: spec.contractSize, bid: q.bid, ask: q.ask });
  const usd = toUsd(raw, quoteCurrency(spec.id, spec.assetClass), quoteStore.book());
  if (!usd) return fallback;
  return { price: p.side === 'buy' ? q.bid : q.ask, pnl: usd.toNumber(), live: true };
}

/** Sum of live floating P/L (null when no position could be valued). */
export function sumPnl(positions: PositionDto[], symbols: Map<string, SymbolSpec>, filter?: (p: PositionDto) => boolean) {
  let sum = 0;
  let known = 0;
  for (const p of positions) {
    if (filter && !filter(p)) continue;
    const { pnl } = livePnl(p, symbols.get(p.symbol), quoteStore.get(p.symbol));
    if (pnl !== null) {
      sum += pnl;
      known++;
    }
  }
  return known ? sum : null;
}

/** Live total that re-renders on every tick. */
export function useFloatingTotal(positions: PositionDto[], symbols: Map<string, SymbolSpec>, filter?: (p: PositionDto) => boolean) {
  useBookVersion();
  return sumPnl(positions, symbols, filter);
}

export const conversionPairs = (spec: SymbolSpec | undefined): [string | null, string | null] => {
  if (!spec) return [null, null];
  const ccy = quoteCurrency(spec.id, spec.assetClass);
  return ccy === 'USD' ? [null, null] : [`${ccy}USD`, `USD${ccy}`];
};

/**
 * Account with equity / free margin / margin level recomputed LIVE from the floating P/L, so they track
 * price ticks instead of waiting for the next server snapshot (fixes "equity stuck while profit moves").
 */
export function useLiveAccount(account: AccountDto | undefined, positions: PositionDto[], symbols: Map<string, SymbolSpec>): AccountDto | undefined {
  const total = useFloatingTotal(positions, symbols);
  return useMemo(() => {
    if (!account || total === null) return account;
    const equity = dec(account.balance).plus(account.credit || 0).plus(total);
    const used = dec(account.usedMargin || 0);
    const freeMargin = equity.minus(used);
    const marginLevel = used.gt(0) ? equity.div(used).times(100) : null;
    return { ...account, equity: equity.toFixed(2), freeMargin: freeMargin.toFixed(2), marginLevel: marginLevel ? marginLevel.toFixed(2) : account.marginLevel };
  }, [account, total]);
}
