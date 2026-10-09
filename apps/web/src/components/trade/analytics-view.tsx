'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChartPie, TrendingDown, TrendingUp } from 'lucide-react';
import { AreaSeries, ColorType, CrosshairMode, LineStyle, createChart, type UTCTimestamp } from 'lightweight-charts';
import type { AccountDto, LedgerEntryDto, Paginated, PositionDto } from '@spova/shared';
import { get } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { fmtDateTimeParts, fmtDuration, fmtNum, fmtSignedNum, type SymbolSpec } from './format';
import { EmptyState, SymbolTile } from './bits';

interface Stats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  total: number;
  best: PositionDto | null;
  worst: PositionDto | null;
  avgHoldMs: number | null;
  bySymbol: { symbol: string; trades: number; pnl: number }[];
}

function compute(history: PositionDto[]): Stats {
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let total = 0;
  let best: PositionDto | null = null;
  let worst: PositionDto | null = null;
  let hold = 0;
  let held = 0;
  const sym = new Map<string, { trades: number; pnl: number }>();
  for (const p of history) {
    const pnl = Number(p.realizedPnl ?? 0);
    total += pnl;
    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
    } else if (pnl < 0) {
      losses++;
      grossLoss += -pnl;
    }
    if (!best || pnl > Number(best.realizedPnl ?? 0)) best = p;
    if (!worst || pnl < Number(worst.realizedPnl ?? 0)) worst = p;
    if (p.closeAt) {
      hold += new Date(p.closeAt).getTime() - new Date(p.openAt).getTime();
      held++;
    }
    const s = sym.get(p.symbol) ?? { trades: 0, pnl: 0 };
    sym.set(p.symbol, { trades: s.trades + 1, pnl: s.pnl + pnl });
  }
  const trades = history.length;
  return {
    trades,
    wins,
    losses,
    winRate: trades ? (wins / trades) * 100 : null,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
    total,
    best,
    worst,
    avgHoldMs: held ? hold / held : null,
    bySymbol: Array.from(sym.entries())
      .map(([symbol, v]) => ({ symbol, ...v }))
      .sort((a, b) => b.pnl - a.pnl),
  };
}

/** Balance after every ledger entry, oldest first, as an area chart (single series: no legend needed). */
function EquityCurve({ ledger, currency }: { ledger: LedgerEntryDto[]; currency: string }) {
  const host = useRef<HTMLDivElement>(null);
  const points = useMemo(() => {
    const sorted = [...ledger].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const out: { time: UTCTimestamp; value: number }[] = [];
    let lastT = 0;
    for (const e of sorted) {
      let t = Math.floor(new Date(e.createdAt).getTime() / 1000);
      if (t <= lastT) t = lastT + 1; // ledger rows can share a second; the series needs strictly increasing times
      lastT = t;
      out.push({ time: t as UTCTimestamp, value: Number(e.balanceAfter) + Number(e.creditAfter) });
    }
    return out;
  }, [ledger]);
  useEffect(() => {
    const el = host.current;
    if (!el || points.length === 0) return;
    const c = createChart(el, {
      autoSize: false,
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { type: ColorType.Solid, color: '#20252c' }, textColor: '#858c99', fontFamily: 'var(--ff-body), ui-sans-serif, system-ui, sans-serif', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: 'rgba(255,255,255,0.045)' }, horzLines: { color: 'rgba(255,255,255,0.045)' } },
      crosshair: { mode: CrosshairMode.Magnet, vertLine: { color: 'rgba(186,195,210,0.4)', labelBackgroundColor: '#4b5868', style: LineStyle.Dashed }, horzLine: { color: 'rgba(186,195,210,0.4)', labelBackgroundColor: '#4b5868', style: LineStyle.Dashed } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
      localization: { locale: 'en-GB' },
    });
    const s = c.addSeries(AreaSeries, { lineColor: '#2ac3ed', topColor: 'rgba(42,195,237,0.28)', bottomColor: 'rgba(42,195,237,0.02)', lineWidth: 2, priceFormat: { type: 'price', precision: 2, minMove: 0.01 }, priceLineColor: '#2ac3ed', crosshairMarkerRadius: 4 });
    s.setData(points);
    c.timeScale().fitContent();
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) c.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      c.remove();
    };
  }, [points]);
  if (points.length === 0) return <EmptyState title="No ledger entries yet">The equity curve builds from your deposits and closed trades.</EmptyState>;
  return (
    <div className="relative h-full min-h-[220px]">
      <div ref={host} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-2 text-[11px] text-[var(--t-muted)]">Balance + credit after each ledger entry · {currency}</div>
    </div>
  );
}

