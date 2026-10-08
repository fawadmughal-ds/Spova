'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MARKET_LIST, type MarketMeta } from '@/lib/markets';
import type { PublicSession, PublicSymbol } from '@/lib/server-api';

/** Trading hours, all in UTC. weekday 0 = Sunday; a symbol with no session rows trades around the clock. */

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_MIN = 7 * 1440;

interface Window {
  weekday: number;
  open: number;
  close: number;
}
export interface HoursGroup {
  key: string;
  market: MarketMeta;
  symbols: PublicSymbol[];
  windows: Window[];
  always: boolean;
}

const mins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Symbols that share an asset class and an identical weekly schedule collapse into one row. */
export function groupHours(symbols: PublicSymbol[], sessions: PublicSession[]): HoursGroup[] {
  const bySymbol = new Map<string, Window[]>();
  for (const s of sessions) {
    const list = bySymbol.get(s.symbolId) ?? [];
    list.push({ weekday: s.weekday, open: mins(s.openTime), close: mins(s.closeTime) });
    bySymbol.set(s.symbolId, list);
  }
  const groups = new Map<string, HoursGroup>();
  for (const sym of symbols) {
    const market = MARKET_LIST.find((m) => m.cls === sym.assetClass);
    if (!market) continue;
    const windows = (bySymbol.get(sym.id) ?? []).sort((a, b) => a.weekday - b.weekday || a.open - b.open);
    const key = `${market.cls}|${windows.map((w) => `${w.weekday}:${w.open}-${w.close}`).join(',')}`;
    const g = groups.get(key) ?? { key, market, symbols: [], windows, always: windows.length === 0 };
    g.symbols.push(sym);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => MARKET_LIST.indexOf(a.market) - MARKET_LIST.indexOf(b.market));
}

const openAt = (g: HoursGroup, weekMin: number) => {
  if (g.always) return true;
  const day = Math.floor(weekMin / 1440) % 7;
  const m = weekMin % 1440;
  return g.windows.some((w) => w.weekday === day && m >= w.open && m < w.close);
};

/** Whether the group trades right now and how many minutes until that flips (null = never). */
function status(g: HoursGroup, now: Date) {
  const start = now.getUTCDay() * 1440 + now.getUTCHours() * 60 + now.getUTCMinutes();
  const open = openAt(g, start);
  if (g.always) return { open, flipsIn: null as number | null };
  for (let d = 1; d <= WEEK_MIN; d++) if (openAt(g, (start + d) % WEEK_MIN) !== open) return { open, flipsIn: d };
  return { open, flipsIn: null as number | null };
}

