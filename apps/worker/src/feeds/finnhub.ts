import WebSocket from 'ws';
import type { FeedAdapter, Tick } from '../feed';
import type { Logger } from '../logger';

/**
 * Our symbol -> Finnhub symbol. US shares trade directly; forex, metals, indices and energies come through
 * Finnhub's relay of OANDA prices (free tier, websocket). Crypto stays on Binance directly.
 */
export const FINNHUB_SYMBOLS: Record<string, string> = {
  AAPL: 'AAPL',
  TSLA: 'TSLA',
  AMZN: 'AMZN',
  NVDA: 'NVDA',
  EURUSD: 'OANDA:EUR_USD',
  GBPUSD: 'OANDA:GBP_USD',
  USDJPY: 'OANDA:USD_JPY',
  AUDUSD: 'OANDA:AUD_USD',
  USDCAD: 'OANDA:USD_CAD',
  USDCHF: 'OANDA:USD_CHF',
  NZDUSD: 'OANDA:NZD_USD',
  EURGBP: 'OANDA:EUR_GBP',
  EURJPY: 'OANDA:EUR_JPY',
  GBPJPY: 'OANDA:GBP_JPY',
  XAUUSD: 'OANDA:XAU_USD',
  XAGUSD: 'OANDA:XAG_USD',
  USOIL: 'OANDA:WTICO_USD',
  UKOIL: 'OANDA:BCO_USD',
  NATGAS: 'OANDA:NATGAS_USD',
  US500: 'OANDA:SPX500_USD',
  US100: 'OANDA:NAS100_USD',
  US30: 'OANDA:US30_USD',
  DE40: 'OANDA:DE30_EUR',
  UK100: 'OANDA:UK100_GBP',
};
/** symbols that are shares (the only ones Finnhub quotes natively; the rest are the OANDA relay) */
export const FINNHUB_SHARES = new Set(['AAPL', 'TSLA', 'AMZN', 'NVDA']);

interface TradeMsg {
  type: 'trade' | 'ping' | 'error';
  msg?: string;
  data?: { s: string; p: number; t: number; v: number }[];
}

/** One websocket frame -> the last trade per symbol as ticks (Finnhub sends last price, not a book; Ingest adds the spread). */
export function parseFinnhubFrame(raw: string, map: Record<string, string>): Tick[] {
  let m: TradeMsg;
  try {
    m = JSON.parse(raw) as TradeMsg;
  } catch {
    return [];
  }
  if (m.type !== 'trade' || !Array.isArray(m.data)) return [];
  const last = new Map<string, Tick>();
  for (const d of m.data) {
    const symbol = map[d.s];
    if (!symbol || !(d.p > 0)) continue;
    const prev = last.get(symbol);
    if (prev && prev.ts > d.t) continue;
    const px = String(d.p);
    last.set(symbol, { symbol, bid: px, ask: px, ts: d.t || Date.now() });
  }
  return [...last.values()];
}

export interface FinnhubFeedOptions {
  token: string;
  url?: string;
  backoffMinMs?: number;
  backoffMaxMs?: number;
  /** Finnhub pings roughly every 10s; reconnect when nothing arrives for this long */
  idleMs?: number;
}

/** Finnhub trade websocket (`wss://ws.finnhub.io`). Reconnects with backoff; a silent socket is terminated. */
export class FinnhubFeed implements FeedAdapter {
  readonly name = 'finnhub';
  private ws?: WebSocket;
  private map: Record<string, string> = {};
  private onTick: (t: Tick) => void = () => {};
  private attempts = 0;
  private stopped = false;
  private reconnectTimer?: NodeJS.Timeout;
  private idleTimer?: NodeJS.Timeout;
  private openedAt = 0;
  private status: 'up' | 'down' = 'down';
  private readonly opts: Required<FinnhubFeedOptions>;

  onStatus: (status: 'up' | 'down') => void = () => {};

  constructor(
    private readonly log: Logger,
    opts: FinnhubFeedOptions,
  ) {
    this.opts = { url: 'wss://ws.finnhub.io', backoffMinMs: 1000, backoffMaxMs: 30_000, idleMs: 60_000, ...opts };
  }

  get isUp() {
    return this.status === 'up';
  }

  async connect(map: Record<string, string>, onTick: (t: Tick) => void) {
    this.map = map;
    this.onTick = onTick;
    this.stopped = false;
    if (Object.keys(map).length === 0) {
      this.log.warn('finnhub: no symbols mapped, feed idle');
      return;
    }
    this.open();
  }

  async disconnect() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.ws?.removeAllListeners();
    try {
      this.ws?.terminate();
    } catch {
      /* ignore */
    }
    this.ws = undefined;
    this.setStatus('down');
  }

  private open() {
    if (this.stopped) return;
    this.log.info({ symbols: Object.keys(this.map).length, attempt: this.attempts }, 'finnhub: connecting');
    const ws = new WebSocket(`${this.opts.url}?token=${encodeURIComponent(this.opts.token)}`, { handshakeTimeout: 10_000 });
    this.ws = ws;
    ws.on('open', () => {
      this.openedAt = Date.now();
      for (const s of Object.keys(this.map)) ws.send(JSON.stringify({ type: 'subscribe', symbol: s }));
      this.log.info('finnhub: connected and subscribed');
      this.setStatus('up');
      this.armIdle();
    });
    ws.on('message', (raw) => {
      this.armIdle();
      const text = raw.toString();
      if (text.includes('"error"')) this.log.warn({ msg: text.slice(0, 200) }, 'finnhub: server message');
      for (const t of parseFinnhubFrame(text, this.map)) this.onTick(t);
    });
    ws.on('error', (err) => this.log.warn({ err: err.message }, 'finnhub: socket error'));
    ws.on('close', (code, reason) => {
      this.log.warn({ code, reason: reason.toString() }, 'finnhub: socket closed');
      this.setStatus('down');
      this.scheduleReconnect();
    });
  }

  private armIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.log.warn({ idleMs: this.opts.idleMs }, 'finnhub: no frames, terminating socket');
      this.ws?.terminate();
    }, this.opts.idleMs);
    this.idleTimer.unref();
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.ws?.removeAllListeners();
    this.ws = undefined;
    if (this.openedAt && Date.now() - this.openedAt > 60_000) this.attempts = 0;
    this.openedAt = 0;
    const base = Math.min(this.opts.backoffMaxMs, this.opts.backoffMinMs * 2 ** this.attempts);
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.attempts++;
    this.log.info({ delay, attempt: this.attempts }, 'finnhub: reconnecting');
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private setStatus(s: 'up' | 'down') {
    if (this.status === s) return;
    this.status = s;
    this.onStatus(s);
  }
}