function Tile({ label, value, sub, tone, className }: { label: string; value: string; sub?: string; tone?: 'up' | 'down'; className?: string }) {
  return (
    <div className={cn('bg-[var(--t-bg)] px-4 py-3', className)}>
      <div className="text-[11px] text-[var(--t-muted)]">{label}</div>
      <div className={cn('mt-0.5 text-[18px] font-semibold text-white', tone === 'up' && 't-pnl-up', tone === 'down' && 't-pnl-down')}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--t-muted)]">{sub}</div>}
    </div>
  );
}

/** Account statistics from the closed positions and the ledger. */
export function AnalyticsView({ account, history, loadHistory, symbols, ledgerVersion, className }: { account: AccountDto; history: PositionDto[] | null; loadHistory: () => Promise<void>; symbols: Map<string, SymbolSpec>; ledgerVersion: number; className?: string }) {
  const [ledger, setLedger] = useState<LedgerEntryDto[] | null>(null);
  useEffect(() => {
    if (history === null) void loadHistory();
  }, [history, loadHistory]);
  useEffect(() => {
    let alive = true;
    // newest 100 entries (API page size cap); enough for the curve of a retail account
    get<Paginated<LedgerEntryDto>>(`/me/accounts/${account.id}/ledger?page=1&limit=100`)
      .then((r) => alive && setLedger(r.items))
      .catch(() => alive && setLedger([]));
    return () => {
      alive = false;
    };
  }, [account.id, ledgerVersion]);
  const stats = useMemo(() => (history ? compute(history) : null), [history]);
  const tone = (n: number | null | undefined) => (n === null || n === undefined ? undefined : n > 0 ? 'up' : n < 0 ? 'down' : undefined);

  if (!stats || ledger === null)
    return (
      <div className={cn('t-panel items-center justify-center', className)}>
        <Spinner />
      </div>
    );
  const pf = stats.profitFactor === null ? '—' : stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2);
  return (
    <div className={cn('flex min-h-0 flex-col gap-2 overflow-y-auto', className)}>
      <section className="t-panel shrink-0">
        <div className="t-bar !pl-4 text-[14px] font-semibold text-white">
          <ChartPie className="mr-2 h-4 w-4 text-[var(--t-blue)]" /> Account statistics
          <span className="ml-2 text-[12px] font-normal text-[var(--t-muted)]">
            {account.type.toUpperCase()} {account.loginCode}
          </span>
        </div>
        {stats.trades === 0 ? (
          <EmptyState icon={<ChartPie />} title="No closed trades yet">
            Statistics appear once the first position is closed.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-px bg-[var(--t-line)] sm:grid-cols-3 xl:grid-cols-6">
            <Tile label="Total P/L" value={`${fmtSignedNum(stats.total)} ${account.currency}`} tone={tone(stats.total)} sub={`gross +${fmtNum(stats.grossProfit)} / -${fmtNum(stats.grossLoss)}`} />
            <Tile label="Trades" value={String(stats.trades)} sub={`${stats.wins} won · ${stats.losses} lost`} />
            <Tile label="Win rate" value={stats.winRate === null ? '—' : `${stats.winRate.toFixed(1)}%`} tone={stats.winRate === null ? undefined : stats.winRate >= 50 ? 'up' : 'down'} />
            <Tile label="Profit factor" value={pf} sub="gross profit ÷ gross loss" tone={stats.profitFactor === null ? undefined : stats.profitFactor >= 1 ? 'up' : 'down'} />
            <Tile label="Best trade" value={stats.best ? fmtSignedNum(stats.best.realizedPnl) : '—'} sub={stats.best ? `${stats.best.side} ${stats.best.lots} ${stats.best.symbol}` : undefined} tone="up" />
            <Tile label="Worst trade" value={stats.worst ? fmtSignedNum(stats.worst.realizedPnl) : '—'} sub={stats.worst ? `${stats.worst.side} ${stats.worst.lots} ${stats.worst.symbol}` : undefined} tone={tone(stats.worst ? Number(stats.worst.realizedPnl) : null)} />
            <Tile label="Average holding time" value={stats.avgHoldMs === null ? '—' : fmtDuration(stats.avgHoldMs)} />
            <Tile label="Balance" value={fmtNum(account.balance)} sub={account.currency} />
            <Tile label="Equity" value={fmtNum(account.equity)} sub={account.currency} />
            <Tile label="Credit" value={fmtNum(account.credit)} sub={account.currency} />
            <Tile label="Free margin" value={fmtNum(account.freeMargin)} sub={account.currency} />
            <Tile label="Margin level" value={account.marginLevel === null ? '—' : `${fmtNum(account.marginLevel)}%`} />
          </div>
        )}
      </section>
      <div className="grid min-h-[300px] shrink-0 gap-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="t-panel min-h-[300px]">
          <div className="t-bar !pl-4 text-[13px] font-semibold text-white">Equity curve</div>
          <div className="min-h-0 flex-1">
            <EquityCurve ledger={ledger} currency={account.currency} />
          </div>
        </section>
        <section className="t-panel min-h-[300px]">
          <div className="t-bar !pl-4 text-[13px] font-semibold text-white">By instrument</div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {stats.bySymbol.length === 0 ? (
              <EmptyState title="No closed trades yet" />
            ) : (
              <ul>
                {stats.bySymbol.map((r) => (
                  <li key={r.symbol} className="flex items-center gap-3 border-b border-[var(--t-line)] px-4 py-2.5">
                    <SymbolTile spec={symbols.get(r.symbol)} id={r.symbol} size={24} />
                    <span className="flex-1 text-[13px] font-semibold text-white">{r.symbol}</span>
                    <span className="text-[12px] text-[var(--t-muted)]">
                      {r.trades} trade{r.trades === 1 ? '' : 's'}
                    </span>
                    <span className={cn('inline-flex w-28 items-center justify-end gap-1 text-[13px] font-semibold', r.pnl > 0 ? 't-pnl-up' : r.pnl < 0 ? 't-pnl-down' : 'text-white')}>
                      {r.pnl > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : r.pnl < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : null}
                      {fmtSignedNum(r.pnl)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
      {stats.best && (
        <section className="t-panel shrink-0">
          <div className="t-bar !pl-4 text-[13px] font-semibold text-white">Recent closed trades</div>
          <table className="t-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="text-right">Volume</th>
                <th className="text-right">Open</th>
                <th className="text-right">Close</th>
                <th className="text-right">Closed at</th>
                <th className="text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {history!.slice(0, 8).map((p) => {
                const d = symbols.get(p.symbol)?.digits ?? 2;
                const [d2, t2] = fmtDateTimeParts(p.closeAt);
                const pnl = Number(p.realizedPnl ?? 0);
                return (
                  <tr key={p.id} className="[&>td]:!h-[42px]">
                    <td className="flex h-[42px] items-center gap-2 font-semibold text-white">
                      <SymbolTile spec={symbols.get(p.symbol)} id={p.symbol} size={20} /> {p.symbol} <span className="t-side" data-side={p.side}>{p.side === 'buy' ? 'Buy' : 'Sell'}</span>
                    </td>
                    <td className="text-right text-white">{p.lots}</td>
                    <td className="text-right text-white">{Number(p.openPrice).toFixed(d)}</td>
                    <td className="text-right text-white">{p.closePrice ? Number(p.closePrice).toFixed(d) : '—'}</td>
                    <td className="text-right text-[var(--t-text-2)]">
                      {d2} <span className="text-[var(--t-muted)]">{t2}</span>
                    </td>
                    <td className={cn('text-right font-semibold', pnl > 0 ? 't-pnl-up' : pnl < 0 ? 't-pnl-down' : 'text-white')}>{fmtSignedNum(pnl)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
