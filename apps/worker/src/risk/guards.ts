import { dec, type Dec } from '@spova/shared';

export type AccountAction = 'stop_out' | 'margin_call' | null;

/**
 * Pure decision: margin level <= stopOutPct -> stop-out; <= marginCallPct -> margin call; otherwise nothing.
 * A null level (no used margin) never triggers anything.
 */
export function decideAccountAction(marginLevel: Dec | null, cfg: { marginCallPct: string | number; stopOutPct: string | number }): AccountAction {
  if (marginLevel === null) return null;
  if (marginLevel.lte(dec(cfg.stopOutPct))) return 'stop_out';
  if (marginLevel.lte(dec(cfg.marginCallPct))) return 'margin_call';
  return null;
}

/**
 * Tracks requests that are already on their way to the API so a tick storm does not fire the same
 * close/fill/stop-out many times. Entries expire after `ttlMs` in case the API never answers.
 */
export class Inflight {
  private m = new Map<string, number>();
  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}
  /** true when the caller may proceed (nothing in flight for this key). */
  begin(key: string): boolean {
    const t = this.now();
    const until = this.m.get(key);
    if (until !== undefined && until > t) return false;
    this.m.set(key, t + this.ttlMs);
    return true;
  }
  end(key: string) {
    this.m.delete(key);
  }
  has(key: string) {
    const until = this.m.get(key);
    return until !== undefined && until > this.now();
  }
}
