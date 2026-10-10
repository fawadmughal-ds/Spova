import type { Logger } from '../logger';
import type { RedisClient } from '../redis';
import type { SymbolRegistry } from '../symbols';
import type { Ingest } from './ingest';

/**
 * feed:health (ARCHITECTURE §10): every 10s refresh `feed:{source}:status` (EX 60).
 * A Binance symbol with no tick for 60s logs a warning and marks the source down.
 * Synthetic symbols are only expected to tick while their market session is open.
 */
export class FeedHealth {
  private timer?: NodeJS.Timeout;
  private binanceUp = false;
  private oandaUp = false;
  private readonly startedAt = Date.now();

  constructor(
    private readonly redis: RedisClient,
    private readonly symbols: SymbolRegistry,
    private readonly ingest: Ingest,
    private readonly log: Logger,
    private readonly enabled: { binance: boolean; synthetic: boolean; oanda?: boolean },
    /** synthetic-source symbols currently quoted by OANDA instead */
    private readonly oandaSymbols: Set<string> = new Set(),
    private readonly staleMs = 60_000,
  ) {}

  setBinanceSocket(up: boolean) {
    this.binanceUp = up;
    void this.write('binance', up ? 'up' : 'down');
  }

  setOandaSocket(up: boolean) {
    this.oandaUp = up;
    void this.write('oanda', up ? 'up' : 'down');
  }

  start(intervalMs = 10_000) {
    this.timer = setInterval(() => void this.check().catch((e) => this.log.warn({ err: e }, 'feed health check failed')), intervalMs);
    this.timer.unref();
    void this.check();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async check() {
    const now = Date.now();
    // a symbol that has never ticked only counts as stale once the worker has been up for the stale window
    const bootGrace = now - this.startedAt < this.staleMs;
    if (this.enabled.binance) {
      const stale: string[] = [];
      for (const s of this.symbols.enabled().filter((x) => x.feedSource === 'binance')) {
        const last = this.ingest.lastTick(s.id);
        if (last === undefined ? !bootGrace : now - last > this.staleMs) stale.push(s.id);
      }
      const status = this.binanceUp && stale.length === 0 ? 'up' : 'down';
      if (stale.length) this.log.warn({ stale, socket: this.binanceUp ? 'up' : 'down' }, 'binance: symbols without ticks for 60s');
      await this.write('binance', status);
    }
    if (this.enabled.oanda) {
      const stale: string[] = [];
      for (const id of this.oandaSymbols) {
        if (!this.symbols.isOpen(id)) continue;
        const last = this.ingest.lastTick(id);
        if (last === undefined ? !bootGrace : now - last > this.staleMs) stale.push(id);
      }
      const status = this.oandaUp && stale.length === 0 ? 'up' : 'down';
      if (stale.length) this.log.warn({ stale, socket: this.oandaUp ? 'up' : 'down' }, 'oanda: open symbols without ticks for 60s');
      await this.write('oanda', status);
    }
    if (this.enabled.synthetic) {
      const stale: string[] = [];
      for (const s of this.symbols.enabled().filter((x) => x.feedSource === 'synthetic' && !this.oandaSymbols.has(x.id))) {
        if (!this.symbols.isOpen(s.id)) continue;
        const last = this.ingest.lastTick(s.id);
        if (last === undefined ? !bootGrace : now - last > this.staleMs) stale.push(s.id);
      }
      if (stale.length) this.log.warn({ stale }, 'synthetic: open symbols without ticks for 60s');
      await this.write('synthetic', stale.length === 0 ? 'up' : 'down');
    }
  }

  private write(source: string, status: 'up' | 'down') {
    return this.redis.set(`feed:${source}:status`, status, 'EX', 60).catch((e) => this.log.warn({ err: e }, 'feed status write failed'));
  }
}
