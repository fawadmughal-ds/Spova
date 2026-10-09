'use client';

import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, Check, ChevronDown, ListFilter } from 'lucide-react';
import { get } from '@/lib/api';
import { cn } from '@/lib/utils';
import { MARKET_LIST, marketByCls } from '@/lib/markets';
import { Skeleton } from '@/components/ui';
import { dailyChange, fmtPrice, type SymbolSpec } from './format';
import { quoteStore, useBookVersion, useQuote } from './quote-store';
import { CalendarEmpty, CalendarRow, Dropdown, EmptyState, SplitBar, SymbolTile, type CalendarEvent } from './bits';
import { useFavourites } from './settings';

export interface SentimentRow {
  s: string;
  buyPct: number;
  sellPct: number;
  lots: string;
}
const SENTIMENT_POLL_MS = 30_000;

/** Long / short split of the open book for the given symbols (GET /market/sentiment). Symbols without open positions are absent. */
export function useSentiment(symbols: string[]) {
  const key = symbols.join(',');
  const [rows, setRows] = useState<Map<string, SentimentRow> | null>(null);
  useEffect(() => {
    if (!key) {
      setRows(new Map());
      return;
    }
    let alive = true;
    const poll = () =>
      get<SentimentRow[]>(`/market/sentiment?symbols=${key}`)
        .then((list) => alive && setRows(new Map(list.map((r) => [r.s, r]))))
        .catch(() => alive && setRows((m) => m ?? new Map()));
    void poll();
    const t = setInterval(poll, SENTIMENT_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [key]);
  return rows;
}

function Change({ v }: { v: number | null }) {
  if (v === null) return <span className="text-[var(--t-dim)]">—</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold', v > 0 ? 't-pnl-up' : v < 0 ? 't-pnl-down' : 'text-[var(--t-text-2)]')}>
      {v > 0 ? <span className="text-[8px] leading-none">▲</span> : v < 0 ? <span className="text-[8px] leading-none">▼</span> : null}
      {Math.abs(v).toFixed(2)}%
    </span>
  );
}

const PriceRow = memo(function PriceRow({ s, onTrade }: { s: SymbolSpec; onTrade: (id: string) => void }) {
  const q = useQuote(s.id);
  const has = !!q && !!q.bid && !!q.ask;
  return (
    <li>
      <button type="button" onClick={() => onTrade(s.id)} className="t-xrow">
        <SymbolTile spec={s} size={24} />
        <span className="truncate text-[15px] font-semibold text-white">{s.id}</span>
        <span className="text-right text-[15px] text-white">{has ? fmtPrice((Number(q.bid) + Number(q.ask)) / 2, s.digits) : '—'}</span>
        <span className="text-right text-[14px]">
          <Change v={dailyChange(q)} />
        </span>
      </button>
    </li>
  );
});

function SentimentLine({ s, row, onTrade }: { s: SymbolSpec; row: SentimentRow | undefined; onTrade: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onTrade(s.id)} className="t-xrow !grid-cols-[24px_minmax(0,0.9fr)_minmax(0,1.6fr)]">
        <SymbolTile spec={s} size={24} />
        <span className="truncate text-[15px] font-semibold text-white">{s.id}</span>
        {row ? <SplitBar sellPct={row.sellPct} buyPct={row.buyPct} className="w-full pl-2" /> : <span className="text-right text-[12px] text-[var(--t-muted)]">No open positions</span>}
      </button>
    </li>
  );
}