const span = (m: number) => {
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${String(mm).padStart(2, '0')}m` : `${mm}m`;
};

/** Current time, client-only (null during SSR and the first paint) so server and browser never disagree. */
function useNow(everyMs = 20_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

// ---------------------------------------------------------------- hero board
/** Departure-board view: one line per schedule with a live open / closed state. */
export function HoursBoard({ symbols, sessions }: { symbols: PublicSymbol[]; sessions: PublicSession[] }) {
  const groups = useMemo(() => groupHours(symbols, sessions), [symbols, sessions]);
  const now = useNow(1000);

  return (
    <div className="relative mx-auto max-w-lg">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-brand-500/10 blur-3xl" />
      <div className="glass corners overflow-hidden rounded-3xl shadow-lift">
        <div className="flex items-end justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="label">Platform time</div>
            <div className="tabular mt-1 font-mono text-3xl font-semibold tracking-tight">
              {now ? (
                <>
                  {String(now.getUTCHours()).padStart(2, '0')}
                  <span className="animate-blink">:</span>
                  {String(now.getUTCMinutes()).padStart(2, '0')}
                  <span className="text-ink-500">:{String(now.getUTCSeconds()).padStart(2, '0')}</span>
                </>
              ) : (
                '--:--'
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="label">UTC</div>
            <div className="mt-1 font-mono text-sm text-ink-200">{now ? now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'}</div>
          </div>
        </div>
        <ul>
          {groups.map((g, i) => {
            const st = now ? status(g, now) : null;
            return (
              <li
                key={g.key}
                style={{ '--c': g.market.rgb, animationDelay: `${300 + i * 70}ms` } as CSSProperties}
                className="animate-page-in flex items-center justify-between gap-4 border-t border-white/[0.05] px-5 py-3.5 first:border-t-0"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--c)/0.12)] text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.25)]">
                    <g.market.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{g.market.label}</span>
                    <span className="block truncate font-mono text-[10px] text-ink-500">
                      {g.symbols
                        .slice(0, 3)
                        .map((s) => s.id)
                        .join(' · ')}
                      {g.symbols.length > 3 && ` +${g.symbols.length - 3}`}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={cn('inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-500', !st ? 'text-ink-600' : st.open ? 'text-up' : 'text-ink-400')}>
                    {st?.open ? <span className="live-dot !h-1.5 !w-1.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    {!st ? '· · ·' : st.open ? 'Open' : 'Closed'}
                  </span>
                  <span className="tabular block font-mono text-[10px] text-ink-500">
                    {!st ? ' ' : st.flipsIn === null ? 'around the clock' : `${st.open ? 'closes' : 'opens'} in ${span(st.flipsIn)}`}
                  </span>
                </span>
              </li>
            );
          })}
          {groups.length === 0 && <li className="px-5 py-10 text-center text-sm text-ink-500">Trading hours are unavailable right now.</li>}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- week timeline
/** The full week as seven 24-hour tracks per schedule, with a marker at the current UTC time. */
export function HoursTimeline({ symbols, sessions }: { symbols: PublicSymbol[]; sessions: PublicSession[] }) {
  const groups = useMemo(() => groupHours(symbols, sessions), [symbols, sessions]);
  const now = useNow();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const today = now?.getUTCDay();
  const nowPct = now ? ((now.getUTCHours() * 60 + now.getUTCMinutes()) / 1440) * 100 : 0;

  if (groups.length === 0) return <div className="card bg-dots px-6 py-16 text-center text-sm text-ink-400">Trading hours are unavailable right now. Please try again in a moment.</div>;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          {/* day header */}
          <div className="grid grid-cols-[230px_repeat(7,1fr)] gap-2 border-b border-white/[0.06] px-5 py-3">
            <span className="label self-end">Schedule · UTC</span>
            {DAY_ORDER.map((d) => (
              <div key={d} className="text-center">
                <span className={cn('label inline-flex items-center gap-1.5 transition-colors duration-500', d === today && '!text-brand-300')}>
                  {d === today && <span className="live-dot !h-1.5 !w-1.5" />}
                  {DAY_NAMES[d]}
                </span>
                <div className="mt-1 flex justify-between font-mono text-[8px] text-ink-600">
                  <span>00</span>
                  <span>12</span>
                  <span />
                </div>
              </div>
            ))}
          </div>

          {groups.map((g, gi) => {
            const st = now ? status(g, now) : null;
            const expanded = openKey === g.key;
            return (
              <div key={g.key} style={{ '--c': g.market.rgb } as CSSProperties} className="group/row border-t border-white/[0.05] transition-colors duration-300 first:border-t-0 hover:bg-[rgb(var(--c)/0.04)]">
                <div className="grid grid-cols-[230px_repeat(7,1fr)] items-center gap-2 px-5 py-4">
                  <button onClick={() => setOpenKey(expanded ? null : g.key)} aria-expanded={expanded} className="flex items-center gap-3 text-left">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--c)/0.12)] text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.25)] transition-transform duration-500 ease-spring group-hover/row:-rotate-6 group-hover/row:scale-110">
                      <g.market.icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {g.market.label}
                        <ChevronDown className={cn('h-3.5 w-3.5 text-ink-500 transition-transform duration-300', expanded && 'rotate-180')} />
                      </span>
                      <span className={cn('font-mono text-[10px] uppercase tracking-[0.12em]', !st ? 'text-ink-600' : st.open ? 'text-up' : 'text-ink-500')}>
                        {g.symbols.length} {g.symbols.length === 1 ? 'instrument' : 'instruments'}
                        {st && ` · ${st.open ? 'open' : 'closed'}`}
                      </span>
                    </span>
                  </button>

                  {DAY_ORDER.map((d, di) => {
                    const wins = g.always ? [{ weekday: d, open: 0, close: 1440 }] : g.windows.filter((w) => w.weekday === d);
                    return (
                      <div key={d} className="relative h-9 overflow-hidden rounded-lg bg-white/[0.04]" title={wins.length ? wins.map((w) => `${hhmm(w.open)}–${w.close === 1440 ? '24:00' : hhmm(w.close)} UTC`).join(', ') : 'Closed'}>
                        <span className="absolute inset-y-0 left-1/2 w-px bg-white/[0.06]" />
                        {wins.map((w) => (
                          <span
                            key={w.open}
                            className="grow-x absolute inset-y-1 rounded-md bg-gradient-to-r from-[rgb(var(--c)/0.55)] to-[rgb(var(--c)/0.9)] shadow-[0_0_14px_-3px_rgb(var(--c)/0.8)]"
                            style={{ left: `${(w.open / 1440) * 100}%`, width: `${((w.close - w.open) / 1440) * 100}%`, '--d': `${gi * 90 + di * 50}ms` } as CSSProperties}
                          />
                        ))}
                        {wins.length === 0 && <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] uppercase tracking-[0.14em] text-ink-600">closed</span>}
                        {d === today && <span className="absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_10px_2px_rgb(var(--tint)/0.7)]" style={{ left: `${nowPct}%` }} />}
                      </div>
                    );
                  })}
                </div>

                {/* per-instrument detail */}
                <div className={cn('grid transition-[grid-template-rows] duration-500 ease-out-expo', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="overflow-hidden">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/[0.05] bg-ink-900/50 px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {g.symbols.map((s) => (
                          <span key={s.id} title={s.name} className="rounded-md bg-[rgb(var(--c)/0.1)] px-2 py-1 font-mono text-[11px] text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.2)]">
                            {s.id}
                          </span>
                        ))}
                      </div>
                      <div className="font-mono text-[11px] leading-relaxed text-ink-400">
                        {g.always
                          ? 'Trades around the clock, every day.'
                          : DAY_ORDER.filter((d) => g.windows.some((w) => w.weekday === d))
                              .map(
                                (d) =>
                                  `${DAY_NAMES[d]} ${g.windows
                                    .filter((w) => w.weekday === d)
                                    .map((w) => `${hhmm(w.open)}–${w.close === 1440 ? '24:00' : hhmm(w.close)}`)
                                    .join(', ')}`,
                              )
                              .join('  ·  ')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3.5 text-xs text-ink-500">
        <span>All times UTC. Click a row for its instruments and exact hours.</span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-0.5 bg-white shadow-[0_0_8px_1px_rgb(var(--tint)/0.7)]" /> now{now && ` · ${hhmm(now.getUTCHours() * 60 + now.getUTCMinutes())} UTC`}
        </span>
      </div>
    </div>
  );
}
