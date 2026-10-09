'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Calendar, Check, Flame, Info, LayoutGrid, Minus, Moon, Plus, Search, Star, Store, X } from 'lucide-react';
import { dec, effectiveLeverage, notional, quoteCurrency, requiredMarginUsd, toUsd, validateLots, type AccountDto, type OrderSide, type PlaceOrderResult } from '@spova/shared';
import { get, post } from '@/lib/api';
import { cn } from '@/lib/utils';
import { MARKET_LIST, marketByCls } from '@/lib/markets';
import { useToast } from '@/components/toast';
import { Skeleton, Spinner } from '@/components/ui';
import { dailyChange, fmtCountdown, fmtLots, fmtNum, fmtPrice, spreadPoints, type SymbolSpec } from './format';
import { quoteStore, useBookVersion, useQuote } from './quote-store';
import { EmptyState, SymbolTile } from './bits';
import { favouritesStore, settingsStore, toggleFavourite, useFavourites, useSettings } from './settings';
import { isOpenAt, nextClose, nextOpen, sessionsLabel, type SessionRow } from './sessions';
import { tradeError } from './errors';

type ListTab = 'fav' | 'movers' | 'search';
type InfoTab = 'calendar' | 'market' | 'symbol';

/** Shared 1 Hz clock for countdowns. */
function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function Change({ v, className }: { v: number | null; className?: string }) {
  if (v === null) return <span className={cn('text-[var(--t-dim)]', className)}>—</span>;
  const up = v > 0;
  const down = v < 0;
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold', up ? 't-pnl-up' : down ? 't-pnl-down' : 'text-[var(--t-text-2)]', className)}>
      {up ? <span className="text-[8px] leading-none">▲</span> : down ? <span className="text-[8px] leading-none">▼</span> : null}
      {Math.abs(v).toFixed(2)}%
    </span>
  );
}

