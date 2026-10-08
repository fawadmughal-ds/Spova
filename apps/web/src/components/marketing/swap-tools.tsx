'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowDownUp, Minus, Plus, Search, SearchX, TrendingDown, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MARKET_LIST, marketByCls } from '@/lib/markets';
import type { PublicSymbol } from '@/lib/server-api';
import { AnimatedNumber } from '@/components/motion';

const rate = (s: PublicSymbol, side: 'long' | 'short') => Number((side === 'long' ? s.swapLong : s.swapShort) ?? 0);
const signed = (n: number, digits = 2) => `${n > 0 ? '+' : n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const tone = (n: number) => (n > 0 ? 'text-up' : n < 0 ? 'text-down' : 'text-ink-300');

// ---------------------------------------------------------------- calculator
/** swap = lots x nightly rate, with each Wednesday rollover counted three times. */
export function SwapCalculator({ symbols }: { symbols: PublicSymbol[] }) {
  const [id, setId] = useState(symbols[0]?.id ?? '');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [lots, setLots] = useState(1);
  const [nights, setNights] = useState(5);
  const [weds, setWeds] = useState(1);

  const sym = symbols.find((s) => s.id === id) ?? symbols[0];
  if (!sym) return null;
  const market = marketByCls(sym.assetClass);
  const maxLots = Math.min(Number(sym.maxLot ?? 50), 10);
  const vol = Math.min(lots, maxLots);
  const wed = Math.min(weds, nights);
  const charged = nights + wed * 2;
  const perNight = vol * rate(sym, side);
  const total = perNight * charged;
  const featured = symbols.filter((s) => s.featured || s.id === sym.id);

  const stepper = (value: number, set: (n: number) => void, min: number, max: number, label: string) => (
    <div className="flex items-center gap-2">
      <button
        aria-label={`Fewer ${label}`}
        onClick={() => set(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-ink-200 transition-colors hover:bg-white/[0.1] disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="tabular w-10 text-center font-mono text-lg text-white">{value}</span>
      <button
        aria-label={`More ${label}`}
        onClick={() => set(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-ink-200 transition-colors hover:bg-white/[0.1] disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="card corners grid overflow-hidden lg:grid-cols-[1.1fr_1fr]" style={{ '--c': market?.rgb ?? '37 99 235' } as CSSProperties}>
      <div className="space-y-7 p-6 sm:p-8">
        <div>
          <div className="label mb-2.5">Instrument</div>
          <div className="flex flex-wrap gap-1.5">
            {featured.map((s) => (
              <button
                key={s.id}
                onClick={() => setId(s.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 font-mono text-xs transition-all duration-300',
                  s.id === sym.id ? 'bg-[rgb(var(--c)/0.15)] text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.4)]' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                {s.id}
              </button>
            ))}
            <select
              aria-label="More instruments"
              value=""
              onChange={(e) => e.target.value && setId(e.target.value)}
              className="rounded-lg bg-white/[0.04] px-2 py-1.5 font-mono text-xs text-ink-300 outline-none transition-colors hover:bg-white/[0.08]"
            >
              <option value="">More…</option>
              {symbols
                .filter((s) => !s.featured)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <div className="label mb-2.5">Direction</div>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-white/[0.04] p-1">
            {(['long', 'short'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setSide(d)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all duration-300',
                  side === d ? (d === 'long' ? 'bg-up/15 text-up ring-1 ring-inset ring-up/35' : 'bg-down/15 text-down ring-1 ring-inset ring-down/35') : 'text-ink-300 hover:text-white',
                )}
              >
                {d === 'long' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {d === 'long' ? 'Long (buy)' : 'Short (sell)'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="label">Volume</span>
            <span className="tabular font-mono text-sm text-white">
              {vol.toFixed(2)} <span className="text-ink-500">lots</span>
            </span>
          </div>
          <input
            type="range"
            aria-label="Volume in lots"
            min={0.01}
            max={maxLots}
            step={0.01}
            value={vol}
            onChange={(e) => setLots(Number(e.target.value))}
            className="range"
            style={{ '--fill': `${(vol / maxLots) * 100}%` } as CSSProperties}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="label mb-2.5">Nights held</div>
            {stepper(nights, setNights, 1, 30, 'nights')}
          </div>
          <div>
            <div className="label mb-2.5">Of which Wednesday rollovers</div>
            {stepper(wed, setWeds, 0, Math.min(nights, Math.ceil(nights / 7)), 'Wednesday rollovers')}
          </div>
        </div>
      </div>

      {/* result */}
      <div className="relative border-t border-white/[0.06] bg-ink-900/60 p-6 sm:p-8 lg:border-l lg:border-t-0">
        <div className="bg-dots absolute inset-0 opacity-60" />
        <div className="relative">
          <div className="label">{total > 0 ? 'Swap credited' : total < 0 ? 'Swap charged' : 'Swap'}</div>
          <div className={cn('mt-2 font-display text-5xl font-bold tracking-tight transition-colors duration-500 sm:text-6xl', tone(total))}>
            <AnimatedNumber value={total} format={(n) => signed(n)} flash={false} duration={500} />
          </div>
          <p className="mt-2 font-mono text-[11px] text-ink-500">
            {vol.toFixed(2)} lots × {signed(rate(sym, side))} × {charged} charged nights
          </p>

          <dl className="mt-7 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-6">
            <div>
              <dt className="label">Per night</dt>
              <dd className={cn('mt-1 font-mono text-lg', tone(perNight))}>
                <AnimatedNumber value={perNight} format={(n) => signed(n)} flash={false} duration={500} />
              </dd>
            </div>
            <div>
              <dt className="label">Charged nights</dt>
              <dd className="mt-1 font-mono text-lg">
                {charged}
                {wed > 0 && <span className="ml-2 text-xs text-ink-500">{nights} + {wed} × 2</span>}
              </dd>
            </div>
          </dl>

          {/* one cell per charged night; Wednesday rollovers take three */}
          <div className="mt-7">
            <div className="label mb-2.5">Rollovers</div>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: nights }, (_, i) => {
                const triple = i < wed;
                return (
                  <span
                    key={`${nights}-${wed}-${i}`}
                    style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }}
                    className={cn(
                      'animate-pop-in flex h-7 items-center justify-center rounded-md font-mono text-[10px] font-semibold',
                      triple ? 'w-[3.75rem] bg-gold/15 text-gold ring-1 ring-inset ring-gold/35' : cn('w-7', total >= 0 ? 'bg-up/15 text-up' : 'bg-down/15 text-down'),
                    )}
                  >
                    {triple ? 'WED ×3' : ''}
                  </span>
                );
              })}
            </div>
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-ink-500">Estimate in USD at today&apos;s published rates. Rates can change while a position is open; the amount actually posted is the one in your statement.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- table
type SortKey = 'id' | 'long' | 'short';

/** Long / short nightly rate for every instrument, with a bar that shows which way the money flows. */
export function SwapTable({ symbols }: { symbols: PublicSymbol[] }) {
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'id', dir: 1 });

  const q = query.trim().toLowerCase();
  const scale = useMemo(() => Math.max(1, ...symbols.flatMap((s) => [Math.abs(rate(s, 'long')), Math.abs(rate(s, 'short'))])), [symbols]);
  const rows = useMemo(() => {
    const list = symbols.filter((s) => (cls === 'all' || s.assetClass === cls) && (!q || s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)));
    if (sort.key === 'id') return sort.dir === 1 ? list : [...list].reverse();
    const k = sort.key;
    return [...list].sort((a, b) => (rate(a, k) - rate(b, k)) * sort.dir);
  }, [symbols, cls, q, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'id' ? 1 : -1 }));
  const bar = (n: number) => (
    <span className="relative hidden h-1.5 w-28 rounded-full bg-white/[0.06] md:block">
      <span className="absolute inset-y-[-2px] left-1/2 w-px bg-white/20" />
      <span
        className={cn('absolute inset-y-0 rounded-full transition-all duration-700 ease-out-expo', n >= 0 ? 'left-1/2 bg-up' : 'right-1/2 bg-down')}
        style={{ width: `${(Math.sqrt(Math.abs(n) / scale) * 50).toFixed(1)}%` }}
      />
    </span>
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] p-2.5">
        <label className="group relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition-colors group-focus-within:text-brand-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol or name"
            aria-label="Search swap rates"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-9 text-sm text-ink-100 placeholder:text-ink-500 transition-[border-color,box-shadow] duration-300 focus:border-brand-400/70 focus:outline-none focus:ring-4 focus:ring-brand-400/15"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-ink-200 hover:bg-white/20">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          <button onClick={() => setCls('all')} className={cn('whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-all duration-300', cls === 'all' ? 'bg-white text-ink-950' : 'text-ink-300 hover:bg-white/[0.06] hover:text-white')}>
            All
          </button>
          {MARKET_LIST.filter((m) => symbols.some((s) => s.assetClass === m.cls)).map((m) => (
            <button
              key={m.cls}
              onClick={() => setCls(cls === m.cls ? 'all' : m.cls)}
              style={{ '--c': m.rgb } as CSSProperties}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-all duration-300',
                cls === m.cls ? 'bg-[rgb(var(--c)/0.16)] text-white ring-1 ring-inset ring-[rgb(var(--c)/0.45)]' : 'text-ink-300 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm sm:min-w-[620px]">
          <thead>
            <tr>
              {(
                [
                  ['id', 'Instrument', 'text-left'],
                  ['long', 'Long', 'text-right'],
                  ['short', 'Short', 'text-right'],
                ] as [SortKey, string, string][]
              ).map(([key, label, align]) => (
                <th key={key} className={cn('px-3 py-3 sm:px-5', align)} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button onClick={() => toggle(key)} className={cn('label inline-flex items-center gap-1.5 font-medium transition-colors hover:text-white', sort.key === key && '!text-brand-300')}>
                    {label}
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={`${cls}|${q}|${sort.key}|${sort.dir}`}>
            {rows.map((s, i) => {
              const m = marketByCls(s.assetClass);
              const l = rate(s, 'long');
              const sh = rate(s, 'short');
              return (
                <tr
                  key={s.id}
                  style={{ '--c': m?.rgb ?? '15 23 42', animationDelay: `${Math.min(i, 14) * 30}ms` } as CSSProperties}
                  className="animate-page-in group border-t border-white/[0.05] transition-colors duration-300 hover:bg-[rgb(var(--c)/0.05)]"
                >
                  <td className="px-3 py-3 sm:px-5">
                    <span className="flex items-center gap-3">
                      <span className="h-8 w-1 shrink-0 rounded-full bg-[rgb(var(--c)/0.7)] transition-all duration-500 group-hover:h-9 group-hover:bg-[rgb(var(--c))]" />
                      <span>
                        <span className="block font-mono font-semibold text-white">{s.id}</span>
                        <span className="block max-w-[120px] truncate text-xs text-ink-500 sm:max-w-none">
                          <span className="max-sm:hidden">{s.name} · </span>
                          {m?.label ?? s.assetClass}
                        </span>
                      </span>
                    </span>
                  </td>
                  {[l, sh].map((n, k) => (
                    <td key={k} className="px-3 py-3 sm:px-5">
                      <span className="flex items-center justify-end gap-4">
                        {bar(n)}
                        <span className={cn('tabular w-16 text-right font-mono font-semibold sm:w-20', tone(n))}>{signed(n)}</span>
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="bg-dots animate-pop-in flex flex-col items-center px-6 py-16 text-center">
          <SearchX className="h-8 w-8 text-ink-500" />
          <p className="mt-4 font-semibold">{symbols.length ? 'No instrument matches that' : 'Swap rates are unavailable right now'}</p>
          <p className="mt-1 text-sm text-ink-400">{symbols.length ? 'Try a ticker such as XAUUSD or clear the filter.' : 'We could not reach the platform. Please try again in a moment.'}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3.5 text-xs text-ink-500">
        <span>
          {rows.length} of {symbols.length} instruments · USD per lot, per night
        </span>
        <span className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-up" /> credited to you
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-down" /> charged to you
          </span>
        </span>
      </div>
    </div>
  );
}
