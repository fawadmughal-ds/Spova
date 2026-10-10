export interface SessionRow {
  /** 0 = Sunday ... 6 = Saturday (UTC) */
  weekday: number;
  /** "HH:MM" UTC */
  openTime: string;
  /** "HH:MM" UTC, "24:00" allowed */
  closeTime: string;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * A symbol with no session rows trades 24/7. Otherwise it is open when the UTC weekday has a
 * window with open <= now < close. A window with close < open wraps past midnight within the same weekday row.
 */
export function isSessionOpen(sessions: SessionRow[], now: Date): boolean {
  if (sessions.length === 0) return true;
  const weekday = now.getUTCDay();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  for (const s of sessions) {
    const open = toMinutes(s.openTime);
    const close = toMinutes(s.closeTime);
    if (s.weekday === weekday) {
      if (close >= open ? minutes >= open && minutes < close : minutes >= open || minutes < close) return true;
    } else if (close < open && s.weekday === (weekday + 6) % 7) {
      // previous day's window wrapping past midnight
      if (minutes < close) return true;
    }
  }
  return false;
}
