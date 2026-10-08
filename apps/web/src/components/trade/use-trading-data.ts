'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderDto, PositionDto } from '@spova/shared';
import { get } from '@/lib/api';
import { useToast } from '@/components/toast';
import { fmtSigned } from './format';
import { useTradeEvents, type PositionEvent } from './use-trade-events';

export const CLOSE_REASON_LABEL: Record<string, string> = {
  user: 'Closed by you',
  sl: 'Stop loss hit',
  tp: 'Take profit hit',
  stopout: 'Stop-out',
  admin: 'Closed by the broker',
  expiry: 'Expired',
};

export interface TradingData {
  positions: PositionDto[] | null;
  orders: OrderDto[] | null;
  history: PositionDto[] | null;
  error: string | null;
  reload: () => Promise<void>;
  loadHistory: () => Promise<void>;
  /** Merge a position returned by a REST mutation (open rows); closed ones move to history. */
  upsertPosition: (p: PositionDto) => void;
  addOrder: (o: OrderDto) => void;
  removeOrder: (id: string) => void;
  /** Remember that we caused the next lifecycle event on this id, so it is not toasted twice. */
  markOwn: (id: string) => void;
}

const OWN_TTL_MS = 8000;
const side = (s: 'buy' | 'sell') => (s === 'buy' ? 'Buy' : 'Sell');

/**
 * Open positions, pending orders and closed history for one account. REST on account change, then kept
 * in sync by the per-user position/order events. Engine-driven changes (SL/TP hits, fills, stop-outs) are
 * toasted here; changes the user made from the terminal are toasted by the panel that made them.
 */
export function useTradingData(accountId: string | null): TradingData {
  const toast = useToast();
  const [positions, setPositions] = useState<PositionDto[] | null>(null);
  const [orders, setOrders] = useState<OrderDto[] | null>(null);
  const [history, setHistory] = useState<PositionDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const own = useRef(new Map<string, number>());
  const acc = useRef(accountId);
  acc.current = accountId;

  const markOwn = useCallback((id: string) => {
    own.current.set(id, Date.now());
  }, []);
  const isOwn = (id: string) => {
    const t = own.current.get(id);
    if (t === undefined) return false;
    if (Date.now() - t > OWN_TTL_MS) {
      own.current.delete(id);
      return false;
    }
    return true;
  };

  const reload = useCallback(async () => {
    const id = acc.current;
    if (!id) return;
    setError(null);
    try {
      const [p, o] = await Promise.all([get<PositionDto[]>(`/me/accounts/${id}/positions?status=open`), get<OrderDto[]>(`/me/accounts/${id}/orders?status=pending`)]);
      if (acc.current !== id) return;
      setPositions(p);
      setOrders(o);
    } catch (e) {
      if (acc.current === id) setError((e as Error).message || 'Could not load positions');
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const id = acc.current;
    if (!id) return;
    try {
      const h = await get<PositionDto[]>(`/me/accounts/${id}/positions?status=closed`);
      if (acc.current === id) setHistory(h);
    } catch {
      if (acc.current === id) setHistory((h) => h ?? []);
    }
  }, []);

  useEffect(() => {
    setPositions(null);
    setOrders(null);
    setHistory(null);
    if (accountId) void reload();
  }, [accountId, reload]);

  const upsertPosition = useCallback((p: PositionDto) => {
    if (p.accountId !== acc.current) return;
    if (p.status === 'open') {
      setPositions((xs) => {
        if (!xs) return [p];
        const i = xs.findIndex((x) => x.id === p.id);
        if (i === -1) return [p, ...xs];
        const next = xs.slice();
        next[i] = p;
        return next;
      });
    } else {
      setPositions((xs) => (xs ? xs.filter((x) => x.id !== p.id) : xs));
      setHistory((h) => (h ? [p, ...h.filter((x) => x.id !== p.id)] : h));
    }
  }, []);

  const addOrder = useCallback((o: OrderDto) => {
    if (o.accountId !== acc.current || o.status !== 'pending') return;
    setOrders((xs) => (xs ? [o, ...xs.filter((x) => x.id !== o.id)] : [o]));
  }, []);
  const removeOrder = useCallback((id: string) => {
    setOrders((xs) => (xs ? xs.filter((x) => x.id !== id) : xs));
  }, []);

  useTradeEvents({
    onPositionOpened: (p: PositionEvent) => upsertPosition(p),
    onPositionUpdated: (p: PositionEvent) => {
      upsertPosition(p);
      if (p.accountId !== acc.current || isOwn(p.id)) return;
      if (p.closedLots) {
        toast({ level: 'info', title: `${p.symbol}: ${p.closedLots} lots closed`, body: `P/L ${fmtSigned(p.closedPnl)} USD · ${p.lots} lots remain open.` });
      }
    },
    onPositionClosed: (p: PositionEvent) => {
      upsertPosition({ ...p, status: 'closed' });
      if (p.accountId !== acc.current || isOwn(p.id)) return;
      const pnl = Number(p.closedPnl ?? p.realizedPnl ?? 0);
      const why = p.closeReason ? CLOSE_REASON_LABEL[p.closeReason] ?? p.closeReason : 'Closed';
      toast({
        level: p.closeReason === 'stopout' ? 'danger' : pnl >= 0 ? 'success' : 'warning',
        title: `${why}: ${side(p.side)} ${p.closedLots ?? p.lots} ${p.symbol}`,
        body: `Closed at ${p.closePrice ?? '—'} · P/L ${fmtSigned(p.closedPnl ?? p.realizedPnl)} USD`,
      });
    },
    onOrderFilled: (o) => {
      removeOrder(o.id);
      // market fills are toasted by the ticket that placed them (the event can beat the REST reply)
      if (o.accountId !== acc.current || o.type === 'market' || isOwn(o.id)) return;
      toast({ level: 'success', title: `${side(o.side)} ${o.type} filled`, body: `${o.lots} ${o.symbol} at ${o.filledPrice ?? '—'}` });
    },
    onOrderCancelled: (o) => {
      removeOrder(o.id);
      if (o.accountId !== acc.current || isOwn(o.id)) return;
      toast({ level: 'info', title: 'Order cancelled', body: `${side(o.side)} ${o.type} ${o.lots} ${o.symbol}` });
    },
    onOrderRejected: (o) => {
      removeOrder(o.id);
      if (o.accountId !== acc.current) return;
      toast({ level: 'danger', title: `Order rejected: ${side(o.side)} ${o.type} ${o.lots} ${o.symbol}`, body: o.rejectReason ?? 'The order could not be filled.' });
    },
  });

  return { positions, orders, history, error, reload, loadHistory, upsertPosition, addOrder, removeOrder, markOwn };
}
