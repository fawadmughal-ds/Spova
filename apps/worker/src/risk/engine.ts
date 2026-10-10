import { accountMath, dec, floatingPnl, money2, orderTriggered, quoteCurrency, slHit, toUsd, tpHit, type Dec, type PriceBook, type Quote, type WsAccountSnapshot } from '@spova/shared';
import type { OrderDto, PositionDto } from '@spova/shared';
import type { OurTick } from '../feeds/ingest';
import { OncePer } from '../feeds/throttle';
import type { InternalClient } from '../internal-client';
import type { Logger } from '../logger';
import { type RedisClient } from '../redis';
import type { SymbolRegistry } from '../symbols';
import { decideAccountAction, Inflight } from './guards';
import type { TradingIndex } from './index';

export interface RiskEngineOptions {
  accountLoopMs?: number;
  /** a close/fill request blocks repeats for this long (ms) unless the index drops the row first */
  requestTtlMs?: number;
  stopOutDebounceMs?: number;
  marginCallWindowMs?: number;
}

interface SymbolMath {
  contractSize: string;
  assetClass: string;
}

/**
 * Risk loop (ARCHITECTURE §08 pseudo). Never moves money: every decision is a POST to the API,
 * which re-validates against the DB and `price:*` before acting.
 */
export class RiskEngine {
  readonly floating = new Map<string, Dec>();
  private touched = new Set<string>();
  private readonly closeInflight: Inflight;
  private readonly fillInflight: Inflight;
  private readonly stopOutInflight: Inflight;
  private readonly marginCallOnce: OncePer;
  private readonly noRateWarned = new Set<string>();
  private loop?: NodeJS.Timeout;
  private readonly opts: Required<RiskEngineOptions>;
  stats = { ticks: 0, closes: 0, fills: 0, stopOuts: 0, marginCalls: 0, snapshots: 0 };

  constructor(
    private readonly index: TradingIndex,
    private readonly api: InternalClient,
    private readonly redis: RedisClient,
    private readonly book: PriceBook,
    private readonly symbols: SymbolRegistry,
    private readonly log: Logger,
    opts: RiskEngineOptions = {},
  ) {
    this.opts = {
      accountLoopMs: opts.accountLoopMs ?? 500,
      requestTtlMs: opts.requestTtlMs ?? 5000,
      stopOutDebounceMs: opts.stopOutDebounceMs ?? 2000,
      marginCallWindowMs: opts.marginCallWindowMs ?? 3_600_000,
    };
    this.closeInflight = new Inflight(this.opts.requestTtlMs);
    this.fillInflight = new Inflight(this.opts.requestTtlMs);
    this.stopOutInflight = new Inflight(this.opts.stopOutDebounceMs);
    this.marginCallOnce = new OncePer(this.opts.marginCallWindowMs);
    this.index.onRefreshed((changed) => this.onIndexRefreshed(changed));
  }

  start() {
    this.loop = setInterval(() => void this.accountLoop().catch((e) => this.log.error({ err: e }, 'account loop failed')), this.opts.accountLoopMs);
    this.loop.unref();
  }

  stop() {
    if (this.loop) clearInterval(this.loop);
  }

  private symbolMath(symbol: string): SymbolMath | undefined {
    const fromIndex = this.index.symbols.get(symbol);
    if (fromIndex) return { contractSize: fromIndex.contractSize, assetClass: fromIndex.assetClass };
    const meta = this.symbols.get(symbol);
    return meta ? { contractSize: meta.contractSize, assetClass: meta.assetClass } : undefined;
  }

  /** floating P/L in USD for one position at a quote, or null when the quote currency cannot be converted. */
  floatingUsd(p: PositionDto, q: Quote): Dec | null {
    const sm = this.symbolMath(p.symbol);
    if (!sm) return null;
    const raw = floatingPnl({ side: p.side, openPrice: p.openPrice, lots: p.lots, contractSize: sm.contractSize, bid: q.bid, ask: q.ask });
    const usd = toUsd(raw, quoteCurrency(p.symbol, sm.assetClass), this.book);
    if (usd === null && !this.noRateWarned.has(p.symbol)) {
      this.noRateWarned.add(p.symbol);
      this.log.warn({ symbol: p.symbol, ccy: quoteCurrency(p.symbol, sm.assetClass) }, 'no USD rate in book; floating P/L unavailable');
    }
    return usd;
  }

  /** After each index rebuild: drop stale caches, recompute floating from the book, touch affected accounts. */
  private onIndexRefreshed(changed: Set<string>) {
    for (const id of this.floating.keys()) if (!this.index.positions.has(id)) this.floating.delete(id);
    for (const p of this.index.positions.values()) {
      if (this.floating.has(p.id)) continue;
      const q = this.book[p.symbol];
      if (!q) continue;
      const usd = this.floatingUsd(p, q);
      if (usd) {
        this.floating.set(p.id, usd);
        this.touched.add(p.accountId);
      }
    }
    for (const id of changed) this.touched.add(id);
  }

  onTick = (t: OurTick) => {
    this.stats.ticks++;
    const q = t.quote;
    const positions = this.index.positionsBySymbol.get(t.symbol);
    if (positions) {
      for (const p of positions) {
        const usd = this.floatingUsd(p, q);
        if (usd) {
          this.floating.set(p.id, usd);
          const price = p.side === 'buy' ? q.bid : q.ask;
          void this.redis.hset(`pos:${p.id}`, { floatingUsd: money2(usd), currentPrice: price, ts: String(q.ts) }).catch(() => {});
        }
        this.touched.add(p.accountId);
        if (slHit(p.side, p.sl, q)) this.requestClose(p, 'sl', q);
        else if (tpHit(p.side, p.tp, q)) this.requestClose(p, 'tp', q);
      }
    }
    const orders = this.index.ordersBySymbol.get(t.symbol);
    if (orders) {
      for (const o of orders) {
        if (o.price !== null && (o.type === 'limit' || o.type === 'stop') && orderTriggered({ type: o.type, side: o.side, price: o.price }, q)) this.requestFill(o, q);
      }
    }
  };

