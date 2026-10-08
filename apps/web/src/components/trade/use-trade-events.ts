'use client';

import { useEffect, useRef } from 'react';
import { WS_EVENTS, type OrderDto, type PositionDto } from '@spova/shared';
import { useSocket } from '@/lib/ws';

/** position:closed carries the closed slice as well */
export type PositionEvent = PositionDto & { closedLots?: string; closedPnl?: string };

export interface TradeEventHandlers {
  onPositionOpened?: (p: PositionEvent) => void;
  onPositionUpdated?: (p: PositionEvent) => void;
  onPositionClosed?: (p: PositionEvent) => void;
  onOrderFilled?: (o: OrderDto) => void;
  onOrderCancelled?: (o: OrderDto) => void;
  onOrderRejected?: (o: OrderDto) => void;
}

/** All per-user trading lifecycle events on the shared socket (same pattern as useUserEvent, one subscription per event). */
export function useTradeEvents(h: TradeEventHandlers) {
  const { socket, connected } = useSocket();
  const ref = useRef(h);
  ref.current = h;
  useEffect(() => {
    if (!socket) return;
    const po = (p: PositionEvent) => ref.current.onPositionOpened?.(p);
    const pu = (p: PositionEvent) => ref.current.onPositionUpdated?.(p);
    const pc = (p: PositionEvent) => ref.current.onPositionClosed?.(p);
    const of = (o: OrderDto) => ref.current.onOrderFilled?.(o);
    const oc = (o: OrderDto) => ref.current.onOrderCancelled?.(o);
    const orj = (o: OrderDto) => ref.current.onOrderRejected?.(o);
    socket.on(WS_EVENTS.POSITION_OPENED, po);
    socket.on(WS_EVENTS.POSITION_UPDATED, pu);
    socket.on(WS_EVENTS.POSITION_CLOSED, pc);
    socket.on(WS_EVENTS.ORDER_FILLED, of);
    socket.on(WS_EVENTS.ORDER_CANCELLED, oc);
    socket.on(WS_EVENTS.ORDER_REJECTED, orj);
    return () => {
      socket.off(WS_EVENTS.POSITION_OPENED, po);
      socket.off(WS_EVENTS.POSITION_UPDATED, pu);
      socket.off(WS_EVENTS.POSITION_CLOSED, pc);
      socket.off(WS_EVENTS.ORDER_FILLED, of);
      socket.off(WS_EVENTS.ORDER_CANCELLED, oc);
      socket.off(WS_EVENTS.ORDER_REJECTED, orj);
    };
  }, [socket]);
  return { socket, connected };
}
