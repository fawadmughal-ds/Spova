'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CandlestickChart } from 'lucide-react';
import { WS_EVENTS, type AccountDto, type PlaceOrderResult, type QuoteDto, type Timeframe, type WsNotice, type WsTick } from '@spova/shared';
import { RequireAuth } from '@/lib/auth-context';
import { get } from '@/lib/api';
import { useAccounts } from '@/lib/use-accounts';
import { useAccountStream, useSocket } from '@/lib/ws';
import { BRAND, cn } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { SlidingTabs } from '@/components/portal/sliding-tabs';
import { Skeleton, Spinner } from '@/components/ui';
import { TerminalHeader } from '@/components/trade/terminal-header';
import { Watchlist } from '@/components/trade/watchlist';
import { ChartPanel } from '@/components/trade/chart-panel';
import { OrderTicket } from '@/components/trade/order-ticket';
import { BottomPanel } from '@/components/trade/bottom-panel';
import { MarginCallStrip, StopOutCard, TradingBlockedBanner } from '@/components/trade/notices';
import { quoteStore } from '@/components/trade/quote-store';
import { useTradingData } from '@/components/trade/use-trading-data';
import type { SymbolSpec } from '@/components/trade/format';

type MobileTab = 'chart' | 'trade' | 'positions' | 'watch';
const MOBILE_TABS: { value: MobileTab; label: string }[] = [
  { value: 'chart', label: 'Chart' },
  { value: 'trade', label: 'Trade' },
  { value: 'positions', label: 'Positions' },
  { value: 'watch', label: 'Watchlist' },
];
const QUOTE_POLL_MS = 15_000;
const DEFAULT_SYMBOL = 'BTCUSD';
const DEFAULT_TF: Timeframe = 'm1';
const EMPTY: never[] = [];

