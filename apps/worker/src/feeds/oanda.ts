import { request as httpsRequest } from 'node:https';
import type { ClientRequest } from 'node:http';
import type { FeedAdapter, Tick } from '../feed';
import type { Logger } from '../logger';

/**
 * Our symbol -> OANDA v20 instrument. These are the CFD instruments a MatchTrader broker such as Spova
 * quotes from its liquidity providers; OANDA streams the same underlying market (forex, metals, index
 * and energy CFDs). Shares are not on OANDA and keep the synthetic feed until a stock feed is added.
 */
export const OANDA_INSTRUMENTS: Record<string, string> = {
  EURUSD: 'EUR_USD',
  GBPUSD: 'GBP_USD',
  USDJPY: 'USD_JPY',
  AUDUSD: 'AUD_USD',
  USDCAD: 'USD_CAD',
  USDCHF: 'USD_CHF',
  NZDUSD: 'NZD_USD',
  EURGBP: 'EUR_GBP',
  EURJPY: 'EUR_JPY',
  GBPJPY: 'GBP_JPY',
  // forex crosses & exotics (OANDA prices them even though a forex-only account cannot trade a few)
  AUDCAD: 'AUD_CAD',
  AUDCHF: 'AUD_CHF',
  AUDJPY: 'AUD_JPY',
  AUDNZD: 'AUD_NZD',
  CADCHF: 'CAD_CHF',
  CADJPY: 'CAD_JPY',
  CHFJPY: 'CHF_JPY',
  EURAUD: 'EUR_AUD',
  EURCAD: 'EUR_CAD',
  EURCHF: 'EUR_CHF',
  EURCZK: 'EUR_CZK',
  EURHUF: 'EUR_HUF',
  EURNOK: 'EUR_NOK',
  EURNZD: 'EUR_NZD',
  EURPLN: 'EUR_PLN',
  EURSEK: 'EUR_SEK',
  EURTRY: 'EUR_TRY',
  GBPAUD: 'GBP_AUD',
  GBPCAD: 'GBP_CAD',
  GBPCHF: 'GBP_CHF',
  GBPNZD: 'GBP_NZD',
  GBPSGD: 'GBP_SGD',
  NZDCAD: 'NZD_CAD',
  NZDCHF: 'NZD_CHF',
  NZDJPY: 'NZD_JPY',
  USDCNH: 'USD_CNH',
  USDCZK: 'USD_CZK',
  USDDKK: 'USD_DKK',
  USDHKD: 'USD_HKD',
  USDINR: 'USD_INR',
  USDMXN: 'USD_MXN',
  USDNOK: 'USD_NOK',
  USDPLN: 'USD_PLN',
  USDSEK: 'USD_SEK',
  USDSGD: 'USD_SGD',
  USDTHB: 'USD_THB',
  USDTRY: 'USD_TRY',
  USDZAR: 'USD_ZAR',
  XAUUSD: 'XAU_USD',
  XAGUSD: 'XAG_USD',
  XAUEUR: 'XAU_EUR',
  XAGEUR: 'XAG_EUR',
  XPTUSD: 'XPT_USD',
  XPDUSD: 'XPD_USD',
  USOIL: 'WTICO_USD',
  UKOIL: 'BCO_USD',
  NATGAS: 'NATGAS_USD',
  US500: 'SPX500_USD',
  US100: 'NAS100_USD',
  US30: 'US30_USD',
  DE40: 'DE30_EUR',
  UK100: 'UK100_GBP',
};

export interface OandaFeedOptions {
  token: string;
  accountId: string;
  env: 'practice' | 'live';
  backoffMinMs?: number;
  backoffMaxMs?: number;
  /** OANDA sends a heartbeat every 5s; reconnect if nothing arrives for this long */
  idleMs?: number;
}

interface PriceMsg {
  type: 'PRICE' | 'HEARTBEAT';
  instrument?: string;
  time?: string;
  bids?: { price: string }[];
  asks?: { price: string }[];
  tradeable?: boolean;
}

/** One line of the OANDA pricing stream -> our tick (or null for heartbeats / untradeable / unknown). */
export function parseOandaLine(line: string, map: Record<string, string>, now = Date.now()): Tick | null {
  let m: PriceMsg;
  try {
    m = JSON.parse(line) as PriceMsg;
  } catch {
    return null;
  }
  if (m.type !== 'PRICE' || !m.instrument || !m.bids?.[0] || !m.asks?.[0]) return null;
  const symbol = map[m.instrument];
  if (!symbol) return null;
  const ts = m.time ? Date.parse(m.time) : NaN;
  return { symbol, bid: m.bids[0].price, ask: m.asks[0].price, ts: Number.isFinite(ts) ? ts : now };
}

