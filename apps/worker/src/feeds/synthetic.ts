import type { FeedAdapter, Tick } from '../feed';
import type { Logger } from '../logger';

/** Indicative starting levels (used only when Redis has no last price). These are DEMO instruments. */
export const SYNTHETIC_BASE: Record<string, number> = {
  EURUSD: 1.0842,
  GBPUSD: 1.2715,
  USDJPY: 149.32,
  AUDUSD: 0.6612,
  USDCAD: 1.3655,
  USDCHF: 0.8794,
  NZDUSD: 0.6051,
  EURGBP: 0.8528,
  EURJPY: 161.9,
  GBPJPY: 189.8,
  XAUUSD: 2648.5,
  XAGUSD: 31.24,
  USOIL: 71.4,
  UKOIL: 75.1,
  NATGAS: 2.85,
  US500: 5720,
  US100: 20150,
  US30: 42300,
  DE40: 19200,
  UK100: 8250,
  AAPL: 228,
  TSLA: 245,
  AMZN: 186,
  NVDA: 124,
  // indices (seed ids)
  SPX: 5720,
  NDX: 20150,
  DJI: 42300,
  DAX: 19200,
  FTSE: 8250,
  JP225: 39500,
  AUS200: 8100,
  HK50: 20500,
  FRA40: 7450,
  EU50: 4950,
  US2000: 2300,
  // crypto (realistic bases so the synthetic demo feed looks right where Binance is unavailable)
  BTCUSD: 83500,
  ETHUSD: 2530,
  LTCUSD: 95,
  XRPUSD: 0.52,
  SOLUSD: 180,
  BNBUSD: 600,
  ADAUSD: 0.45,
  DOGUSD: 0.12,
  DOTUSD: 5.5,
  AVAUSD: 28,
  LNKUSD: 13,
  TRXUSD: 0.16,
  // extra forex crosses
  AUDJPY: 98.7,
  EURCHF: 0.9536,
  GBPCHF: 1.118,
  CADJPY: 109.3,
  NZDJPY: 90.3,
  EURAUD: 1.64,
  GBPAUD: 1.922,
  AUDNZD: 1.093,
  EURCAD: 1.481,
  CHFJPY: 165.6,
  XPTUSD: 985,
  XPDUSD: 1040,
  COPPER: 4.15,
  WHEAT: 575,
  CORN: 425,
  COFFEE: 245,
};

/** Annualised volatility per asset class, scaled per tick with sqrt(dt). */
export const ANNUAL_VOL: Record<string, number> = {
  forex: 0.08,
  metal: 0.16,
  commodity: 0.32,
  index: 0.16,
  stock: 0.3,
  crypto: 0.6,
};
const SECONDS_PER_YEAR = 365 * 24 * 3600;

export interface SyntheticSymbolInfo {
  id: string;
  assetClass: string;
  digits: number;
  /** last known mid, e.g. from Redis */
  startPrice?: number;
}

export interface SyntheticFeedOptions {
  /** ms between ticks: uniform in [min,max] -> 1-3 ticks/s by default */
  minIntervalMs?: number;
  maxIntervalMs?: number;
  /** mean-reversion half-life (s) towards the anchor; weak so prices wander but never fly away */
  halfLifeSec?: number;
  rng?: () => number;
}

/** Box-Muller standard normal. */
export function gaussian(rng: () => number = Math.random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** One step of a mean-reverting (OU-style) log random walk. Exported for the candle backfill. */
export function stepPrice(p: { price: number; anchor: number; annualVol: number; dtSec: number; halfLifeSec: number }, rng: () => number = Math.random) {
  // discrete OU: the fraction of the gap to the anchor closed in one step is 1 - exp(-theta*dt), always in [0,1)
  const k = 1 - Math.exp(-(Math.LN2 / p.halfLifeSec) * p.dtSec);
  const sigma = p.annualVol * Math.sqrt(p.dtSec / SECONDS_PER_YEAR);
  const pull = k * Math.log(p.anchor / p.price);
  return p.price * Math.exp(pull + sigma * gaussian(rng));
}

interface State {
  info: SyntheticSymbolInfo;
  price: number;
  anchor: number;
  lastTs: number;
  timer?: NodeJS.Timeout;
}

/**
 * DEMO FEED: a mean-reverting random walk per symbol. Emits raw mid as bid=ask (our spread markup is added by Ingest).
 * Respects trading sessions through `isOpen` - a closed market emits nothing and resumes where it stopped.
 */
export class SyntheticFeed implements FeedAdapter {
  readonly name = 'synthetic';
  private states = new Map<string, State>();
  private onTick: (t: Tick) => void = () => {};
  private stopped = false;
  private readonly opts: Required<SyntheticFeedOptions>;

  constructor(
    private readonly log: Logger,
    private readonly infos: SyntheticSymbolInfo[],
    private readonly isOpen: (symbolId: string, now: Date) => boolean,
    opts: SyntheticFeedOptions = {},
  ) {
    this.opts = {
      minIntervalMs: opts.minIntervalMs ?? 333,
      maxIntervalMs: opts.maxIntervalMs ?? 1000,
      halfLifeSec: opts.halfLifeSec ?? 6 * 3600,
      rng: opts.rng ?? Math.random,
    };
  }

  async connect(map: Record<string, string>, onTick: (t: Tick) => void) {
    this.onTick = onTick;
    this.stopped = false;
    const wanted = new Set(Object.values(map));
    for (const info of this.infos) {
      if (!wanted.has(info.id)) continue;
      const base = SYNTHETIC_BASE[info.id] ?? info.startPrice ?? 100;
      const start = info.startPrice && info.startPrice > 0 ? info.startPrice : base;
      const st: State = { info, price: start, anchor: base, lastTs: Date.now() };
      this.states.set(info.id, st);
      this.schedule(st);
    }
    this.log.info({ symbols: this.states.size }, 'synthetic DEMO FEED started');
  }

  async disconnect() {
    this.stopped = true;
    for (const s of this.states.values()) if (s.timer) clearTimeout(s.timer);
    this.states.clear();
  }

  private schedule(st: State) {
    if (this.stopped) return;
    const { minIntervalMs, maxIntervalMs, rng } = this.opts;
    const delay = minIntervalMs + rng() * (maxIntervalMs - minIntervalMs);
    st.timer = setTimeout(() => this.tick(st), delay);
  }

  private tick(st: State) {
    if (this.stopped) return;
    const now = Date.now();
    if (this.isOpen(st.info.id, new Date(now))) {
      const dtSec = Math.min(5, Math.max(0.05, (now - st.lastTs) / 1000));
      st.price = stepPrice(
        { price: st.price, anchor: st.anchor, annualVol: ANNUAL_VOL[st.info.assetClass] ?? 0.2, dtSec, halfLifeSec: this.opts.halfLifeSec },
        this.opts.rng,
      );
      const px = st.price.toFixed(st.info.digits + 1); // one extra digit; Ingest rounds after markup
      this.onTick({ symbol: st.info.id, bid: px, ask: px, ts: now });
    }
    st.lastTs = now;
    this.schedule(st);
  }
}
