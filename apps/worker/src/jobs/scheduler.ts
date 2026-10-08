/** ms from `now` until the next HH:MM:SS UTC (today if still ahead, otherwise tomorrow). */
export function msUntilUtc(hour: number, minute = 0, second = 0, now = new Date()): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, second));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

export const utcDate = (d = new Date()) => d.toISOString().slice(0, 10);

/** Runs `fn` once a day at the given UTC time; errors are reported, never thrown. Returns a stop handle. */
export function daily(hour: number, minute: number, second: number, fn: () => Promise<void>, onError: (e: unknown) => void) {
  let timer: NodeJS.Timeout | undefined;
  const arm = () => {
    timer = setTimeout(async () => {
      try {
        await fn();
      } catch (e) {
        onError(e);
      }
      arm();
    }, msUntilUtc(hour, minute, second));
    timer.unref();
  };
  arm();
  return () => timer && clearTimeout(timer);
}