/**
 * OANDA v20 streaming prices (HTTP chunked stream, one JSON object per line). Free with a practice
 * account; the practice and live streams carry the same market prices. Reconnects with backoff and
 * treats a silent stream (no heartbeat for `idleMs`) as dead.
 */
export class OandaFeed implements FeedAdapter {
  readonly name = 'oanda';
  private map: Record<string, string> = {};
  private onTick: (t: Tick) => void = () => {};
  private req?: ClientRequest;
  private attempts = 0;
  private stopped = false;
  private reconnectTimer?: NodeJS.Timeout;
  private idleTimer?: NodeJS.Timeout;
  private openedAt = 0;
  private status: 'up' | 'down' = 'down';
  private readonly opts: Required<OandaFeedOptions>;

  onStatus: (status: 'up' | 'down') => void = () => {};

  constructor(
    private readonly log: Logger,
    opts: OandaFeedOptions,
  ) {
    this.opts = { backoffMinMs: 1000, backoffMaxMs: 30_000, idleMs: 20_000, ...opts };
  }

  get isUp() {
    return this.status === 'up';
  }

  async connect(map: Record<string, string>, onTick: (t: Tick) => void) {
    this.map = map;
    this.onTick = onTick;
    this.stopped = false;
    if (Object.keys(map).length === 0) {
      this.log.warn('oanda: no symbols mapped, feed idle');
      return;
    }
    this.open();
  }

  async disconnect() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.req?.destroy();
    this.req = undefined;
    this.setStatus('down');
  }

  private open() {
    if (this.stopped) return;
    const host = this.opts.env === 'live' ? 'stream-fxtrade.oanda.com' : 'stream-fxpractice.oanda.com';
    const path = `/v3/accounts/${this.opts.accountId}/pricing/stream?instruments=${encodeURIComponent(Object.keys(this.map).join(','))}`;
    this.log.info({ host, instruments: Object.keys(this.map).length, attempt: this.attempts }, 'oanda: connecting');
    const req = httpsRequest({ host, path, method: 'GET', headers: { Authorization: `Bearer ${this.opts.token}`, 'Accept-Datetime-Format': 'RFC3339' }, timeout: 15_000 }, (res) => {
      if (res.statusCode !== 200) {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          this.log.error({ status: res.statusCode, body: body.slice(0, 200) }, 'oanda: stream rejected (check OANDA_TOKEN / OANDA_ACCOUNT_ID / OANDA_ENV)');
          this.scheduleReconnect();
        });
        return;
      }
      this.openedAt = Date.now();
      this.log.info('oanda: streaming');
      this.setStatus('up');
      this.armIdle();
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        this.armIdle();
        buf += chunk;
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const tick = parseOandaLine(line, this.map);
          if (tick) this.onTick(tick);
        }
      });
      res.on('end', () => {
        this.log.warn('oanda: stream ended');
        this.setStatus('down');
        this.scheduleReconnect();
      });
      res.on('error', (err) => {
        this.log.warn({ err: err.message }, 'oanda: stream error');
        this.setStatus('down');
        this.scheduleReconnect();
      });
    });
    this.req = req;
    req.on('timeout', () => req.destroy(new Error('connect timeout')));
    req.on('error', (err) => {
      if (this.stopped) return;
      this.log.warn({ err: err.message }, 'oanda: request error');
      this.setStatus('down');
      this.scheduleReconnect();
    });
    req.end();
  }

  private armIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.log.warn({ idleMs: this.opts.idleMs }, 'oanda: no heartbeat, reconnecting');
      this.req?.destroy(); // emits 'error'/'end' -> reconnect
    }, this.opts.idleMs);
    this.idleTimer.unref();
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.req?.removeAllListeners();
    this.req = undefined;
    if (this.openedAt && Date.now() - this.openedAt > 60_000) this.attempts = 0;
    this.openedAt = 0;
    const base = Math.min(this.opts.backoffMaxMs, this.opts.backoffMinMs * 2 ** this.attempts);
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.attempts++;
    this.log.info({ delay, attempt: this.attempts }, 'oanda: reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.open();
    }, delay);
  }

  private setStatus(s: 'up' | 'down') {
    if (this.status === s) return;
    this.status = s;
    this.onStatus(s);
  }
}
