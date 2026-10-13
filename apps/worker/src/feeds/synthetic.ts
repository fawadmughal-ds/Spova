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
  EURNZD: 1.792,
  GBPNZD: 2.101,
  AUDCAD: 0.903,
  AUDCHF: 0.5816,
  NZDCAD: 0.826,
  NZDCHF: 0.532,
  CADCHF: 0.644,
  GBPCAD: 1.736,
  EURSEK: 11.42,
  EURNOK: 11.68,
  USDSEK: 10.53,
  USDNOK: 10.77,
  USDMXN: 17.12,
  USDZAR: 18.45,
  USDTRY: 34.15,
  USDSGD: 1.342,
  USDHKD: 7.81,
  USDPLN: 4.02,
  USDDKK: 6.87,
  USDCNH: 7.24,
  USDINR: 83.5,
  EURTRY: 37.0,
  EURPLN: 4.36,
  GBPSGD: 1.706,
  EURHUF: 392.0,
  USDTHB: 34.2,
  EURCZK: 25.3,
  USDCZK: 23.3,
  XAUUSD: 2648.5,
  XAGUSD: 31.24,
  XPTUSD: 985.0,
  XPDUSD: 1040.0,
  XAUEUR: 2442.0,
  XAGEUR: 28.8,
  USOIL: 71.4,
  UKOIL: 75.1,
  NATGAS: 2.85,
  COPPER: 4.15,
  WHEAT: 575.0,
  CORN: 425.0,
  COFFEE: 245.0,
  SUGAR: 0.22,
  COCOA: 7850.0,
  COTTON: 82.4,
  SOYBEAN: 1015.0,
  GASOLINE: 2.05,
  ALUMINIUM: 2420.0,
  NICKEL: 16800.0,
  ZINC: 2950.0,
  ORANGE: 385.0,
  US500: 5720.0,
  US100: 20150.0,
  US30: 42300.0,
  DE40: 19200.0,
  UK100: 8250.0,
  JP225: 39500.0,
  AUS200: 8100.0,
  HK50: 20500.0,
  FRA40: 7450.0,
  EU50: 4950.0,
  US2000: 2300.0,
  ES35: 11650.0,
  IT40: 33800.0,
  NL25: 895.0,
  CH20: 11950.0,
  SE30: 2560.0,
  IN50: 24500.0,
  CN50: 12800.0,
  SG30: 3620.0,
  KR200: 355.0,
  ZA40: 73500.0,
  BR50: 128500.0,
  MX35: 51800.0,
  JP400: 21800.0,
  VOL: 15.4,
  BTCUSD: 83500.0,
  ETHUSD: 2530.0,
  LTCUSD: 95.0,
  XRPUSD: 0.52,
  SOLUSD: 180.0,
  BNBUSD: 600.0,
  ADAUSD: 0.45,
  DOGUSD: 0.12,
  DOTUSD: 5.5,
  AVAUSD: 28.0,
  LNKUSD: 13.0,
  TRXUSD: 0.16,
  MATUSD: 0.52,
  ATMUSD: 6.4,
  UNIUSD: 8.1,
  ETCUSD: 22.5,
  FILUSD: 4.3,
  XLMUSD: 0.11,
  VETUSD: 0.028,
  ICPUSD: 9.2,
  APTUSD: 9.5,
  NERUSD: 4.8,
  AAVUSD: 152.0,
  SNDUSD: 0.31,
  MANUSD: 0.34,
  ALGUSD: 0.14,
  EOSUSD: 0.52,
  XTZUSD: 0.72,
  BCHUSD: 350.0,
  SHBUSD: 1.85e-05,
  AAPL: 228,
  MSFT: 415,
  AMZN: 186,
  NVDA: 124,
  GOOGL: 168,
  META: 565,
  TSLA: 245,
  NFLX: 700,
  AMD: 158,
  INTC: 23,
  JPM: 218,
  DIS: 96,
  BABA: 92,
  ORCL: 172,
  CRM: 295,
  ADBE: 505,
  CSCO: 54,
  QCOM: 168,
  TXN: 205,
  AVGO: 168,
  PYPL: 78,
  UBER: 72,
  LYFT: 14,
  SNAP: 11,
  PINS: 32,
  SPOT: 370,
  ABNB: 130,
  COIN: 205,
  PLTR: 42,
  RBLX: 45,
  SNOW: 118,
  NET: 82,
  DDOG: 120,
  CRWD: 290,
  SHOP: 78,
  SQ: 72,
  F: 11,
  GM: 48,
  BA: 155,
  CAT: 385,
  DE: 415,
  MMM: 132,
  HON: 215,
  UPS: 130,
  FDX: 285,
  WMT: 82,
  TGT: 150,
  COST: 885,
  HD: 400,
  LOW: 255,
  NKE: 78,
  SBUX: 98,
  MCD: 295,
  KO: 68,
  PEP: 168,
  PG: 168,
  JNJ: 160,
  PFE: 28,
  MRK: 102,
  ABBV: 195,
  LLY: 905,
  UNH: 580,
  CVS: 58,
  MRNA: 48,
  BAC: 42,
  WFC: 68,
  C: 66,
  GS: 510,
  MS: 110,
  V: 285,
  MA: 490,
  AXP: 270,
  BLK: 985,
  XOM: 118,
  CVX: 150,
  COP: 108,
  SLB: 42,
  T: 22,
  VZ: 44,
  TMUS: 205,
  CMCSA: 42,
  WBD: 8,
  PARA: 11,
  GE: 185,
  RTX: 122,
  LMT: 575,
  NOC: 520,
  GD: 295,
  AAL: 12,
  DAL: 52,
  UAL: 58,
  CCL: 20,
  GME: 23,
  AMC: 5,
  CRON: 3,
  MCO: 465,
  NEM: 48,
  FCX: 45,
  GILD: 85,
  AMGN: 320,
  BMY: 52,
  TMO: 580,
  DHR: 245,
  LIN: 460,
  IBM: 215,
  NOW: 925,
  INTU: 630,
  MU: 105,
  AMAT: 195,
  LRCX: 75,
  ADI: 225,
  KLAC: 720,
  PANW: 385,
  SNPS: 490,
  CDNS: 300,
  WDAY: 245,
  TEAM: 215,
  ZS: 195,
  OKTA: 88,
  TWLO: 98,
  DOCU: 62,
  ROKU: 72,
  DASH: 165,
  ZM: 72,
  MARA: 18,
  RIOT: 10,
  MSTR: 195,
  HOOD: 28,
  SOFI: 9,
  AFRM: 42,
  RIVN: 11,
  LCID: 3,
  NIO: 5,
  XPEV: 12,
  LI: 24,
  PDD: 120,
  JD: 38,
  BIDU: 92,
  NTES: 98,
  SE: 95,
  ISRG: 505,
  REGN: 755,
  VRTX: 485,
  BKNG: 4850,
  CMG: 58,
  MNST: 52,
  KHC: 34,
  MDLZ: 68,
  CL: 98,
  KMB: 138,
  GIS: 68,
  SYK: 365,
  BDX: 235,
  CI: 345,
  ELV: 485,
  HCA: 345,
  SPGI: 505,
  ICE: 158,
  CME: 215,
  PNC: 185,
  USB: 46,
  TFC: 44,
  SCHW: 72,
  COF: 155,
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
