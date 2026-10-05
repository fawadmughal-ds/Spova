'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS_EVENTS, type WsAccountSnapshot, type WsNotice } from '@spova/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

let shared: Socket | null = null;
let refs = 0;

/** One shared socket per tab (namespace /ws, cookie auth). */
function acquire(): Socket {
  if (!shared) {
    shared = io(`${WS_URL}/ws`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
  }
  refs++;
  return shared;
}

function release() {
  refs--;
  if (refs <= 0 && shared) {
    shared.disconnect();
    shared = null;
    refs = 0;
  }
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const s = acquire();
    setSocket(s);
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    s.on('connect', on);
    s.on('disconnect', off);
    setConnected(s.connected);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
      release();
    };
  }, []);
  return { socket, connected };
}

/** Subscribe to live account snapshots (pushed on every ledger change, later on every tick). */
export function useAccountStream(onSnapshot: (s: WsAccountSnapshot) => void, onNotice?: (n: WsNotice) => void) {
  const { socket, connected } = useSocket();
  const cbS = useRef(onSnapshot);
  const cbN = useRef(onNotice);
  cbS.current = onSnapshot;
  cbN.current = onNotice;

  useEffect(() => {
    if (!socket) return;
    const hS = (s: WsAccountSnapshot) => cbS.current(s);
    const hN = (n: WsNotice) => cbN.current?.(n);
    socket.on(WS_EVENTS.ACCOUNT, hS);
    socket.on(WS_EVENTS.NOTICE, hN);
    return () => {
      socket.off(WS_EVENTS.ACCOUNT, hS);
      socket.off(WS_EVENTS.NOTICE, hN);
    };
  }, [socket]);

  return { connected };
}
