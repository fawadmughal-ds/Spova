import type { SymbolSpec } from './format';

/** Row of GET /market/sessions and of GET /market/symbols/:id .sessions ("HH:MM" UTC, weekday 0 = Sunday). */
export interface SessionRow {
  symbolId: string;
  weekday: number;
  openTime: string;
  closeTime: string;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** True when `now` falls inside one of the symbol's windows. No rows = 24/7. */
export function isOpenAt(rows: SessionRow[], now = new Date()) {
  if (rows.length === 0) return true;
  const day = now.getUTCDay();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return rows.some((s) => s.weekday === day && minutes >= toMin(s.openTime) && minutes < toMin(s.closeTime));
}

/** Next opening time after `now`, or null when the symbol never closes (or has no sessions). */
export function nextOpen(rows: SessionRow[], now = new Date()): Date | null {
  if (rows.length === 0) return null;
  let best: Date | null = null;
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    for (const s of rows) {
      if (s.weekday !== d.getUTCDay()) continue;
      const open = new Date(d.getTime() + toMin(s.openTime) * 60_000);
      if (open.getTime() > now.getTime() && (!best || open < best)) best = open;
    }
  }
  return best;
}

/** Next closing time while open, or null. */
export function nextClose(rows: SessionRow[], now = new Date()): Date | null {
  if (rows.length === 0) return null;
  const day = now.getUTCDay();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const s = rows.find((r) => r.weekday === day && minutes >= toMin(r.openTime) && minutes < toMin(r.closeTime));
  if (!s) return null;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(d.getTime() + toMin(s.closeTime) * 60_000);
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon–Fri 13:30–20:00 UTC" style summary (groups identical windows over consecutive days). */
export function sessionsLabel(rows: SessionRow[]) {
  if (rows.length === 0) return '24/7';
  const byWindow = new Map<string, number[]>();
  rows.forEach((r) => {
    const k = `${r.openTime}–${r.closeTime}`;
    byWindow.set(k, [...(byWindow.get(k) ?? []), r.weekday]);
  });
  return Array.from(byWindow.entries())
    .map(([win, days]) => {
      const d = Array.from(new Set(days)).sort((a, b) => a - b);
      const consecutive = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
      const label = d.length === 1 ? DAY[d[0]] : consecutive ? `${DAY[d[0]]}–${DAY[d[d.length - 1]]}` : d.map((x) => DAY[x]).join(', ');
      return `${label} ${win.replace('24:00', '24:00')} UTC`;
    })
    .join(' · ');
}

/** Sessions grouped by symbol id. */
export const groupSessions = (rows: SessionRow[]) => {
  const m = new Map<string, SessionRow[]>();
  rows.forEach((r) => m.set(r.symbolId, [...(m.get(r.symbolId) ?? []), r]));
  return m;
};

/** Market-hours summary per asset class: the first symbol of the class stands for the group. */
export function marketHours(symbols: SymbolSpec[], sessions: Map<string, SessionRow[]>) {
  const out = new Map<string, { rows: SessionRow[]; sample: string }>();
  symbols.forEach((s) => {
    if (!out.has(s.assetClass)) out.set(s.assetClass, { rows: sessions.get(s.id) ?? [], sample: s.id });
  });
  return out;
}