/** Card title with an optional "▾" class picker ("Trending in FX ▾"). */
function ClassPicker({ value, onChange, all, allLabel = 'All' }: { value: string | null; onChange: (cls: string | null) => void; all?: boolean; allLabel?: string }) {
  const label = value ? marketByCls(value)?.label ?? value : allLabel;
  return (
    <Dropdown
      title="Choose a market"
      buttonClassName="inline-flex items-center gap-1.5 rounded-md px-1 text-[var(--t-blue)] hover:bg-white/[0.05]"
      button={(open) => (
        <>
          <span className="text-[22px] font-semibold">{value === 'forex' ? 'FX' : label}</span>
          <ChevronDown className={cn('h-4 w-4 text-[var(--t-text-2)] transition-transform', open && 'rotate-180')} />
        </>
      )}
    >
      {(close) => (
        <div className="w-48">
          {all && (
            <button type="button" role="menuitemradio" aria-checked={value === null} data-on={value === null} className="t-menu-item" onClick={() => (onChange(null), close())}>
              <span className="flex-1">All markets</span>
              {value === null && <Check className="text-[var(--t-blue)]" strokeWidth={3} />}
            </button>
          )}
          {MARKET_LIST.map((m) => (
            <button key={m.cls} type="button" role="menuitemradio" aria-checked={value === m.cls} data-on={value === m.cls} className="t-menu-item" onClick={() => (onChange(m.cls), close())}>
              <m.icon style={{ color: `rgb(${m.rgb})` }} />
              <span className="flex-1">{m.label}</span>
              {value === m.cls && <Check className="text-[var(--t-blue)]" strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

function Card({ title, action, children, className, head = true }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string; head?: boolean }) {
  return (
    <section className={cn('t-panel', className)}>
      <div className="flex shrink-0 items-center justify-between gap-3 px-6 pt-6 pb-3">
        <h2 className="t-h2 flex items-center gap-2">{title}</h2>
        {action}
      </div>
      {head && (
        <div className="mx-6 grid shrink-0 grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b border-[var(--t-line)] px-2 pb-2 text-[12px] text-[var(--t-muted)]">
          <span className="col-span-2">Symbol</span>
          <span className="text-right">Price</span>
          <span className="text-right">Daily</span>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-3">{children}</div>
    </section>
  );
}

const NO_EVENTS: CalendarEvent[] = [];

/** Upcoming events, trending instruments, market sentiment and top movers (the reference "Explore" page). */
export function ExploreView({ symbols, onTrade, className }: { symbols: SymbolSpec[] | null; onTrade: (id: string) => void; className?: string }) {
  const [trendCls, setTrendCls] = useState<string>('forex');
  const [moverCls, setMoverCls] = useState<string | null>(null);
  const favs = useFavourites();
  const bookVersion = useBookVersion();
  const byMove = (list: SymbolSpec[]) =>
    list
      .map((s) => ({ s, c: dailyChange(quoteStore.get(s.id)) }))
      .sort((a, b) => Math.abs(b.c ?? 0) - Math.abs(a.c ?? 0))
      .map((x) => x.s);
  // re-sorted on every tick batch (bookVersion)
  const trending = useMemo(() => (symbols ? byMove(symbols.filter((s) => s.assetClass === trendCls)) : []), [symbols, trendCls, bookVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const movers = useMemo(() => (symbols ? byMove(symbols.filter((s) => !moverCls || s.assetClass === moverCls)).slice(0, 12) : []), [symbols, moverCls, bookVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  // sentiment rows: the favourites (or the featured list on a fresh profile)
  const sentimentList = useMemo(() => {
    if (!symbols) return [];
    const ids = favs.ids.length ? favs.ids : symbols.filter((s) => s.featured).map((s) => s.id);
    return ids.map((id) => symbols.find((s) => s.id === id)).filter((s): s is SymbolSpec => !!s);
  }, [symbols, favs.ids]);
  const sentiment = useSentiment(useMemo(() => sentimentList.map((s) => s.id), [sentimentList]));

  const skeleton = Array.from({ length: 6 }, (_, i) => (
    <div key={i} className="flex h-[50px] items-center justify-between border-b border-[var(--t-line)] px-2">
      <Skeleton className="w-28" />
      <Skeleton className="w-20" />
    </div>
  ));
  return (
    <div className={cn('flex min-h-0 flex-col gap-[18px] overflow-y-auto pr-px', className)} aria-label="Explore">
      <Card
        title="Upcoming Events"
        head={false}
        className="min-h-[420px] shrink-0"
        action={
          <span className="flex gap-2">
            <span className="t-top-btn !h-8 !w-8 !rounded-md" title="Economic calendar">
              <CalendarDays className="!h-4 !w-4" />
            </span>
            <span className="t-top-btn !h-8 !w-8 !rounded-md" title="Filter events">
              <ListFilter className="!h-4 !w-4" />
            </span>
          </span>
        }
      >
        {NO_EVENTS.length === 0 ? (
          <CalendarEmpty className="min-h-[300px]" />
        ) : (
          <ul>
            {NO_EVENTS.map((e) => (
              <CalendarRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </Card>

      <div className="grid shrink-0 gap-[18px] lg:grid-cols-3">
        <Card
          className="h-[430px]"
          title={
            <>
              Trending in <ClassPicker value={trendCls} onChange={(c) => c && setTrendCls(c)} />
            </>
          }
        >
          {symbols === null ? skeleton : trending.length === 0 ? <EmptyState title="No instruments in this market" /> : <ul>{trending.map((s) => <PriceRow key={s.id} s={s} onTrade={onTrade} />)}</ul>}
        </Card>

        <section className="t-panel h-[430px]">
          <div className="flex shrink-0 items-center justify-between gap-3 px-6 pt-6 pb-3">
            <h2 className="t-h2">Market Sentiment</h2>
          </div>
          <div className="mx-6 grid shrink-0 grid-cols-[24px_minmax(0,1fr)] gap-x-3 border-b border-[var(--t-line)] px-2 pb-2 text-[12px] text-[var(--t-muted)]">
            <span className="col-span-2">Symbol</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-3">
            {symbols === null || sentiment === null ? skeleton : sentimentList.length === 0 ? <EmptyState title="No favourites yet" /> : <ul>{sentimentList.map((s) => <SentimentLine key={s.id} s={s} row={sentiment.get(s.id)} onTrade={onTrade} />)}</ul>}
          </div>
          <div className="shrink-0 px-6 pb-3 text-[11px] text-[var(--t-muted)]">Share of open volume held long vs short by this broker&apos;s clients.</div>
        </section>

        <Card
          className="h-[430px]"
          title={
            <>
              Top <ClassPicker value={moverCls} onChange={setMoverCls} all allLabel="movers" />
            </>
          }
        >
          {symbols === null ? skeleton : movers.length === 0 ? <EmptyState title="Waiting for daily data" /> : <ul>{movers.map((s) => <PriceRow key={s.id} s={s} onTrade={onTrade} />)}</ul>}
        </Card>
      </div>
    </div>
  );
}
