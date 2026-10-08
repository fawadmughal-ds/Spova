'use client';

import { memo, useMemo, useState, type CSSProperties } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MARKET_LIST } from '@/lib/markets';
import { Skeleton } from '@/components/ui';
import { fmtPrice, type SymbolSpec } from './format';
import { useQuote } from './quote-store';

const WatchRow = memo(function WatchRow({ s, selected, onSelect, index }: { s: SymbolSpec; selected: boolean; onSelect: (id: string) => void; index: number }) {
  const q = useQuote(s.id);
  const hasPrice = !!q && !!q.bid && !!q.ask;
  const closed = q?.open === false || !s.isOpen;
  const stale = !hasPrice || q.stale;
  const off = closed || stale;
  const mid = hasPrice ? (Number(q.bid) + Number(q.ask)) / 2 : null;
  const change = mid !== null && q?.ref ? ((mid - q.ref) / q.ref) * 100 : null;
  const reason = closed ? 'Market closed' : stale ? 'No live price' : undefined;
  return (
    <li style={{ animationDelay: `${Math.min(index, 20) * 25}ms` }} className="animate-page-in">
      <button
        type="button"
        onClick={() => onSelect(s.id)}
        title={reason ? `${s.name} · ${reason}` : s.name}
        aria-current={selected || undefined}
        className={cn(
          'group grid w-full grid-cols-[1fr_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-200',
          selected ? 'bg-brand-400/[0.08] ring-1 ring-inset ring-brand-400/25' : 'hover:bg-white/[0.04]',
          off && 'opacity-60',
        )}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className={cn('text-[13px] font-semibold', selected ? 'text-brand-300' : 'text-ink-100')}>{s.id}</span>
            {reason && <span className="rounded bg-white/[0.06] px-1 font-mono text-[9px] uppercase tracking-wider text-ink-500">{closed ? 'closed' : 'no price'}</span>}
          </span>
          <span className="block truncate text-[10px] text-ink-500">{s.name}</span>
        </span>
        <span className="text-right">
          {hasPrice ? (
            <span key={q.n} className={cn('tabular block font-mono text-[12px] leading-tight text-ink-100', !off && q.dir === 'up' && 'animate-flash-up', !off && q.dir === 'down' && 'animate-flash-down')}>
              {fmtPrice(q.bid, s.digits)}
              <span className="text-ink-500"> / </span>
              {fmtPrice(q.ask, s.digits)}
            </span>
          ) : (
            <span className="tabular block font-mono text-[12px] leading-tight text-ink-500">—</span>
          )}
          <span className={cn('tabular block font-mono text-[10px] leading-tight', change === null ? 'text-ink-500' : change > 0 ? 'text-up' : change < 0 ? 'text-down' : 'text-ink-400')}>
            {change === null ? '' : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`}
          </span>
        </span>
      </button>
    </li>
  );
});

/** Instruments grouped by asset class with live bid/ask. Click picks the chart symbol. */
export function Watchlist({ symbols, selected, onSelect, className }: { symbols: SymbolSpec[] | null; selected: string | null; onSelect: (id: string) => void; className?: string }) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    if (!symbols) return [];
    const q = query.trim().toUpperCase();
    const list = q ? symbols.filter((s) => s.id.includes(q) || s.name.toUpperCase().includes(q)) : symbols;
    return MARKET_LIST.map((m) => ({ meta: m, items: list.filter((s) => s.assetClass === m.cls) })).filter((g) => g.items.length > 0);
  }, [symbols, query]);

  let index = 0;
  return (
    <aside className={cn('flex min-h-0 flex-col bg-paper', className)}>
      <div className="flex items-center justify-between px-3 pb-1.5 pt-3">
        <span className="label">Watchlist</span>
        {symbols && <span className="label !text-ink-500">{symbols.length}</span>}
      </div>
      <label className="mx-2.5 mb-1.5 flex h-8 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs text-ink-500 transition-colors focus-within:border-brand-400/50">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search symbols" aria-label="Search symbols" className="min-w-0 flex-1 bg-transparent text-ink-100 placeholder:text-ink-500 focus:outline-none" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="rounded p-0.5 text-ink-500 hover:text-white">
            <X className="h-3 w-3" />
          </button>
        )}
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3 [scrollbar-width:thin]">
        {symbols === null &&
          Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="flex items-center justify-between px-2 py-2">
              <Skeleton className="w-20" />
              <Skeleton className="w-16" />
            </div>
          ))}
        {symbols && groups.length === 0 && <div className="px-3 py-8 text-center text-xs text-ink-500">No instrument matches “{query}”.</div>}
        {groups.map((g) => (
          <section key={g.meta.cls} className="mb-2" style={{ '--c': g.meta.rgb } as CSSProperties}>
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-paper/95 px-2 pb-1 pt-2 backdrop-blur">
              <span className="h-1.5 w-1.5 rotate-45 bg-[rgb(var(--c))]" />
              <span className="label !text-[rgb(var(--c))]">{g.meta.label}</span>
              <span className="h-px flex-1 bg-white/[0.06]" />
            </div>
            <ul className="space-y-px">
              {g.items.map((s) => (
                <WatchRow key={s.id} s={s} selected={s.id === selected} onSelect={onSelect} index={index++} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
