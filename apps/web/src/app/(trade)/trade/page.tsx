'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChartCandlestick, ChartNoAxesColumn, ChartPie, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, ClipboardList, Compass, Ellipsis, LogOut, Wallet } from 'lucide-react';
import { WS_EVENTS, type AccountDto, type OrderSide, type PlaceOrderResult, type QuoteDto, type WsNotice, type WsTick, type CandleDto } from '@spova/shared';
import { RequireAuth, useAuth } from '@/lib/auth-context';
import { get } from '@/lib/api';
import { useAccounts } from '@/lib/use-accounts';
import { useAccountStream, useSocket } from '@/lib/ws';
import { BRAND, cn } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { Skeleton, Spinner } from '@/components/ui';
import { TopBar, type NoticeItem, type TerminalView } from '@/components/trade/top-bar';
import { ClientRail, railLinks } from '@/components/trade/client-rail';
import { DocumentsPanel } from '@/components/portal/documents-panel';
import { InfoPanel, MarketPanel, QuickTrade } from '@/components/trade/market-panel';
import { ChartPanel } from '@/components/trade/chart-panel';
import { OrderTicket } from '@/components/trade/order-ticket';
import { BottomPanel, type BottomTab } from '@/components/trade/bottom-panel';
import { AnalyticsView } from '@/components/trade/analytics-view';
import { ExploreView } from '@/components/trade/explore-view';
import { MarginCallStrip, StopOutCard, TradingBlockedBanner } from '@/components/trade/notices';
import { Modal } from '@/components/trade/bits';
import { quoteStore } from '@/components/trade/quote-store';
import { useTradingData } from '@/components/trade/use-trading-data';
import { useTradeEvents } from '@/components/trade/use-trade-events';
import { fmtPrice, fmtSignedNum, type SymbolSpec } from '@/components/trade/format';
import { alertsStore, settingsStore, useSettings } from '@/components/trade/settings';
import { playSound, primeAudio } from '@/components/trade/sounds';
import { groupSessions, type SessionRow } from '@/components/trade/sessions';

type MobileTab = 'trade' | 'chart' | 'positions' | 'more';
const MOBILE_TABS: { value: MobileTab; label: string; icon: typeof Compass }[] = [
  { value: 'trade', label: 'Trade', icon: ChartNoAxesColumn },
  { value: 'chart', label: 'Chart', icon: ChartCandlestick },
  { value: 'positions', label: 'Positions', icon: ClipboardList },
  { value: 'more', label: 'More', icon: Ellipsis },
];
const QUOTE_POLL_MS = 15_000;
const DEFAULT_SYMBOL = 'BTCUSD';
const EMPTY: never[] = [];
const MIN_BOTTOM = 43;

let noticeSeq = 1;