/** Volume stepper + SELL / BUY one-click blocks + "Advanced Order" row inside the selected watchlist row. */
export function QuickTrade({ spec, account, onPlaced, onAdvanced }: { spec: SymbolSpec; account: AccountDto | undefined; onPlaced: (r: PlaceOrderResult) => void; onAdvanced: (side: OrderSide, lots: string) => void }) {
  const toast = useToast();
  const q = useQuote(spec.id);
  useBookVersion();
  const settings = useSettings();
  const favs = useFavourites();
  const fav = favs.ids.includes(spec.id);
  const [lots, setLots] = useState(spec.minLot);
  const [busy, setBusy] = useState<OrderSide | null>(null);
  const [confirm, setConfirm] = useState<{ side: OrderSide; ref: string } | null>(null);
  useEffect(() => {
    setLots(spec.minLot);
    setConfirm(null);
  }, [spec.id, spec.minLot]);

  const hasQuote = !!q && !!q.bid && !!q.ask && !q.stale;
  const closed = q?.open === false || (q?.open === undefined && !spec.isOpen);
  const lotsErr = validateLots(lots || '0', spec.minLot, spec.maxLot, spec.lotStep);
  const lotDecimals = dec(spec.lotStep).decimalPlaces();
  const step = (dir: 1 | -1) => {
    let next = dec(lots || 0).plus(dec(spec.lotStep).times(dir));
    if (next.lt(spec.minLot)) next = dec(spec.minLot);
    if (next.gt(spec.maxLot)) next = dec(spec.maxLot);
    setLots(next.toFixed(lotDecimals));
    setConfirm(null);
  };
  const ccy = quoteCurrency(spec.id, spec.assetClass);
  const value = hasQuote && !lotsErr ? toUsd(notional(lots, spec.contractSize, (Number(q.bid) + Number(q.ask)) / 2), ccy, quoteStore.book()) : null;
  const margin = hasQuote && !lotsErr && account ? requiredMarginUsd({ lots, contractSize: spec.contractSize, price: q.ask, leverage: effectiveLeverage(account.leverage, spec.leverageMax), quoteCcy: ccy, book: quoteStore.book() }) : null;
  const blocker = !account ? 'No account' : account.tradingBlocked ? 'Trading blocked' : account.status !== 'enabled' ? `Account ${account.status}` : closed ? 'Market closed' : !hasQuote ? 'No live price' : lotsErr ?? (margin && margin.gt(account.freeMargin) ? 'Not enough free margin' : null);

  const send = async (side: OrderSide, clientRef: string) => {
    if (!account) return;
    setBusy(side);
    try {
      const r = await post<PlaceOrderResult>(`/me/accounts/${account.id}/orders`, { symbol: spec.id, side, type: 'market', lots: dec(lots).toFixed(lotDecimals), clientRef });
      onPlaced(r);
      if (r.position) toast({ level: 'success', title: `${side === 'buy' ? 'Buy' : 'Sell'} ${r.order.lots} ${spec.id} filled`, body: `Opened at ${fmtPrice(r.position.openPrice, spec.digits)} · margin ${fmtNum(r.position.marginUsed)} USD` });
    } catch (e) {
      const err = tradeError(e);
      toast({ level: 'danger', title: err.title, body: err.body });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };
  const click = (side: OrderSide) => {
    if (blocker || busy) return;
    if (settingsStore.get().confirmOrders && !confirm) {
      setConfirm({ side, ref: crypto.randomUUID() });
      return;
    }
    void send(side, confirm?.ref ?? crypto.randomUUID());
  };

  const px = (side: OrderSide) => (hasQuote ? fmtPrice(side === 'buy' ? q.ask : q.bid, spec.digits) : '—');
  return (
    <div className="px-3 pb-2 pt-1">
      {confirm ? (
        <div className="animate-pop-in flex h-[66px] items-center gap-2 rounded-lg border border-[var(--t-blue-deep)] bg-[var(--t-bg)] px-3" role="dialog" aria-label="Confirm order">
          <div className="min-w-0 flex-1 text-[12px] leading-tight">
            <div className="font-semibold text-white">
              Confirm {confirm.side === 'buy' ? 'BUY' : 'SELL'} {fmtLots(lots)} {spec.id}
            </div>
            <div className="text-[var(--t-muted)]">
              at ~{px(confirm.side)} · margin {margin ? fmtNum(margin.toFixed(2)) : '—'} USD
            </div>
          </div>
          <button type="button" onClick={() => setConfirm(null)} className="t-btn t-btn-ghost !h-8 !px-2.5" aria-label="Cancel">
            <X className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => click(confirm.side)} disabled={!!busy} className={cn('t-btn !h-8', confirm.side === 'buy' ? 't-btn-buy' : 't-btn-sell')}>
            {busy ? <Spinner className="h-3.5" tone="current" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />} Confirm
          </button>
        </div>
      ) : (
        <div className="flex items-stretch gap-2">
          <button type="button" onClick={() => click('sell')} disabled={!!blocker || !!busy} title={blocker ?? `Sell ${lots} ${spec.id} at market`} className="t-quick bg-[var(--t-sell)]">
            <span className="text-[12px] font-bold tracking-wide">SELL</span>
            <span className="mt-1 text-[15px] font-semibold">{busy === 'sell' ? <Spinner className="h-4" tone="current" /> : px('sell')}</span>
          </button>
          <div className="flex w-[108px] shrink-0 flex-col items-stretch rounded-lg bg-[var(--t-bg)] ring-1 ring-inset ring-[#3b434f]">
            <div className="flex flex-col items-center pt-1.5 leading-tight">
              <input
                value={lots}
                onChange={(e) => {
                  setLots(e.target.value.replace(/[^\d.]/g, ''));
                  setConfirm(null);
                }}
                inputMode="decimal"
                aria-label="Volume (lots)"
                aria-invalid={!!lotsErr && !!lots}
                className="w-full bg-transparent text-center text-[13px] font-semibold text-white focus:outline-none"
              />
              <span className="text-[10px] text-[var(--t-muted)]" title={value ? 'Notional value' : lotsErr ?? ''}>
                {value ? `≈ ${fmtNum(value.toFixed(0), 0)} ${account?.currency ?? 'USD'}` : lotsErr && lots ? lotsErr : '—'}
              </span>
            </div>
            <div className="mt-auto flex border-t border-[#3b434f]">
              <button type="button" onClick={() => step(-1)} aria-label="Decrease volume" className="flex h-7 flex-1 items-center justify-center text-[var(--t-blue)] transition-colors hover:bg-white/[0.06]">
                <Minus className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
              <span className="w-px bg-[#3b434f]" />
              <button type="button" onClick={() => step(1)} aria-label="Increase volume" className="flex h-7 flex-1 items-center justify-center text-[var(--t-blue)] transition-colors hover:bg-white/[0.06]">
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
            </div>
          </div>
          <button type="button" onClick={() => click('buy')} disabled={!!blocker || !!busy} title={blocker ?? `Buy ${lots} ${spec.id} at market`} className="t-quick bg-[var(--t-buy)]">
            <span className="text-[12px] font-bold tracking-wide">BUY</span>
            <span className="mt-1 text-[15px] font-semibold">{busy === 'buy' ? <Spinner className="h-4" tone="current" /> : px('buy')}</span>
          </button>
        </div>
      )}
      {blocker && !confirm && <div className="mt-1 text-center text-[11px] text-[var(--t-muted)]">{blocker}</div>}
      <div className="mt-2 flex h-9 items-center gap-2 rounded-lg bg-[var(--t-raised)] pl-3 pr-1.5">
        <button type="button" onClick={() => onAdvanced('buy', lots)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px] font-medium text-[var(--t-text-2)] transition-colors hover:text-white">
          <LayoutGrid className="h-3.5 w-3.5 text-[var(--t-muted)]" /> Advanced Order
        </button>
        <span className="t-icon-btn !h-7 !w-7" title={settings.confirmOrders ? 'Orders ask for confirmation (settings)' : 'One-click trading: orders are sent immediately (settings)'}>
          <Info className="!h-4 !w-4" />
        </span>
        <button type="button" onClick={() => toggleFavourite(spec.id)} aria-pressed={fav} title={fav ? 'Remove from favourites' : 'Add to favourites'} className={cn('t-icon-btn !h-7 !w-7', fav ? '!text-[var(--t-blue)]' : '')}>
          <Star className={cn('!h-4 !w-4', fav && 'fill-current')} />
        </button>
      </div>
    </div>
  );
}

