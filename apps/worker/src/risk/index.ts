import type { OrderDto, PositionDto, TradingEvent } from '@spova/shared';
import type { InternalClient } from '../internal-client';
import type { Logger } from '../logger';
import type { IndexAccountDto, IndexSymbolDto, TradingIndexDto } from './index-types';

/**
 * In-memory index of open positions / pending orders / accounts, grouped by symbol and account.
 * Rebuilt from GET /index every `refreshMs` and immediately (coalesced) on any `trading:events` message.
 */
export class TradingIndex {
  accounts = new Map<string, IndexAccountDto>();
  positions = new Map<string, PositionDto>();
  orders = new Map<string, OrderDto>();
  positionsBySymbol = new Map<string, PositionDto[]>();
  ordersBySymbol = new Map<string, OrderDto[]>();
  positionsByAccount = new Map<string, PositionDto[]>();
  symbols = new Map<string, IndexSymbolDto>();
  lastRefreshAt = 0;
  refreshes = 0;
  failures = 0;

  private timer?: NodeJS.Timeout;
  private kick?: NodeJS.Timeout;
  private inflight: Promise<void> | null = null;
  private listeners: Array<(changedAccounts: Set<string>) => void> = [];

  constructor(
    private readonly api: InternalClient,
    private readonly log: Logger,
    private readonly refreshMs = 5000,
  ) {}

  onRefreshed(fn: (changedAccounts: Set<string>) => void) {
    this.listeners.push(fn);
  }

  start() {
    this.timer = setInterval(() => void this.refresh(), this.refreshMs);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.kick) clearTimeout(this.kick);
  }

  /** Called on every trading:events message: coalesce a burst into one refresh ~100ms later. */
  onTradingEvent(ev: TradingEvent) {
    this.log.debug({ ev }, 'trading event');
    if (this.kick) return;
    this.kick = setTimeout(() => {
      this.kick = undefined;
      void this.refresh();
    }, 100);
  }

  refresh(): Promise<void> {
    if (this.inflight) return this.inflight;
    this.inflight = this.doRefresh().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async doRefresh() {
    let dto: TradingIndexDto;
    try {
      const res = await this.api.index();
      if (!res.ok || !res.body) {
        this.failures++;
        return;
      }
      dto = res.body;
    } catch (e) {
      this.failures++;
      this.log.warn({ err: (e as Error).message }, 'index refresh failed; keeping previous index');
      return;
    }
    this.apply(dto);
  }

  /** Replace the index with a fresh snapshot. Exported for tests. */
  apply(dto: TradingIndexDto) {
    const changed = new Set<string>();
    const prevPos = this.positions;
    const prevOrd = this.orders;
    const prevAcc = this.accounts;

    const accounts = new Map<string, IndexAccountDto>();
    for (const a of dto.accounts ?? []) {
      accounts.set(a.id, a);
      const p = prevAcc.get(a.id);
      if (!p || p.balance !== a.balance || p.credit !== a.credit || p.leverage !== a.leverage) changed.add(a.id);
    }
    for (const id of prevAcc.keys()) if (!accounts.has(id)) changed.add(id);

    const positions = new Map<string, PositionDto>();
    const positionsBySymbol = new Map<string, PositionDto[]>();
    const positionsByAccount = new Map<string, PositionDto[]>();
    for (const p of dto.positions ?? []) {
      if (p.status !== 'open') continue;
      positions.set(p.id, p);
      push(positionsBySymbol, p.symbol, p);
      push(positionsByAccount, p.accountId, p);
      const old = prevPos.get(p.id);
      if (!old || old.sl !== p.sl || old.tp !== p.tp || old.lots !== p.lots || old.marginUsed !== p.marginUsed) changed.add(p.accountId);
    }
    for (const [id, p] of prevPos) if (!positions.has(id)) changed.add(p.accountId);

    const orders = new Map<string, OrderDto>();
    const ordersBySymbol = new Map<string, OrderDto[]>();
    for (const o of dto.orders ?? []) {
      if (o.status !== 'pending' || o.type === 'market' || o.price === null) continue;
      orders.set(o.id, o);
      push(ordersBySymbol, o.symbol, o);
    }
    void prevOrd;

    const symbols = new Map<string, IndexSymbolDto>();
    for (const s of dto.symbols ?? []) symbols.set(s.id, s);

    this.accounts = accounts;
    this.positions = positions;
    this.orders = orders;
    this.positionsBySymbol = positionsBySymbol;
    this.ordersBySymbol = ordersBySymbol;
    this.positionsByAccount = positionsByAccount;
    if (symbols.size) this.symbols = symbols;
    this.lastRefreshAt = Date.now();
    this.refreshes++;
    for (const l of this.listeners) l(changed);
  }

  stats() {
    return { accounts: this.accounts.size, positions: this.positions.size, orders: this.orders.size, refreshes: this.refreshes, failures: this.failures, lastRefreshAt: this.lastRefreshAt };
  }
}

function push<T>(m: Map<string, T[]>, k: string, v: T) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}
