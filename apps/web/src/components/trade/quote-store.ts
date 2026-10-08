'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { isStale, type PriceBook, type Quote, type WsTick } from '@spova/shared';

/** One instrument's live state. Replaced (never mutated) on every change so React can compare by identity. */
export interface LiveQuote extends Quote {
  s: string;
  /** direction of the last bid change */
  dir: 'up' | 'down' | 'flat';
  /** quote older than QUOTE_MAX_AGE_MS */
  stale: boolean;
  /** market session open (from GET /market/quotes); undefined until the first poll */
  open?: boolean;
  /** first mid seen this session, or the previous daily close when known: base of the % change */
  ref: number | null;
  /** count of updates, lets rows restart their flash animation */
  n: number;
}

type Listener = () => void;

/**
 * Tick store outside React. Up to 4 ticks/s x 30 symbols would thrash a single useState; here every
 * subscriber listens to one symbol and re-renders only when that symbol changes.
 */
class QuoteStore {
  private quotes = new Map<string, LiveQuote>();
  private listeners = new Map<string, Set<Listener>>();
  private all = new Set<Listener>();
  private version = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  private emit(s: string) {
    this.version++;
    this.listeners.get(s)?.forEach((l) => l());
    this.all.forEach((l) => l());
  }

  get(s: string) {
    return this.quotes.get(s);
  }

  /** Plain {bid, ask, ts} book of fresh quotes for conversion math (toUsd). */
  book(): PriceBook {
    const b: PriceBook = {};
    const now = Date.now();
    this.quotes.forEach((q, s) => {
      if (!isStale(q, now)) b[s] = { bid: q.bid, ask: q.ask, ts: q.ts };
    });
    return b;
  }

  tick(t: WsTick) {
    if (!t.bid || !t.ask) return;
    const prev = this.quotes.get(t.s);
    const bid = Number(t.bid);
    const dir: LiveQuote['dir'] = !prev ? 'flat' : bid > Number(prev.bid) ? 'up' : bid < Number(prev.bid) ? 'down' : prev.dir;
    const mid = (bid + Number(t.ask)) / 2;
    this.quotes.set(t.s, { s: t.s, bid: t.bid, ask: t.ask, ts: t.ts, dir, stale: isStale(t), open: prev?.open, ref: prev?.ref ?? mid, n: (prev?.n ?? 0) + 1 });
    this.emit(t.s);
  }

  /** Seed from a REST quote (GET /market/quotes). Keeps the live tick when it is newer. */
  seed(s: string, q: { bid: string; ask: string; ts: number; open?: boolean }) {
    const prev = this.quotes.get(s);
    const hasPrice = !!q.bid && !!q.ask;
    if (prev && (!hasPrice || prev.ts >= q.ts)) {
      if (q.open !== undefined && q.open !== prev.open) {
        this.quotes.set(s, { ...prev, open: q.open });
        this.emit(s);
      }
      return;
    }
    const mid = hasPrice ? (Number(q.bid) + Number(q.ask)) / 2 : null;
    this.quotes.set(s, { s, bid: q.bid, ask: q.ask, ts: q.ts, dir: 'flat', stale: isStale(hasPrice ? q : undefined), open: q.open ?? prev?.open, ref: prev?.ref ?? mid, n: (prev?.n ?? 0) + 1 });
    this.emit(s);
  }

  /** Base for the % change (previous daily close when the chart knows it). */
  setRef(s: string, ref: number) {
    const prev = this.quotes.get(s);
    if (!prev || prev.ref === ref) return;
    this.quotes.set(s, { ...prev, ref });
    this.emit(s);
  }

  subscribe(s: string, l: Listener) {
    if (!this.listeners.has(s)) this.listeners.set(s, new Set());
    this.listeners.get(s)!.add(l);
    this.ensureTimer();
    return () => {
      this.listeners.get(s)?.delete(l);
    };
  }

  subscribeAll(l: Listener) {
    this.all.add(l);
    this.ensureTimer();
    return () => {
      this.all.delete(l);
    };
  }

  getVersion() {
    return this.version;
  }

  /** Once a second, flip quotes that aged past the freshness window (no tick arrives to tell us). */
  private ensureTimer() {
    if (this.timer || typeof window === 'undefined') return;
    this.timer = setInterval(() => {
      const now = Date.now();
      this.quotes.forEach((q, s) => {
        const stale = isStale(q, now);
        if (stale !== q.stale) {
          this.quotes.set(s, { ...q, stale });
          this.emit(s);
        }
      });
    }, 1000);
  }
}

export const quoteStore = new QuoteStore();

/** Live quote for one symbol; re-renders only on that symbol's changes. */
export function useQuote(symbol: string | null | undefined): LiveQuote | undefined {
  const sub = useCallback((l: Listener) => (symbol ? quoteStore.subscribe(symbol, l) : () => {}), [symbol]);
  const get = useCallback(() => (symbol ? quoteStore.get(symbol) : undefined), [symbol]);
  return useSyncExternalStore(sub, get, get);
}

/** Version counter that bumps on any tick: for panels that recompute across many symbols (positions table, margin preview). */
export function useBookVersion() {
  return useSyncExternalStore(
    (l) => quoteStore.subscribeAll(l),
    () => quoteStore.getVersion(),
    () => 0,
  );
}
