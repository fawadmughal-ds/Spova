import WebSocket from 'ws';
import type { FeedAdapter, Tick } from '../feed';
import type { Logger } from '../logger';

interface BookTicker {
  s: string; // BTCUSDT
  b: string; // best bid
  B: string;
  a: string; // best ask
  A: string;
}
interface Combined {
  stream: string;
  data: BookTicker;
}

export interface BinanceFeedOptions {
  url?: string;
  /** reconnect backoff bounds (ms) */
  backoffMinMs?: number;
  backoffMaxMs?: number;
  /** terminate and reconnect if no message for this long (ms) */
  idleMs?: number;
}

/**
 * Binance spot bookTicker over the combined stream endpoint. Free, no key.
 * Reconnects with exponential backoff; a silent socket (no frame for `idleMs`) is terminated so the
 * backoff loop takes over. Binance closes every connection after 24h, which lands in the same path.
 */
export class BinanceFeed implements FeedAdapter {
  readonly name = 'binance';
  private ws?: WebSocket;
  private map: Record<string, string> = {};
  private onTick: (t: Tick) => void = () => {};
  private attempts = 0;
  private stopped = false;
  private reconnectTimer?: NodeJS.Timeout;
  private idleTimer?: NodeJS.Timeout;
  private openedAt = 0;
  private status: 'up' | 'down' = 'down';
  private readonly opts: Required<BinanceFeedOptions>;

  onStatus: (status: 'up' | 'down') => void = () => {};

  constructor(
    private readonly log: Logger,
    opts: BinanceFeedOptions = {},
  ) {
    this.opts = {
      url: opts.url ?? 'wss://stream.binance.com:9443/stream',
      backoffMinMs: opts.backoffMinMs ?? 1000,
      backoffMaxMs: opts.backoffMaxMs ?? 30_000,
      idleMs: opts.idleMs ?? 60_000,
    };
  }

  get isUp() {
    return this.status === 'up';
  }

  async connect(map: Record<string, string>, onTick: (t: Tick) => void) {
    this.map = Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toUpperCase(), v]));
    this.onTick = onTick;
    this.stopped = false;
    if (Object.keys(this.map).length === 0) {
      this.log.warn('binance: no symbols mapped, feed idle');
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

  private streamUrl() {
    const streams = Object.keys(this.map)
      .map((s) => `${s.toLowerCase()}@bookTicker`)
      .join('/');
    return `${this.opts.url}?streams=${streams}`;
  }

  private open() {
    if (this.stopped) return;
    const url = this.streamUrl();
    this.log.info({ url, attempt: this.attempts }, 'binance: connecting');
    const ws = new WebSocket(url, { handshakeTimeout: 10_000 });
    this.ws = ws;

    ws.on('open', () => {
      this.openedAt = Date.now();
      this.log.info('binance: connected');
      this.setStatus('up');
      this.armIdle();
    });
    ws.on('message', (raw) => {
      this.armIdle();
      let msg: Combined;
      try {
        msg = JSON.parse(raw.toString()) as Combined;
      } catch {
        return;
      }
      const d = msg.data;
      if (!d || !d.s) return;
      const symbol = this.map[d.s];
      if (!symbol) return;
      this.onTick({ symbol, bid: d.b, ask: d.a, ts: Date.now() });
    });
    ws.on('ping', () => {
      // `ws` answers pings with pongs automatically; just note liveness.
      this.armIdle();
    });
    ws.on('error', (err) => {
      this.log.warn({ err: err.message }, 'binance: socket error');
    });
    ws.on('close', (code, reason) => {
      this.log.warn({ code, reason: reason.toString() }, 'binance: socket closed');
      this.setStatus('down');
      this.scheduleReconnect();
    });
  }

  private armIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.log.warn({ idleMs: this.opts.idleMs }, 'binance: no frames, terminating socket');
      this.ws?.terminate(); // emits 'close' -> reconnect
    }, this.opts.idleMs);
    this.idleTimer.unref();
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.ws?.removeAllListeners();
    this.ws = undefined;
    // a connection that lived > 60s resets the backoff
    if (this.openedAt && Date.now() - this.openedAt > 60_000) this.attempts = 0;
    this.openedAt = 0;
    const base = Math.min(this.opts.backoffMaxMs, this.opts.backoffMinMs * 2 ** this.attempts);
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.attempts++;
    this.log.info({ delay, attempt: this.attempts }, 'binance: reconnecting');
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private setStatus(s: 'up' | 'down') {
    if (this.status === s) return;
    this.status = s;
    this.onStatus(s);
  }
}