function Terminal() {
  const params = useSearchParams();
  const toast = useToast();
  const { socket, connected } = useSocket();
  const { all, data: accData, reload: reloadAccounts } = useAccounts();

  // ---------------------------------------------------------------- account
  const [accountId, setAccountId] = useState<string | null>(params.get('acc'));
  const [override, setOverride] = useState<AccountDto | null>(null);
  useEffect(() => {
    if (!accData) return;
    const wanted = params.get('acc');
    const pick = all.find((a) => a.id === wanted) ?? all[0];
    if (pick && pick.id !== accountId) setAccountId(pick.id);
    // runs once the list is loaded (accData), not on every render of `all`
  }, [accData]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectAccount = useCallback((id: string) => {
    setAccountId(id);
    setOverride(null);
    const url = new URL(window.location.href);
    url.searchParams.set('acc', id);
    window.history.replaceState(null, '', url.toString());
  }, []);
  const account = useMemo(() => {
    const base = all.find((a) => a.id === accountId);
    if (!base) return undefined;
    return override && override.id === base.id ? { ...base, ...override } : base;
    // `all` is rebuilt per render; accData is the real dependency
  }, [accData, accountId, override]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Figures returned by a mutation are shown immediately; the next snapshot / reload supersedes them. */
  const onAccount = useCallback(
    (a: AccountDto) => {
      setOverride(a);
      void reloadAccounts().then(() => setOverride((o) => (o?.id === a.id ? null : o)));
    },
    [reloadAccounts],
  );

  // ---------------------------------------------------------------- symbols + quotes
  const [symbols, setSymbols] = useState<SymbolSpec[] | null>(null);
  const [symbolsError, setSymbolsError] = useState(false);
  const [selected, setSelected] = useState<string | null>(params.get('s'));
  const [tf, setTf] = useState<Timeframe>(DEFAULT_TF);
  useEffect(() => {
    let alive = true;
    get<SymbolSpec[]>('/market/symbols')
      .then((list) => {
        if (!alive) return;
        list.forEach((s) => s.quote && quoteStore.seed(s.id, { ...s.quote, open: s.isOpen }));
        setSymbols(list);
        setSelected((cur) => (cur && list.some((s) => s.id === cur) ? cur : list.some((s) => s.id === DEFAULT_SYMBOL) ? DEFAULT_SYMBOL : (list.find((s) => s.featured) ?? list[0])?.id ?? null));
      })
      .catch(() => alive && setSymbolsError(true));
    return () => {
      alive = false;
    };
  }, []);
  const symbolIds = useMemo(() => (symbols ? symbols.map((s) => s.id).join(',') : ''), [symbols]);
  const symbolMap = useMemo(() => new Map((symbols ?? []).map((s) => [s.id, s])), [symbols]);
  const spec = selected ? symbolMap.get(selected) : undefined;

  // ticks for every listed instrument (conversion pairs included), re-sent on every reconnect
  useEffect(() => {
    if (!socket || !symbolIds) return;
    const sub = () => socket.emit(WS_EVENTS.SUBSCRIBE, { symbols: symbolIds.split(',') });
    if (socket.connected) sub();
    socket.on('connect', sub);
    return () => {
      socket.off('connect', sub);
    };
  }, [socket, symbolIds]);
  useEffect(() => {
    if (!socket || !accountId) return;
    const sel = () => socket.emit(WS_EVENTS.SELECT_ACCOUNT, { accountId });
    if (socket.connected) sel();
    socket.on('connect', sel);
    return () => {
      socket.off('connect', sel);
    };
  }, [socket, accountId]);
  useEffect(() => {
    if (!socket) return;
    const onTick = (t: WsTick) => quoteStore.tick(t);
    socket.on(WS_EVENTS.TICK, onTick);
    return () => {
      socket.off(WS_EVENTS.TICK, onTick);
    };
  }, [socket]);

  // session open/closed + stale flags come from REST, polled
  useEffect(() => {
    if (!symbolIds) return;
    let alive = true;
    const poll = async () => {
      try {
        const qs = await get<QuoteDto[]>(`/market/quotes?symbols=${symbolIds}`);
        if (!alive) return;
        qs.forEach((q) => quoteStore.seed(q.s, { bid: q.bid, ask: q.ask, ts: q.ts, open: q.open }));
        setSymbols((prev) => {
          if (!prev) return prev;
          let changed = false;
          const next = prev.map((s) => {
            const q = qs.find((x) => x.s === s.id);
            if (q && q.open !== s.isOpen) {
              changed = true;
              return { ...s, isOpen: q.open };
            }
            return s;
          });
          return changed ? next : prev;
        });
      } catch {
        /* next poll */
      }
    };
    void poll();
    const t = setInterval(poll, QUOTE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [symbolIds]);

  useEffect(() => {
    document.title = `${selected ?? 'Terminal'} · ${BRAND} WebTrader`;
  }, [selected]);

  // ---------------------------------------------------------------- positions, orders, notices
  const data = useTradingData(accountId);
  const [stopOut, setStopOut] = useState<WsNotice | null>(null);
  useAccountStream(
    (s) => setOverride((o) => (o && o.id === s.accountId ? null : o)),
    (n) => {
      toast({ level: n.level, title: n.title, body: n.body });
      if (n.type === 'stop_out') {
        setStopOut(n);
        void data.reload();
      }
      if (n.type === 'trading_blocked' || n.type === 'stop_out') void reloadAccounts();
    },
  );
  const onPlaced = useCallback(
    (r: PlaceOrderResult) => {
      data.markOwn(r.order.id);
      if (r.position) {
        data.markOwn(r.position.id);
        data.upsertPosition(r.position);
      } else data.addOrder(r.order);
      onAccount(r.account);
    },
    [data, onAccount],
  );
  const openPositions = data.positions ?? EMPTY;
  const level = account?.marginLevel === null || account?.marginLevel === undefined ? null : Number(account.marginLevel);
  const marginCall = level !== null && Number.isFinite(level) && level <= 100 && openPositions.length > 0;

  // ---------------------------------------------------------------- layout
  const [mtab, setMtab] = useState<MobileTab>('chart');
  const pick = useCallback((id: string) => {
    setSelected(id);
    setMtab('chart');
  }, []);
  const show = (on: boolean) => (on ? 'flex' : 'hidden');

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink-950 text-ink-100">
      <TerminalHeader accounts={all} account={account} onSelect={selectAccount} connected={connected} />
      {account?.tradingBlocked && <TradingBlockedBanner />}
      {marginCall && level !== null && <MarginCallStrip level={level} />}
      {stopOut && <StopOutCard notice={stopOut} onDismiss={() => setStopOut(null)} />}
      <div className="shrink-0 border-b border-white/[0.07] bg-paper px-1 lg:hidden">
        <SlidingTabs items={MOBILE_TABS} value={mtab} onChange={setMtab} variant="underline" className="!border-b-0 [&_button]:!px-3 [&_button]:!py-2 [&_button]:!text-xs" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[236px_minmax(0,1fr)_304px] xl:grid-cols-[256px_minmax(0,1fr)_320px]">
        <Watchlist symbols={symbolsError ? [] : symbols} selected={selected} onSelect={pick} className={cn('min-h-0 flex-1', show(mtab === 'watch'), 'lg:flex lg:border-r lg:border-white/[0.07]')} />

        <div className={cn('min-h-0 min-w-0 flex-1 flex-col', show(mtab === 'chart' || mtab === 'positions'), 'lg:flex')}>
          {spec ? (
            <ChartPanel spec={spec} tf={tf} onTf={setTf} positions={openPositions} className={cn('min-h-0 flex-1', show(mtab === 'chart'), 'lg:flex')} />
          ) : (
            <div className={cn('min-h-0 flex-1 items-center justify-center bg-paper', show(mtab === 'chart'), 'lg:flex')}>
              {symbolsError ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <CandlestickChart className="h-5 w-5 text-down" />
                  <div className="text-sm font-semibold text-ink-200">Could not load the instrument list</div>
                  <div className="text-xs text-ink-500">Refresh the page to try again.</div>
                </div>
              ) : (
                <Spinner />
              )}
            </div>
          )}
          {account ? (
            <BottomPanel account={account} symbols={symbolMap} data={data} onAccount={onAccount} className={cn('min-h-0 flex-1', show(mtab === 'positions'), 'lg:flex lg:h-[272px] lg:flex-none lg:border-t lg:border-white/[0.07]')} />
          ) : (
            <div className={cn('min-h-0 flex-1 flex-col gap-2 bg-paper p-3', show(mtab === 'positions'), 'lg:flex lg:h-[272px] lg:flex-none lg:border-t lg:border-white/[0.07]')}>
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
            </div>
          )}
        </div>

        {spec && account ? (
          <OrderTicket spec={spec} account={account} onPlaced={onPlaced} className={cn('min-h-0 flex-1', show(mtab === 'trade'), 'lg:flex lg:border-l lg:border-white/[0.07]')} />
        ) : (
          <div className={cn('min-h-0 flex-1 flex-col gap-3 bg-paper p-3', show(mtab === 'trade'), 'lg:flex lg:border-l lg:border-white/[0.07]')}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12" />
            <Skeleton className="h-8" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-20" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <RequireAuth>
      <Suspense
        fallback={
          <div className="flex h-dvh items-center justify-center bg-ink-950">
            <Spinner />
          </div>
        }
      >
        <Terminal />
      </Suspense>
    </RequireAuth>
  );
}
