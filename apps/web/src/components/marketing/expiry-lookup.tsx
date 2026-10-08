'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { ArrowRight, CalendarOff, Infinity as InfinityIcon, Search, SearchX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MARKET_LIST, marketByCls } from '@/lib/markets';
import type { PublicSymbol } from '@/lib/server-api';

/**
 * Expiry calendar. The platform has no expiring contracts yet (symbols carry no expiry date), so the table
 * shows its empty state, and searching answers the real question: "does the instrument I trade expire?"
 */
export function ExpiryLookup({ symbols }: { symbols: PublicSymbol[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const hits = q ? symbols.filter((s) => s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)).slice(0, 8) : [];

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] p-2.5">
        <label className="group relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition-colors group-focus-within:text-brand-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Check an instrument, e.g. USOIL or gold"
            aria-label="Check whether an instrument expires"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-10 text-sm text-ink-100 placeholder:text-ink-500 transition-[border-color,box-shadow] duration-300 focus:border-brand-400/70 focus:outline-none focus:ring-4 focus:ring-brand-400/15"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-ink-200 transition-colors hover:bg-white/20">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <span className="mr-2 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-500" /> 0 expiring contracts
        </span>
      </div>

      {/* the calendar's columns stay visible so the page reads as a table that happens to be empty */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[1.2fr_1.6fr_1fr_1fr_1fr] gap-4 border-b border-white/[0.06] px-5 py-3">
            {['Symbol', 'Description', 'Contract', 'Last trading day', 'Rolls to'].map((h) => (
              <span key={h} className="label">
                {h}
              </span>
            ))}
          </div>

          <div key={q} aria-live="polite">
            {q && hits.length > 0 &&
              hits.map((s, i) => {
                const m = marketByCls(s.assetClass);
                return (
                  <div
                    key={s.id}
                    style={{ '--c': m?.rgb ?? '15 23 42', animationDelay: `${i * 40}ms` } as CSSProperties}
                    className="animate-page-in grid grid-cols-[1.2fr_1.6fr_1fr_1fr_1fr] items-center gap-4 border-b border-white/[0.05] px-5 py-3.5 transition-colors duration-300 hover:bg-[rgb(var(--c)/0.05)]"
                  >
                    <span className="flex items-center gap-3">
                      <span className="h-7 w-1 rounded-full bg-[rgb(var(--c))]" />
                      <span className="font-mono font-semibold text-white">{s.id}</span>
                    </span>
                    <span className="truncate text-sm text-ink-300">{s.name}</span>
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-up">
                      <InfinityIcon className="h-3.5 w-3.5" /> Cash CFD
                    </span>
                    <span className="font-mono text-xs text-ink-500">No expiry</span>
                    <span className="font-mono text-xs text-ink-500">—</span>
                  </div>
                );
              })}

            {q && hits.length === 0 && (
              <div className="bg-dots animate-pop-in flex flex-col items-center px-6 py-16 text-center">
                <SearchX className="h-8 w-8 text-ink-500" />
                <p className="mt-4 font-semibold">“{query.trim()}” is not a listed instrument</p>
                <p className="mt-1 text-sm text-ink-400">
                  Check the spelling or browse the{' '}
                  <Link href="/cfds-list" className="text-brand-300 underline-offset-4 hover:underline">
                    full CFD list
                  </Link>
                  .
                </p>
              </div>
            )}

            {!q && (
              <div className="relative overflow-hidden">
                {/* ghost rows: what the calendar looks like once a contract is listed */}
                <div aria-hidden className="opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]">
                  {[0, 1, 2, 3, 4].map((r) => (
                    <div key={r} className="grid grid-cols-[1.2fr_1.6fr_1fr_1fr_1fr] gap-4 border-b border-white/[0.04] px-5 py-4">
                      {[40, 70, 50, 60, 45].map((w, c) => (
                        <span key={c} className="skeleton h-3" style={{ width: `${w - r * 4}%` }} />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-ink-900 text-ink-200 shadow-lift">
                    <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-white/20" />
                    <CalendarOff className="h-6 w-6" />
                  </span>
                  <p className="mt-5 text-xl font-bold">No expiring contracts are listed</p>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-300">
                    {symbols.length > 0 ? `All ${symbols.length} instruments on the platform today are cash CFDs with no expiry date.` : 'Every instrument on the platform today is a cash CFD with no expiry date.'} Type a ticker above to check one.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {MARKET_LIST.filter((m) => symbols.some((s) => s.assetClass === m.cls)).map((m) => (
            <span key={m.cls} style={{ '--c': m.rgb } as CSSProperties} className={cn('inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-300')}>
              <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--c))]" />
              {m.label} · {symbols.filter((s) => s.assetClass === m.cls).length} cash
            </span>
          ))}
        </div>
        <Link href="/cfds-list" className="group inline-flex items-center gap-1.5 text-sm font-medium text-brand-300">
          <span className="link-underline">Full CFD list</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
