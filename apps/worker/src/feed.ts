/**
 * Price feed adapter contract (ARCHITECTURE §08).
 * Phase 3 implements BinanceFeed (bookTicker WS) and SyntheticFeed (labelled DEMO FEED for FX until a paid key exists).
 */
export interface Tick {
  symbol: string; // our symbol id, e.g. BTCUSD
  bid: string;
  ask: string;
  ts: number;
}

export interface FeedAdapter {
  readonly name: string;
  /** feedSymbol -> our symbol id */
  connect(map: Record<string, string>, onTick: (t: Tick) => void): Promise<void>;
  disconnect(): Promise<void>;
}