  private requestClose(p: PositionDto, reason: 'sl' | 'tp', q: Quote) {
    if (!this.closeInflight.begin(p.id)) return;
    this.log.info({ positionId: p.id, symbol: p.symbol, reason, bid: q.bid, ask: q.ask, trigger: reason === 'sl' ? p.sl : p.tp }, 'position trigger -> close');
    this.api
      .close({ positionId: p.id, reason, quote: q })
      .then((res) => {
        if (res.ok) {
          this.stats.closes++;
          this.dropPosition(p.id);
          this.closeInflight.end(p.id);
        }
      })
      .catch((e) => this.log.error({ err: (e as Error).message, positionId: p.id }, 'close request failed'));
  }

  private requestFill(o: OrderDto, q: Quote) {
    if (!this.fillInflight.begin(o.id)) return;
    this.log.info({ orderId: o.id, symbol: o.symbol, type: o.type, side: o.side, price: o.price, bid: q.bid, ask: q.ask }, 'order triggered -> fill');
    this.api
      .fill({ orderId: o.id, quote: q })
      .then((res) => {
        if (res.ok) this.stats.fills++;
        // either way the API decided (filled or rejected); drop locally until the next index refresh confirms
        this.dropOrder(o.id);
        if (res.ok) this.fillInflight.end(o.id);
      })
      .catch((e) => this.log.error({ err: (e as Error).message, orderId: o.id }, 'fill request failed'));
  }

  private dropPosition(id: string) {
    const p = this.index.positions.get(id);
    if (!p) return;
    this.index.positions.delete(id);
    this.index.positionsBySymbol.set(p.symbol, (this.index.positionsBySymbol.get(p.symbol) ?? []).filter((x) => x.id !== id));
    this.index.positionsByAccount.set(p.accountId, (this.index.positionsByAccount.get(p.accountId) ?? []).filter((x) => x.id !== id));
    this.floating.delete(id);
    this.touched.add(p.accountId);
  }

  private dropOrder(id: string) {
    const o = this.index.orders.get(id);
    if (!o) return;
    this.index.orders.delete(id);
    this.index.ordersBySymbol.set(o.symbol, (this.index.ordersBySymbol.get(o.symbol) ?? []).filter((x) => x.id !== id));
  }

  /** Every 500ms: snapshot each touched account, then margin-call / stop-out decisions. */
  async accountLoop() {
    if (this.touched.size === 0) return;
    const ids = [...this.touched];
    this.touched.clear();
    const now = Date.now();
    for (const id of ids) {
      const a = this.index.accounts.get(id);
      if (!a) continue; // not in the API index (closed / unknown) -> nothing to publish
      const positions = this.index.positionsByAccount.get(id) ?? [];
      const m = accountMath(
        a.balance,
        a.credit,
        positions.map((p) => ({ marginUsed: p.marginUsed, floatingUsd: this.floating.get(p.id) ?? dec(0) })),
      );
      const snap: WsAccountSnapshot = {
        accountId: id,
        balance: money2(a.balance),
        credit: money2(a.credit),
        equity: money2(m.equity),
        usedMargin: money2(m.usedMargin),
        freeMargin: money2(m.freeMargin),
        marginLevel: m.marginLevel ? m.marginLevel.toFixed(2) : null,
        ts: now,
      };
      this.stats.snapshots++;
      const pipe = this.redis.pipeline();
      pipe.hset(`acct:${id}`, { ...snap, marginLevel: snap.marginLevel ?? '' });
      pipe.publish('ws:events', JSON.stringify({ room: `user:${a.userId}`, event: 'account', payload: snap }));
      pipe.publish('ws:events', JSON.stringify({ room: `account:${id}`, event: 'account', payload: snap }));
      void pipe.exec().catch((e) => this.log.warn({ err: e }, 'account snapshot write failed'));

      const action = decideAccountAction(m.marginLevel, a);
      if (action === 'stop_out') {
        if (this.stopOutInflight.begin(id)) {
          this.stats.stopOuts++;
          this.log.warn({ accountId: id, level: snap.marginLevel, equity: snap.equity, usedMargin: snap.usedMargin }, 'stop-out level reached');
          this.api
            .stopOut({ accountId: id })
            .then(() => this.index.onTradingEvent({ type: 'account.changed', accountId: id }))
            .catch((e) => this.log.error({ err: (e as Error).message, accountId: id }, 'stop-out request failed'));
        }
        this.touched.add(id); // keep evaluating while under water
      } else if (action === 'margin_call') {
        void this.maybeMarginCall(id, snap.marginLevel ?? '0');
      }
    }
  }

  private async maybeMarginCall(accountId: string, level: string) {
    if (!this.marginCallOnce.tryAcquire(accountId)) return;
    // restart-safe guard shared with nothing else: SET NX EX 1h
    const fresh = await this.redis.set(`mc:sent:${accountId}`, String(Date.now()), 'EX', Math.ceil(this.opts.marginCallWindowMs / 1000), 'NX').catch(() => 'OK');
    if (fresh !== 'OK') return;
    this.stats.marginCalls++;
    this.log.warn({ accountId, level }, 'margin call level reached');
    try {
      await this.api.marginCall({ accountId, level });
    } catch (e) {
      this.log.error({ err: (e as Error).message, accountId }, 'margin-call request failed');
      this.marginCallOnce.release(accountId);
    }
  }
}

