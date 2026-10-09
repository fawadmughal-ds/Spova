'use client';

import { memo, useMemo, useState } from 'react';
import { Compass, Moon, Search, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MARKET_LIST } from '@/lib/markets';
import { Skeleton } from '@/components/ui';
import { dailyChange, fmtPct, fmtPrice, spreadPoints, type SymbolSpec } from './format';
import { useQuote } from './quote-store';
import { EmptyState, SymbolTile } from './bits';
import { toggleFavourite, useFavourites } from './settings';

const ExploreRow = memo(function ExploreRow({ s, onTrade }: { s: SymbolSpec; onTrade: (id: string) => void }) {
  const q = useQuote(s.id);
  const favs = useFavourites();
  const fav = favs.ids.includes(s.id);
  const has = !!q && !!q.bid && !!q.ask;
  const closed = q?.open === false || (q?.open === undefined && !s.isOpen);
  const change = dailyChange(q);
  return (
    <li className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-[var(--t-line)] px-4 py-2 sm:grid-cols-[26px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_88px_auto]">
      <SymbolTile spec={s} />
      <span className="min-w-0 leading-tight">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold text-white">
          {s.id}
          {closed && <Moon className="h-3 w-3 text-[#e8b339]" />}
        </span>
        <span className="block truncate text-[11px] text-[var(--t-muted)]">{s.name}</span>
      </span>
      <span className="hidden text-right text-[14px] text-white sm:block">
        {has ? fmtPrice((Number(q.bid) + Number(q.ask)) / 2, s.digits) : '—'}
        <span className="block text-[11px] text-[var(--t-muted)]">Spread: {has ? spreadPoints(q.bid, q.ask, s.digits) : '—'}</span>
      </span>
      <span className={cn('hidden text-right text-[14px] font-semibold sm:block', change === null ? 'text-[var(--t-dim)]' : change > 0 ? 't-pnl-up' : change < 0 ? 't-pnl-down' : 'text-[var(--t-text-2)]')}>{change === null ? '—' : fmtPct(change)}</span>
      <span className="hidden text-right text-[12px] text-[var(--t-muted)] sm:block">1:{s.leverageMax}</span>
      <span className="flex items-center gap-1.5">
        <button type="button" onClick={() => toggleFavourite(s.id)} aria-pressed={fav} title={fav ? 'Remove from favourites' : 'Add to favourites'} className={cn('t-icon-btn !h-8 !w-8', fav && '!text-[var(--t-blue)]')}>
          <Star className={cn('!h-4 !w-4', fav && 'fill-current')} />
        </button>
        <button type="button" onClick={() => onTrade(s.id)} className="t-btn t-btn-blue !h-8 !px-4">
          Trade
        </button>
      </span>
    </li>
  );
});

/** Every instrument grouped by market with the daily move and a Trade button. */
export function ExploreView({ symbols, onTrade, className }: { symbols: SymbolSpec[] | null; onTrade: (id: string) => void; className?: string }) {
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState<string | null>(null);
  const groups = useMemo(() => {
    if (!symbols) return [];
    const q = query.trim().toUpperCase();
    const list = q ? symbols.filter((s) => s.id.includes(q) || s.name.toUpperCase().includes(q)) : symbols;
    return MARKET_LIST.filter((m) => !cls || m.cls === cls)
      .map((m) => ({ meta: m, items: list.filter((s) => s.assetClass === m.cls) }))
      .filter((g) => g.items.length > 0);
  }, [symbols, query, cls]);
  return (
    <section className={cn('t-panel', className)} aria-label="Explore instruments">
      <div className="t-bar !gap-2 !pl-4">
        <Compass className="h-4 w-4 text-[var(--t-blue)]" />
        <span className="text-[14px] font-semibold text-white">Explore</span>
        <span className="hidden text-[12px] text-[var(--t-muted)] sm:inline">{symbols?.length ?? '—'} instruments</span>
        <div className="flex-1" />
        <label className="flex h-8 w-full max-w-[220px] items-center gap-2 rounded-md bg-[var(--t-bg)] px-2.5 text-[12px] text-[var(--t-muted)]">
          <Search className="h-3.5 w-3.5" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search instruments" className="min-w-0 flex-1 bg-transparent text-white placeholder:text-[var(--t-dim)] focus:outline-none" />
        </label>
      </div>
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--t-line)] px-3 py-2 [scrollbar-width:none]">
        <button type="button" onClick={() => setCls(null)} className={cn('t-btn !h-7 !px-3 !text-[12px]', !cls ? 't-btn-blue' : 't-btn-ghost')}>
          All
        </button>
        {MARKET_LIST.map((m) => (
          <button key={m.cls} type="button" onClick={() => setCls(cls === m.cls ? null : m.cls)} className={cn('t-btn !h-7 !px-3 !text-[12px]', cls === m.cls ? 't-btn-blue' : 't-btn-ghost')}>
            <m.icon className="h-3.5 w-3.5" /> {m.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {symbols === null &&
          Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex h-[50px] items-center justify-between border-b border-[var(--t-line)] px-4">
              <Skeleton className="w-40" />
              <Skeleton className="w-24" />
            </div>
          ))}
        {symbols && groups.length === 0 && <EmptyState title={`No instrument matches “${query}”`} />}
        {groups.map((g) => (
          <section key={g.meta.cls}>
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--t-raised)] px-4 py-1.5 text-[12px] font-semibold text-white">
              <g.meta.icon className="h-3.5 w-3.5" style={{ color: `rgb(${g.meta.rgb})` }} /> {g.meta.label}
              <span className="font-normal text-[var(--t-muted)]">
                {g.items.length} · {g.meta.hours} · up to {g.meta.leverage}
              </span>
            </div>
            <ul>
              {g.items.map((s) => (
                <ExploreRow key={s.id} s={s} onTrade={onTrade} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