const Row = memo(function Row({ s, selected, onSelect, sessions, children }: { s: SymbolSpec; selected: boolean; onSelect: (id: string) => void; sessions: SessionRow[] | undefined; children?: ReactNode }) {
  const q = useQuote(s.id);
  const hasPrice = !!q && !!q.bid && !!q.ask;
  const closed = q?.open === false || (q?.open === undefined && !s.isOpen);
  const change = dailyChange(q);
  const now = useNow(closed);
  const opens = closed && sessions ? nextOpen(sessions, new Date(now)) : null;
  const mid = hasPrice ? (Number(q.bid) + Number(q.ask)) / 2 : null;
  const meta = marketByCls(s.assetClass);
  return (
    <li className={cn('border-b border-[var(--t-line)]', selected && 'bg-[var(--t-raised)]')}>
      <button type="button" onClick={() => onSelect(s.id)} aria-current={selected || undefined} className={cn('grid h-[50px] w-full grid-cols-[26px_minmax(0,1fr)_auto_minmax(72px,auto)] items-center gap-x-3 px-3 text-left transition-colors', !selected && 'hover:bg-white/[0.03]')}>
        <SymbolTile spec={s} />
        <span className="min-w-0 leading-tight">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-white">{s.id}</span>
            {selected && !closed && <span className="rounded bg-[#1f6867] px-1 text-[10px] font-medium text-[#9ff0e5]">{meta?.label}</span>}
          </span>
          {closed ? (
            <span className="flex items-center gap-1 text-[11px] text-[var(--t-muted)]">
              <Moon className="h-3 w-3 text-[#e8b339]" /> {opens ? `Opens in: ${fmtCountdown(opens.getTime() - now)}` : 'Closed'}
            </span>
          ) : (
            <span className="block text-[11px] text-[var(--t-muted)]">Spread: {hasPrice ? spreadPoints(q.bid, q.ask, s.digits) : '—'}</span>
          )}
        </span>
        <span key={q?.n} className={cn('text-right text-[15px] font-medium', closed ? 'text-[var(--t-muted)]' : 'text-white', !closed && q?.dir === 'up' && 't-flash-up', !closed && q?.dir === 'down' && 't-flash-down')}>
          {mid !== null ? fmtPrice(mid, s.digits) : '—'}
        </span>
        <span className="text-right text-[14px]">
          <Change v={change} />
        </span>
      </button>
      {selected && children}
    </li>
  );
});

export interface MarketPanelProps {
  symbols: SymbolSpec[] | null;
  selected: string | null;
  onSelect: (id: string) => void;
  account: AccountDto | undefined;
  onPlaced: (r: PlaceOrderResult) => void;
  onAdvanced: (spec: SymbolSpec, side: OrderSide, lots: string) => void;
  sessions: Map<string, SessionRow[]>;
  className?: string;
  /** mobile: hide the quick-trade block (the chart tab pins its own strip) */
  quickTrade?: boolean;
}