function Terminal() {
  const params = useSearchParams();
  const toast = useToast();
  const { me, logout } = useAuth();
  const { socket, connected } = useSocket();
  const { all, data: accData, reload: reloadAccounts } = useAccounts();
  const settings = useSettings();

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

  // ---------------------------------------------------------------- symbols, sessions, quotes
  const [symbols, setSymbols] = useState<SymbolSpec[] | null>(null);
  const [symbolsError, setSymbolsError] = useState(false);
  const [selected, setSelected] = useState<string | null>(params.get('s'));
  const [sessions, setSessions] = useState<Map<string, SessionRow[]>>(() => new Map());
  useEffect(() => {
    let alive = true;
    get<SymbolSpec[]>('/market/symbols')
      .then((list) => {
        if (!alive) return;
        list.forEach((s) => s.quote && quoteStore.seed(s.id, { ...s.quote, open: s.isOpen }));
        setSymbols(list);
        setSelected((cur) => (cur && list.some((s) => s.id === cur) ? cur : list.some((s) => s.id === DEFAULT_SYMBOL) ? DEFAULT_SYMBOL : (list.find((s) => s.featured) ?? list[0])?.id ?? null));
        // previous daily close of every instrument -> base of the "Daily" column (a few requests at a time)
        const ids = list.map((s) => s.id);
        const run = async () => {
          for (let i = 0; i < ids.length && alive; i += 6) {
            await Promise.all(
              ids.slice(i, i + 6).map((id) =>
                get<CandleDto[]>(`/market/candles/${id}?tf=d1&limit=2`)
                  .then((rows) => {
                    if (!alive || rows.length === 0) return;
                    const ref = rows.length >= 2 ? Number(rows[rows.length - 2].c) : Number(rows[0].o);
                    if (Number.isFinite(ref) && ref > 0) quoteStore.setRef(id, ref);
                  })
                  .catch(() => {}),
              ),
            );
          }
        };
        void run();
      })
      .catch(() => alive && setSymbolsError(true));
    get<SessionRow[]>('/market/sessions')
      .then((rows) => alive && setSessions(groupSessions(rows)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const symbolIds = useMemo(() => (symbols ? symbols.map((s) => s.id).join(',') : ''), [symbols]);
  const symbolMap = useMemo(() => new Map((symbols ?? []).map((s) => [s.id, s])), [symbols]);
  const spec = selected ? symbolMap.get(selected) : undefined;

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
  useEffect(() => {
    primeAudio();
  }, []);

  // ---------------------------------------------------------------- notices, sounds, ledger version
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const note = useCallback((n: Omit<NoticeItem, 'id' | 'at'>) => setNotices((xs) => [{ ...n, id: noticeSeq++, at: Date.now() }, ...xs].slice(0, 50)), []);
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const played = useRef(new Map<string, number>());
  const once = (key: string) => {
    const now = Date.now();
    played.current.forEach((t, k) => now - t > 5000 && played.current.delete(k));
    if (played.current.has(key)) return false;
    played.current.set(key, now);
    return true;
  };
  useTradeEvents({
    onPositionOpened: (p) => {
      if (p.accountId !== accountId) return;
      if (once(`open:${p.id}`)) playSound('open');
      note({ level: 'success', title: `${p.side === 'buy' ? 'Buy' : 'Sell'} ${p.lots} ${p.symbol} opened`, body: `at ${fmtPrice(p.openPrice, symbolMap.get(p.symbol)?.digits ?? 2)}` });
    },
    onPositionUpdated: (p) => {
      if (p.accountId !== accountId) return;
      if (p.closedLots) {
        if (once(`close:${p.id}:${p.lots}`)) playSound('close');
        setLedgerVersion((v) => v + 1);
        note({ level: 'info', title: `${p.symbol}: ${p.closedLots} lots closed`, body: `P/L ${fmtSignedNum(p.closedPnl)} USD` });
      }
    },
    onPositionClosed: (p) => {
      if (p.accountId !== accountId) return;
      if (once(`close:${p.id}`)) playSound('close');
      setLedgerVersion((v) => v + 1);
      const pnl = Number(p.closedPnl ?? p.realizedPnl ?? 0);
      note({ level: p.closeReason === 'stopout' ? 'danger' : pnl >= 0 ? 'success' : 'warning', title: `${p.side === 'buy' ? 'Buy' : 'Sell'} ${p.closedLots ?? p.lots} ${p.symbol} closed (${p.closeReason ?? 'closed'})`, body: `P/L ${fmtSignedNum(pnl)} USD` });
    },
    onOrderFilled: (o) => {
      if (o.accountId !== accountId) return;
      if (o.positionId && once(`open:${o.positionId}`)) playSound('open');
      if (o.type !== 'market') note({ level: 'success', title: `${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.type} ${o.lots} ${o.symbol} filled`, body: o.filledPrice ? `at ${o.filledPrice}` : undefined });
    },
    onOrderCancelled: (o) => o.accountId === accountId && note({ level: 'info', title: `${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.type} ${o.lots} ${o.symbol} cancelled` }),
    onOrderRejected: (o) => o.accountId === accountId && note({ level: 'danger', title: `Order rejected: ${o.side} ${o.type} ${o.lots} ${o.symbol}`, body: o.rejectReason ?? undefined }),
  });

  // one-shot price alerts: fire when the mid crosses the level
  const lastMid = useRef(new Map<string, number>());
  useEffect(() => {
    return quoteStore.subscribeAll(() => {
      const items = alertsStore.get().items;
      if (items.length === 0) return;
      for (const s of new Set(items.map((a) => a.symbol))) {
        const q = quoteStore.get(s);
        if (!q || !q.bid || !q.ask) continue;
        const mid = (Number(q.bid) + Number(q.ask)) / 2;
        const prev = lastMid.current.get(s);
        lastMid.current.set(s, mid);
        if (prev === undefined) continue;
        for (const a of items.filter((x) => x.symbol === s)) {
          const lvl = Number(a.price);
          if ((prev < lvl && mid >= lvl) || (prev > lvl && mid <= lvl)) {
            alertsStore.set({ items: alertsStore.get().items.filter((x) => x.id !== a.id) });
            playSound('alert');
            const digits = symbolMap.get(s)?.digits ?? 2;
            toast({ level: 'warning', title: `${s} reached ${fmtPrice(lvl, digits)}`, body: `Now ${fmtPrice(mid, digits)}` });
            note({ level: 'warning', title: `Alert: ${s} reached ${fmtPrice(lvl, digits)}` });
          }
        }
      }
    });
  }, [symbolMap, toast, note]);

  // ---------------------------------------------------------------- positions, orders, notices
  const data = useTradingData(accountId);
  const [stopOut, setStopOut] = useState<WsNotice | null>(null);
  useAccountStream(
    (s) => setOverride((o) => (o && o.id === s.accountId ? null : o)),
    (n) => {
      toast({ level: n.level, title: n.title, body: n.body });
      note({ level: n.level, title: n.title, body: n.body });
      if (n.type === 'ledger' || n.type === 'payment') setLedgerVersion((v) => v + 1);
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
        if (once(`open:${r.position.id}`)) playSound('open');
      } else data.addOrder(r.order);
      onAccount(r.account);
    },
    [data, onAccount], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const openPositions = data.positions ?? EMPTY;
  const level = account?.marginLevel === null || account?.marginLevel === undefined ? null : Number(account.marginLevel);
  const marginCall = level !== null && Number.isFinite(level) && level <= 100 && openPositions.length > 0;

  // ---------------------------------------------------------------- layout
  const [view, setView] = useState<TerminalView>('trade');
  const [docsOpen, setDocsOpen] = useState(false);
  const [mtab, setMtab] = useState<MobileTab>('chart');
  const [bottomTab, setBottomTab] = useState<BottomTab>('positions');
  const [ticket, setTicket] = useState<{ spec: SymbolSpec; side: OrderSide; lots: string } | null>(null);
  const [sidebar, setSidebar] = useState(true);
  const pick = useCallback((id: string) => {
    setSelected(id);
    setMtab('chart');
    setView('trade');
  }, []);
  const show = (on: boolean) => (on ? 'flex' : 'hidden');

  // bottom panel drag handle
  const dragging = useRef<{ y: number; h: number } | null>(null);
  const onDragStart = (e: PointerEvent) => {
    dragging.current = { y: e.clientY, h: settings.bottomCollapsed ? MIN_BOTTOM : settings.bottomHeight };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDrag = (e: PointerEvent) => {
    if (!dragging.current) return;
    const h = Math.max(MIN_BOTTOM, Math.min(window.innerHeight - 260, dragging.current.h - (e.clientY - dragging.current.y)));
    settingsStore.patch({ bottomHeight: h, bottomCollapsed: h <= MIN_BOTTOM + 4 });
  };
  const onDragEnd = () => {
    dragging.current = null;
  };
  const bottomHeight = settings.bottomCollapsed ? MIN_BOTTOM : settings.bottomHeight;

  const panelSkeleton = (cls: string) => (
    <div className={cn('t-panel gap-2 p-3', cls)}>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-5" />
      <Skeleton className="h-5" />
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* light client-area rail: a sibling of the dark terminal, so it keeps the normal theme */}
      <ClientRail accounts={all} account={account} onSelectAccount={selectAccount} me={me} onLogout={() => void logout()} onOpenDocuments={() => setDocsOpen(true)} className="hidden lg:flex" />
      {docsOpen && (
        <div className="light-scope fixed inset-0 z-[85] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setDocsOpen(false)}>
          <div role="dialog" aria-modal aria-label="Documents" className="animate-pop-in max-h-[94dvh] w-full overflow-y-auto rounded-t-2xl bg-paper p-5 text-white shadow-lift sm:max-w-[760px] sm:rounded-2xl sm:p-8">
            <DocumentsPanel onClose={() => setDocsOpen(false)} />
          </div>
        </div>
      )}
      <div className="terminal flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
      <TopBar accounts={all} account={account} onSelectAccount={selectAccount} connected={connected} view={view} onView={setView} positions={openPositions} symbols={symbolMap} notices={notices} email={me?.email} onLogout={() => void logout()} />
      {account?.tradingBlocked && <TradingBlockedBanner />}
      {marginCall && level !== null && <MarginCallStrip level={level} />}
      {stopOut && <StopOutCard notice={stopOut} onDismiss={() => setStopOut(null)} />}

      <main className={cn('relative flex min-h-0 flex-1 flex-col px-2 pb-2 lg:grid lg:gap-x-[14px] lg:px-[3px] lg:pb-[6px]', view === 'trade' ? (sidebar ? 'lg:grid-cols-[388px_minmax(0,1fr)]' : 'lg:grid-cols-[0px_minmax(0,1fr)]') : 'lg:grid-cols-1')}>
        {view === 'trade' ? (
          <>
            <aside className={cn('relative min-h-0 flex-col gap-2', show(mtab === 'trade'), 'lg:flex', !sidebar && 'lg:invisible')}>
              <MarketPanel symbols={symbolsError ? [] : symbols} selected={selected} onSelect={pick} account={account} onPlaced={onPlaced} onAdvanced={(s, side, lots) => setTicket({ spec: s, side, lots })} sessions={sessions} className="min-h-0 flex-1" />
              {/* handle: swap the space between the instrument list and the info panel */}
              <button type="button" onClick={() => settingsStore.patch({ infoTall: !settings.infoTall })} aria-label={settings.infoTall ? 'Shrink the information panel' : 'Expand the information panel'} className="absolute left-1/2 z-10 hidden h-[14px] w-[38px] -translate-x-1/2 items-center justify-center rounded-full bg-[var(--t-raised)] text-[var(--t-muted)] hover:text-white lg:flex" style={{ bottom: (settings.infoTall ? 520 : 270) + 1 }}>
                <ChevronsUpDown className="h-3 w-3" />
              </button>
              {symbols && <InfoPanel spec={spec} account={account} className={cn('hidden shrink-0 lg:flex', settings.infoTall ? 'h-[520px]' : 'h-[270px]')} />}
            </aside>
            {/* sidebar collapse handle (desktop) */}
            <button type="button" onClick={() => setSidebar((v) => !v)} aria-label={sidebar ? 'Collapse the instrument panel' : 'Expand the instrument panel'} className={cn('absolute top-1/2 z-20 hidden h-9 w-[14px] -translate-y-1/2 items-center justify-center rounded-md bg-[var(--t-raised)] text-[var(--t-text-2)] hover:text-white lg:flex', sidebar ? 'left-[385px]' : 'left-[3px]')}>
              {sidebar ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>

            <div className={cn('min-h-0 min-w-0 flex-1 flex-col', show(mtab === 'chart' || mtab === 'positions'), 'lg:flex')}>
              {spec ? (
                <ChartPanel
                  spec={spec}
                  positions={openPositions}
                  className={cn('min-h-0 flex-1', show(mtab === 'chart'), 'lg:flex')}
                  footer={
                    <div className="shrink-0 border-t border-[var(--t-line)] lg:hidden">
                      <QuickTrade spec={spec} account={account} onPlaced={onPlaced} onAdvanced={(side, lots) => setTicket({ spec, side, lots })} />
                    </div>
                  }
                />
              ) : (
                <div className={cn('t-panel min-h-0 flex-1 items-center justify-center', show(mtab === 'chart'), 'lg:flex')}>
                  {symbolsError ? (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <ChartCandlestick className="h-5 w-5 text-[var(--t-sell)]" />
                      <div className="text-sm font-semibold text-white">Could not load the instrument list</div>
                      <div className="text-xs text-[var(--t-muted)]">Refresh the page to try again.</div>
                    </div>
                  ) : (
                    <Spinner />
                  )}
                </div>
              )}
              <div className="t-drag hidden lg:flex" onPointerDown={onDragStart} onPointerMove={onDrag} onPointerUp={onDragEnd} onPointerCancel={onDragEnd} role="separator" aria-orientation="horizontal" aria-label="Resize the positions panel">
                <span onClick={() => settingsStore.patch({ bottomCollapsed: !settings.bottomCollapsed })} title={settings.bottomCollapsed ? 'Expand' : 'Collapse'}>
                  {settings.bottomCollapsed ? <ChevronUp /> : <ChevronDown />}
                </span>
              </div>
              {account ? (
                <BottomPanel account={account} symbols={symbolMap} data={data} onAccount={onAccount} ledgerVersion={ledgerVersion} tab={bottomTab} onTab={setBottomTab} className={cn('min-h-0 flex-1', show(mtab === 'positions'), 'lg:flex lg:h-[var(--bh)] lg:flex-none')} style={{ ['--bh' as string]: `${bottomHeight}px` }} />
              ) : (
                panelSkeleton(cn('min-h-0 flex-1', show(mtab === 'positions'), 'lg:flex lg:h-[330px] lg:flex-none'))
              )}
            </div>
          </>
        ) : view === 'analytics' ? (
          account ? (
            <AnalyticsView account={account} history={data.history} loadHistory={data.loadHistory} symbols={symbolMap} ledgerVersion={ledgerVersion} className="min-h-0 flex-1" />
          ) : (
            panelSkeleton('min-h-0 flex-1')
          )
        ) : (
          <ExploreView symbols={symbolsError ? [] : symbols} onTrade={pick} className="min-h-0 flex-1" />
        )}

        {/* mobile "More" */}
        {mtab === 'more' && view === 'trade' && (
          <section className="t-panel min-h-0 flex-1 lg:hidden" aria-label="More">
            <div className="t-bar !pl-4 text-[14px] font-semibold text-white">More</div>
            <ul className="p-2">
              {(
                [
                  ['Analytics', 'Statistics and equity curve', <ChartPie key="a" />, () => setView('analytics')],
                  ['Explore', 'All instruments by market', <Compass key="e" />, () => setView('explore')],
                  [
                    'Finance',
                    'Balance, margin and ledger',
                    <Wallet key="f" />,
                    () => {
                      setBottomTab('finance');
                      setMtab('positions');
                    },
                  ],
                ] as [string, string, ReactNode, () => void][]
              ).map(([label, sub, icon, go]) => (
                <li key={label}>
                  <button type="button" onClick={go} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-white/[0.04]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--t-raised)] text-[var(--t-blue)] [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
                    <span className="leading-tight">
                      <span className="block text-[14px] font-semibold text-white">{label}</span>
                      <span className="block text-[12px] text-[var(--t-muted)]">{sub}</span>
                    </span>
                    <ChevronRight className="ml-auto h-4 w-4 text-[var(--t-muted)]" />
                  </button>
                </li>
              ))}
              <li className="my-1 border-t border-[var(--t-line)]" role="separator" />
              {railLinks(account).map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-white/[0.04]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--t-raised)] text-[var(--t-text-2)] [&>svg]:h-4 [&>svg]:w-4">{l.icon}</span>
                    <span className="leading-tight">
                      <span className="block text-[14px] font-semibold text-white">{l.label}</span>
                      <span className="block text-[12px] text-[var(--t-muted)]">{l.sub}</span>
                    </span>
                    <ChevronRight className="ml-auto h-4 w-4 text-[var(--t-muted)]" />
                  </Link>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-white/[0.04]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--t-raised)] text-[var(--t-sell)] [&>svg]:h-4 [&>svg]:w-4">
                    <LogOut />
                  </span>
                  <span className="block text-[14px] font-semibold text-white">Logout</span>
                </button>
              </li>
            </ul>
          </section>
        )}
      </main>

      {/* mobile bottom tab bar */}
      <nav className="flex h-14 shrink-0 border-t border-[var(--t-line)] bg-[var(--t-bg)] pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Terminal sections">
        {MOBILE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            data-on={mtab === t.value && (t.value === 'more' || view === 'trade')}
            onClick={() => {
              setMtab(t.value);
              if (t.value !== 'more') setView('trade');
            }}
            className="t-mobile-tab"
          >
            <t.icon /> {t.label}
          </button>
        ))}
      </nav>

      {ticket && account && (
        <Modal onClose={() => setTicket(null)} label="Advanced order">
          <OrderTicket spec={symbolMap.get(ticket.spec.id) ?? ticket.spec} account={account} onPlaced={onPlaced} initialSide={ticket.side} initialLots={ticket.lots} confirmOrders={settings.confirmOrders} onClose={() => setTicket(null)} className="max-h-[92dvh]" />
        </Modal>
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
          <div className="terminal flex h-dvh items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <Terminal />
      </Suspense>
    </RequireAuth>
  );
}
