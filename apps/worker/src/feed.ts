/**
 * Price feed adapter contract (ARCHITECTURE §08).
 * BinanceFeed (bookTicker WS) for crypto, SyntheticFeed (DEMO FEED) for everything else until a paid key exists.
 * Feeds emit raw venue prices; `Ingest` applies our spread markup and fans the tick out.
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