/** Favorites / Top Movers / search list with the expanded one-click row. */
export function MarketPanel({ symbols, selected, onSelect, account, onPlaced, onAdvanced, sessions, className, quickTrade = true }: MarketPanelProps) {
  const [tab, setTab] = useState<ListTab>('fav');
  const [query, setQuery] = useState('');
  const favs = useFavourites();
  const bookVersion = useBookVersion();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (tab === 'search') inputRef.current?.focus();
  }, [tab]);
  // first run: the featured instruments are the favourites
  useEffect(() => {
    if (!symbols || favouritesStore.get().seeded) return;
    favouritesStore.set({ ids: symbols.filter((s) => s.featured).map((s) => s.id), seeded: true });
  }, [symbols]);

  const list = useMemo(() => {
    if (!symbols) return [];
    if (tab === 'search') {
      const q = query.trim().toUpperCase();
      return q ? symbols.filter((s) => s.id.includes(q) || s.name.toUpperCase().includes(q)) : symbols;
    }
    if (tab === 'movers') {
      return symbols
        .map((s) => ({ s, c: dailyChange(quoteStore.get(s.id)) }))
        .filter((x) => x.c !== null)
        .sort((a, b) => Math.abs(b.c!) - Math.abs(a.c!))
        .map((x) => x.s);
    }
    const set = new Set(favs.ids);
    const pinned = favs.ids.map((id) => symbols.find((s) => s.id === id)).filter((s): s is SymbolSpec => !!s);
    // the selected instrument always stays visible so its quick-trade row never disappears
    return selected && !set.has(selected) && symbols.some((s) => s.id === selected) ? [...pinned, symbols.find((s) => s.id === selected)!] : pinned;
    // movers re-sort on every tick batch (bookVersion)
  }, [symbols, tab, query, favs.ids, selected, tab === 'movers' ? bookVersion : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useCallback((id: string) => onSelect(id), [onSelect]);

  return (
    <section className={cn('t-panel', className)} aria-label="Instruments">
      <div className="t-bar">
        <button type="button" role="tab" aria-selected={tab === 'fav'} data-on={tab === 'fav'} onClick={() => setTab('fav')} className="t-tab flex-1 justify-center">
          <Star className={cn(tab === 'fav' && 'fill-current text-[var(--t-blue)]')} /> Favorites
        </button>
        <button type="button" role="tab" aria-selected={tab === 'movers'} data-on={tab === 'movers'} onClick={() => setTab('movers')} className="t-tab flex-1 justify-center">
          <Flame /> Top Movers
        </button>
        <button type="button" role="tab" aria-selected={tab === 'search'} data-on={tab === 'search'} onClick={() => setTab('search')} aria-label="Search instruments" className="t-icon-btn !h-[33px] !w-[40px]">
          <Search />
        </button>
      </div>
      {tab === 'search' && (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--t-line)] px-3">
          <Search className="h-3.5 w-3.5 text-[var(--t-muted)]" />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search symbol or name" aria-label="Search symbols" className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-[var(--t-dim)] focus:outline-none" />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="t-icon-btn !h-6 !w-6">
              <X className="!h-3.5 !w-3.5" />
            </button>
          )}
        </div>
      )}
      <div className="grid h-[33px] shrink-0 grid-cols-[26px_minmax(0,1fr)_auto_minmax(72px,auto)] items-center gap-x-3 border-b border-[var(--t-line)] px-3 text-[12px] text-[var(--t-muted)]">
        <span className="col-span-2">Symbol</span>
        <span className="text-right">Price</span>
        <span className="text-right">Daily</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {symbols === null &&
          Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex h-[50px] items-center justify-between border-b border-[var(--t-line)] px-3">
              <Skeleton className="w-28" />
              <Skeleton className="w-20" />
            </div>
          ))}
        {symbols && list.length === 0 && (tab === 'search' ? <EmptyState title={`No instrument matches “${query}”`} /> : tab === 'fav' ? <EmptyState icon={<Star />} title="No favourites yet">Open the search tab and star the instruments you trade most.</EmptyState> : <EmptyState title="Waiting for daily data" />)}
        <ul>
          {list.map((s) => (
            <Row key={s.id} s={s} selected={s.id === selected} onSelect={pick} sessions={sessions.get(s.id)}>
              {quickTrade && (
                <div className="hidden lg:block">
                  <QuickTrade spec={s} account={account} onPlaced={onPlaced} onAdvanced={(side, lots) => onAdvanced(s, side, lots)} />
                </div>
              )}
            </Row>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Calendar / Market / Symbol Info

interface SymbolDetail extends SymbolSpec {
  sessions: SessionRow[];
}

function MarketHours({ symbols, sessions }: { symbols: SymbolSpec[]; sessions: Map<string, SessionRow[]> }) {
  const now = useNow();
  const groups = MARKET_LIST.map((m) => {
    const first = symbols.find((s) => s.assetClass === m.cls);
    if (!first) return null;
    const rows = sessions.get(first.id) ?? [];
    const open = rows.length ? isOpenAt(rows, new Date(now)) : (quoteStore.get(first.id)?.open ?? first.isOpen);
    const until = open ? nextClose(rows, new Date(now)) : nextOpen(rows, new Date(now));
    return { m, rows, open, until, count: symbols.filter((s) => s.assetClass === m.cls).length };
  }).filter((g): g is NonNullable<typeof g> => !!g);
  return (
    <ul>
      {groups.map(({ m, rows, open, until, count }) => (
        <li key={m.cls} className="flex items-center gap-3 border-b border-[var(--t-line)] px-3 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ background: `rgb(${m.rgb} / 0.18)`, color: `rgb(${m.rgb})` }}>
            <m.icon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
              {m.label} <span className="text-[11px] font-normal text-[var(--t-muted)]">{count}</span>
            </span>
            <span className="block truncate text-[11px] text-[var(--t-muted)]">{sessionsLabel(rows)}</span>
          </span>
          <span className="text-right leading-tight">
            <span className={cn('block text-[11px] font-semibold', open ? 't-pnl-up' : 'text-[var(--t-sell)]')}>{open ? 'Open' : 'Closed'}</span>
            {until && <span className="block text-[10px] text-[var(--t-muted)]">{open ? 'closes' : 'opens'} in {fmtCountdown(until.getTime() - now)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SymbolInfo({ spec }: { spec: SymbolSpec | undefined }) {
  const [detail, setDetail] = useState<SymbolDetail | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setDetail(null);
    setError(false);
    if (!spec) return;
    let alive = true;
    get<SymbolDetail>(`/market/symbols/${spec.id}`)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [spec?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!spec) return <EmptyState title="Select an instrument" />;
  const d = detail ?? spec;
  const rows: [string, ReactNode][] = [
    ['Name', d.name],
    ['Market', marketByCls(d.assetClass)?.label ?? d.assetClass],
    ['Digits', d.digits],
    ['Contract size', dec(d.contractSize).toString()],
    ['Min / max lot', `${dec(d.minLot).toString()} / ${dec(d.maxLot).toString()}`],
    ['Lot step', dec(d.lotStep).toString()],
    ['Max leverage', `1:${d.leverageMax}`],
    ['Spread markup', `${dec(d.spreadMarkup).toString()} pts`],
    ['Swap long / short', `${dec(d.swapLong).toString()} / ${dec(d.swapShort).toString()}`],
    ['Sessions (UTC)', detail ? sessionsLabel(detail.sessions) : error ? '—' : <Spinner className="h-3" />],
  ];
  return (
    <dl className="px-3 py-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 border-b border-[var(--t-line)] py-[7px] text-[12px] last:border-b-0">
          <dt className="shrink-0 text-[var(--t-muted)]">{k}</dt>
          <dd className="truncate text-right font-medium text-white">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function InfoPanel({ symbols, spec, sessions, className }: { symbols: SymbolSpec[]; spec: SymbolSpec | undefined; sessions: Map<string, SessionRow[]>; className?: string }) {
  const [tab, setTab] = useState<InfoTab>('calendar');
  return (
    <section className={cn('t-panel', className)} aria-label="Market information">
      <div className="t-bar">
        <button type="button" role="tab" aria-selected={tab === 'calendar'} data-on={tab === 'calendar'} onClick={() => setTab('calendar')} className="t-tab">
          <Calendar /> Calendar
        </button>
        <button type="button" role="tab" aria-selected={tab === 'market'} data-on={tab === 'market'} onClick={() => setTab('market')} className="t-tab">
          <Store /> Market
        </button>
        <button type="button" role="tab" aria-selected={tab === 'symbol'} data-on={tab === 'symbol'} onClick={() => setTab('symbol')} className="t-tab">
          <Info /> Symbol Info
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'calendar' && (
          <EmptyState icon={<Calendar />} title="Economic calendar feed not connected">
            Scheduled releases will appear here once a calendar provider is configured for this broker.
          </EmptyState>
        )}
        {tab === 'market' && <MarketHours symbols={symbols} sessions={sessions} />}
        {tab === 'symbol' && <SymbolInfo spec={spec} />}
      </div>
    </section>
  );
}
