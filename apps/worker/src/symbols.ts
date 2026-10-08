import type { Db } from './db';
import type { Logger } from './logger';
import { isSessionOpen, type SessionRow } from './feeds/sessions';

export interface SymbolMeta {
  id: string;
  assetClass: string;
  digits: number;
  contractSize: string;
  leverageMax: number;
  spreadMarkup: string;
  feedSource: string;
  feedSymbol: string;
  enabled: boolean;
  sessions: SessionRow[];
  /** YYYY-MM-DD full-day closures */
  holidays: Set<string>;
}

/**
 * In-memory copy of the `symbols` + `symbol_sessions` + `symbol_holidays` tables.
 * Reloaded periodically so admin toggles (enabled, spread) apply without a restart.
 */
export class SymbolRegistry {
  private bySymbol = new Map<string, SymbolMeta>();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly db: Db,
    private readonly log: Logger,
  ) {}

  async load() {
    const rows = await this.db.symbol.findMany({ include: { sessions: true, holidays: true } });
    const next = new Map<string, SymbolMeta>();
    for (const r of rows) {
      next.set(r.id, {
        id: r.id,
        assetClass: r.assetClass,
        digits: r.digits,
        contractSize: r.contractSize.toString(),
        leverageMax: r.leverageMax,
        spreadMarkup: r.spreadMarkup.toString(),
        feedSource: r.feedSource,
        feedSymbol: r.feedSymbol,
        enabled: r.enabled,
        sessions: r.sessions.map((s) => ({ weekday: s.weekday, openTime: s.openTime, closeTime: s.closeTime })),
        holidays: new Set(r.holidays.map((h) => h.date.toISOString().slice(0, 10))),
      });
    }
    this.bySymbol = next;
    this.log.debug({ symbols: next.size }, 'symbol registry loaded');
  }

  startAutoReload(ms = 60_000) {
    this.timer = setInterval(() => void this.load().catch((e) => this.log.warn({ err: e }, 'symbol registry reload failed')), ms);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  get(id: string): SymbolMeta | undefined {
    return this.bySymbol.get(id);
  }

  all(): SymbolMeta[] {
    return [...this.bySymbol.values()];
  }

  enabled(): SymbolMeta[] {
    return this.all().filter((s) => s.enabled);
  }

  /** feedSymbol -> symbol id for one feed source (enabled symbols only). */
  feedMap(source: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const s of this.enabled()) if (s.feedSource === source) out[s.feedSymbol] = s.id;
    return out;
  }

  isOpen(id: string, now = new Date()): boolean {
    const s = this.bySymbol.get(id);
    if (!s) return false;
    if (s.holidays.has(now.toISOString().slice(0, 10))) return false;
    return isSessionOpen(s.sessions, now);
  }
}
