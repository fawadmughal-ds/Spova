/**
 * Per-key trailing throttle: the first call emits immediately, further calls inside the window
 * replace the pending value and are flushed once at the end of the window (so the last price always goes out).
 */
export class Throttle<T> {
  private last = new Map<string, number>();
  private pending = new Map<string, { value: T; timer: NodeJS.Timeout }>();

  constructor(
    private readonly minIntervalMs: number,
    private readonly emit: (key: string, value: T) => void,
    private readonly now: () => number = Date.now,
  ) {}

  push(key: string, value: T) {
    const t = this.now();
    const prev = this.last.get(key) ?? -Infinity;
    const wait = this.minIntervalMs - (t - prev);
    if (wait <= 0 && !this.pending.has(key)) {
      this.last.set(key, t);
      this.emit(key, value);
      return;
    }
    const existing = this.pending.get(key);
    if (existing) {
      existing.value = value;
      return;
    }
    const timer = setTimeout(() => this.flush(key), Math.max(wait, 0));
    timer.unref?.();
    this.pending.set(key, { value, timer });
  }

  /** Emit a pending value now (used by tests and shutdown). */
  flush(key: string) {
    const p = this.pending.get(key);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(key);
    this.last.set(key, this.now());
    this.emit(key, p.value);
  }

  flushAll() {
    for (const k of [...this.pending.keys()]) this.flush(k);
  }

  pendingCount() {
    return this.pending.size;
  }
}

/** Remembers the last time an action ran per key; `tryAcquire` returns true at most once per window. */
export class OncePer {
  private seen = new Map<string, number>();
  constructor(
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}
  tryAcquire(key: string): boolean {
    const t = this.now();
    const prev = this.seen.get(key);
    if (prev !== undefined && t - prev < this.windowMs) return false;
    this.seen.set(key, t);
    return true;
  }
  release(key: string) {
    this.seen.delete(key);
  }
  /** Mark as acquired at `atMs` (used to seed from Redis after a restart). */
  seed(key: string, atMs: number) {
    this.seen.set(key, atMs);
  }
}
