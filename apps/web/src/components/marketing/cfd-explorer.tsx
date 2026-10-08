'use client';

import Link from 'next/link';
import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowUpRight, Search, SearchX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MARKET_LIST } from '@/lib/markets';
import type { PublicSymbol } from '@/lib/server-api';

const num = (v: string | undefined) => (v === undefined ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 }));

/** Searchable, filterable contract-spec list. Every cell is a field the API returns; nothing is derived or assumed. */
export function CfdExplorer({ symbols }: { symbols: PublicSymbol[] }) {
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState<string>('all');

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => symbols.filter((s) => (cls === 'all' || s.assetClass === cls) && (!q || s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))),
    [symbols, cls, q],
  );
  const groups = MARKET_LIST.map((m) => ({ market: m, rows: matches.filter((s) => s.assetClass === m.cls) })).filter((g) => g.rows.length);
  const count = (c: string) => symbols.filter((s) => s.assetClass === c).length;
  const reset = () => {
    setQuery('');
    setCls('all');
  };

  return (
    <div>
      {/* toolbar */}
      <div className="glass sticky top-20 z-30 flex flex-wrap items-center gap-3 rounded-2xl p-2.5 shadow-lift">
        <label className="group relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition-colors group-focus-within:text-brand-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol or name, e.g. EURUSD or gold"
            aria-label="Search instruments"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-10 text-sm text-ink-100 placeholder:text-ink-500 transition-[border-color,box-shadow] duration-300 focus:border-brand-400/70 focus:outline-none focus:ring-4 focus:ring-brand-400/15"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-ink-200 transition-colors hover:bg-white/20">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          <button
            onClick={() => setCls('all')}
            className={cn('whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm transition-all duration-300', cls === 'all' ? 'bg-white text-ink-950' : 'text-ink-300 hover:bg-white/[0.06] hover:text-white')}
          >
            All <span className="tabular ml-1 font-mono text-xs opacity-60">{symbols.length}</span>
          </button>
          {MARKET_LIST.map((m) => (
            <button
              key={m.cls}
              onClick={() => setCls(cls === m.cls ? 'all' : m.cls)}
              style={{ '--c': m.rgb } as CSSProperties}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm transition-all duration-300',
                cls === m.cls ? 'bg-[rgb(var(--c)/0.16)] text-white ring-1 ring-inset ring-[rgb(var(--c)/0.45)]' : 'text-ink-300 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <m.icon className={cn('h-4 w-4 transition-colors', cls === m.cls && 'text-[rgb(var(--c))]')} />
              {m.label}
              <span className="tabular font-mono text-xs opacity-60">{count(m.cls)}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 px-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500" aria-live="polite">
        {matches.length} of {symbols.length} instruments{q && ` matching “${query.trim()}”`}
      </p>

      {/* groups */}
      <div key={`${cls}|${q}`} className="mt-4 space-y-6">
        {groups.map(({ market, rows }, g) => (
          <section key={market.cls} className="card animate-page-in overflow-hidden" style={{ '--c': market.rgb, animationDelay: `${g * 70}ms` } as CSSProperties}>
            <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] bg-[rgb(var(--c)/0.05)] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--c)/0.14)] text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.3)]">
                  <market.icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold">{market.label}</h2>
                  <p className="label">
                    {rows.length} {rows.length === 1 ? 'instrument' : 'instruments'} · {market.hours}
                  </p>
                </div>
              </div>
              <Link href={`/${market.slug}`} className="group inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--c))]">
                <span className="link-underline max-sm:hidden">About {market.label.toLowerCase()}</span>
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left">
                  <tr>
                    {['Symbol', 'Description', 'Contract size', 'Min lot', 'Max lot', 'Lot step', 'Max leverage', 'Status'].map((h, i) => (
                      <th key={h} className={cn('label px-5 py-3 font-medium', i > 1 && 'text-right')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => (
                    <tr key={s.id} className="animate-page-in group border-t border-white/[0.05] transition-colors duration-300 hover:bg-[rgb(var(--c)/0.05)]" style={{ animationDelay: `${g * 70 + Math.min(i, 12) * 35}ms` }}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--c)/0.1)] font-mono text-[9px] font-bold text-[rgb(var(--c))] ring-1 ring-inset ring-[rgb(var(--c)/0.2)] transition-transform duration-500 ease-spring group-hover:-rotate-6 group-hover:scale-110">
                            {s.id.slice(0, 3)}
                          </span>
                          <span className="font-mono font-semibold text-white">{s.id}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-300">{s.name}</td>
                      <td className="tabular px-5 py-3 text-right font-mono text-ink-100">{num(s.contractSize)}</td>
                      <td className="tabular px-5 py-3 text-right font-mono text-ink-300">{num(s.minLot)}</td>
                      <td className="tabular px-5 py-3 text-right font-mono text-ink-300">{num(s.maxLot)}</td>
                      <td className="tabular px-5 py-3 text-right font-mono text-ink-300">{num(s.lotStep)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="tabular rounded-md bg-white/[0.05] px-2 py-1 font-mono text-xs text-ink-100">1:{s.leverageMax}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={cn('inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em]', s.isOpen === false ? 'text-ink-500' : 'text-up')}>
                          <span className={cn('h-1.5 w-1.5 rounded-full bg-current', s.isOpen !== false && 'shadow-[0_0_8px_currentColor]')} />
                          {s.isOpen === false ? 'Closed' : 'Open'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {groups.length === 0 && (
          <div className="card bg-dots animate-pop-in flex flex-col items-center px-6 py-20 text-center">
            <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-ink-900 text-ink-300">
              <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-white/20" />
              <SearchX className="h-7 w-7" />
            </span>
            <h2 className="mt-6 text-2xl font-bold">{symbols.length ? 'No instrument matches that' : 'The list is unavailable right now'}</h2>
            <p className="mt-2 max-w-sm text-sm text-ink-400">
              {symbols.length ? 'Try a ticker such as EURUSD, a name such as “gold”, or clear the filters to see everything.' : 'We could not reach the platform to load contract specifications. Please try again in a moment.'}
            </p>
            {symbols.length > 0 && (
              <button onClick={reset} className="btn mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm text-ink-100 ring-1 ring-inset ring-white/10 hover:bg-white/[0.12]">
                <X className="h-4 w-4" /> Clear search and filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
